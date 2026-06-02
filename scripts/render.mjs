#!/usr/bin/env node
// =============================================================================
// render.mjs  --  ai-core-kit P4 RENDER ENGINE (META-layer tooling)
// =============================================================================
// Deterministic `${VAR}` substitution + manifest-driven conditional-inclusion
// renderer. Implements docs/RENDER-ENGINE.md EXACTLY (see scripts/README.md for
// the invariant list). Importable as a module (create-ack consumes the exported
// functions) AND runnable as a CLI:
//
//   node scripts/render.mjs --manifest <path> --templates <archetypes-dir> --out <dir>
//
// Zero hard third-party deps at import time: js-yaml is imported LAZILY and only
// when a YAML *file* must be read (the CLI path, or loadManifest). create-ack can
// pass an already-parsed `managed` object straight into render()/renderTree() and
// never touch js-yaml through this module. ajv is NOT used here — the renderer
// assumes a schema-valid manifest (invariant I6: validation happens upstream in
// /ack-init before any render).
// =============================================================================

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// -----------------------------------------------------------------------------
// Errors
// -----------------------------------------------------------------------------

/** A hard, fail-closed render error. Carries an optional `path` (the offending
 *  dotted manifest path or the offending file) so callers can name it. */
export class RenderError extends Error {
  constructor(message, extra = {}) {
    super(message);
    this.name = 'RenderError';
    Object.assign(this, extra);
  }
}

// -----------------------------------------------------------------------------
// §2 Substitution core
// -----------------------------------------------------------------------------

// LOWERCASE-ONLY dotted path. The lower-case [a-z0-9_] class is the mechanism by
// which shell `${CLAUDE_PROJECT_DIR}` (upper-case) is NEVER matched and survives
// verbatim, while manifest `${project.name}` is substituted.
export const VAR_RE = /\$\{([a-z0-9_]+(?:\.[a-z0-9_]+)*)\}/g;

/**
 * Walk a dotted path against the `managed` subtree.
 * Returns { found: boolean, value }. `value` may be undefined when not found.
 * Container detection (object/array) is left to the caller.
 */
export function lookup(dottedPath, managed) {
  const segments = dottedPath.split('.');
  let cur = managed;
  for (const seg of segments) {
    if (cur === null || cur === undefined || typeof cur !== 'object' || Array.isArray(cur)) {
      // Can't descend further into a scalar/array/null/missing node.
      return { found: false, value: undefined };
    }
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) {
      return { found: false, value: undefined };
    }
    cur = cur[seg];
  }
  return { found: true, value: cur };
}

/**
 * Resolve a `when` / `#ack:if` boolean predicate by dotted path.
 * Absent key => false (RENDER-ENGINE.md §4.2 rule 4). A present scalar is
 * coerced via JS truthiness; a present container is truthy iff non-empty for
 * arrays / always truthy for objects — but boolean paths are the contract, so we
 * coerce with Boolean() after rejecting nothing (the schema guarantees bools).
 */
export function lookupBool(dottedPath, managed) {
  const { found, value } = lookup(dottedPath, managed);
  if (!found) return false;
  return Boolean(value);
}

/** bool -> "true"/"false"; number -> as-is; string -> as-is. */
function scalarToString(val) {
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  return String(val);
}

/**
 * §2.2 core. Substitute every `${dotted.path}` in `text` from `managed`.
 *  - UNBOUND path        => RenderError (names the path)
 *  - container (obj/arr) => RenderError (scalars only)
 *  - bool                => "true"/"false"; number as-is
 *  - output is NOT re-scanned for further `${...}`
 */
export function render(text, managed) {
  return text.replace(VAR_RE, (_match, dottedPath) => {
    const { found, value } = lookup(dottedPath, managed);
    if (!found || value === undefined) {
      throw new RenderError(`unbound \${${dottedPath}} (not in managed:)`, { path: dottedPath });
    }
    if (value !== null && typeof value === 'object') {
      // dict or array
      throw new RenderError(`\${${dottedPath}} resolves to a container, not a scalar`, { path: dottedPath });
    }
    if (value === null) {
      throw new RenderError(`\${${dottedPath}} resolves to null, not a scalar`, { path: dottedPath });
    }
    return scalarToString(value);
  });
}

// -----------------------------------------------------------------------------
// §3 Render directives (line-oriented, processed BEFORE JSON parse)
// -----------------------------------------------------------------------------

const EACH_RE = /^(\s*)#ack:each\s+([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s+as\s+"(.*)"\s*$/;
const IF_RE = /^(\s*)#ack:if\s+([a-z0-9_]+(?:\.[a-z0-9_]+)*)\s*$/;
const ENDIF_RE = /^(\s*)#ack:endif\s*$/;

/**
 * Expand `#ack:each` and `#ack:if/#ack:endif` directives line-by-line.
 * - `#ack:each <list.path> as "<fmt with $item>"` => one line per list element.
 *   The format string is emitted verbatim per element with literal `$item`
 *   replaced by the element value (then the surrounding `${...}` substitution in
 *   render() handles any manifest vars in the wider file — but `$item` itself is
 *   NOT a `${...}` placeholder, so we substitute it here). The list path MUST be
 *   an array; a non-array (scalar/object/missing) is a hard RenderError.
 * - `#ack:if <bool.path>` ... `#ack:endif` => enclosed lines kept iff truthy.
 *   No nesting (depth 1); a nested `#ack:if` is a hard RenderError.
 *
 * Returns the directive-expanded text (still containing `${...}` for render()).
 */
export function expandDirectives(text, managed) {
  const lines = text.split('\n');
  const out = [];

  // #ack:if state (depth-1 only)
  let inIf = false;
  let ifActive = true; // whether the current #ack:if block's lines are kept
  let ifPath = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const ifM = IF_RE.exec(line);
    if (ifM) {
      if (inIf) {
        throw new RenderError(`nested #ack:if is not allowed (depth>1) at line ${i + 1}`, { path: ifM[2] });
      }
      inIf = true;
      ifPath = ifM[2];
      ifActive = lookupBool(ifPath, managed);
      continue; // the directive line itself is never emitted
    }

    const endM = ENDIF_RE.exec(line);
    if (endM) {
      if (!inIf) {
        throw new RenderError(`#ack:endif without matching #ack:if at line ${i + 1}`);
      }
      inIf = false;
      ifActive = true;
      ifPath = null;
      continue;
    }

    // Lines suppressed by a false #ack:if are dropped entirely (incl. #ack:each).
    if (inIf && !ifActive) {
      continue;
    }

    const eachM = EACH_RE.exec(line);
    if (eachM) {
      const [, indent, listPath, fmt] = eachM;
      const { found, value } = lookup(listPath, managed);
      if (!found || value === undefined) {
        throw new RenderError(`#ack:each references unbound \${${listPath}} (not in managed:)`, { path: listPath });
      }
      if (!Array.isArray(value)) {
        throw new RenderError(`#ack:each <${listPath}> must reference a list, got ${typeof value}`, { path: listPath });
      }
      for (const item of value) {
        if (item !== null && typeof item === 'object') {
          throw new RenderError(`#ack:each <${listPath}> element is a container, not a scalar`, { path: listPath });
        }
        // Replace the literal token `$item` with the element's scalar string.
        // Use split/join so a `$` in the value never re-triggers replacement.
        const rendered = fmt.split('$item').join(scalarToString(item));
        out.push(indent + rendered);
      }
      continue;
    }

    out.push(line);
  }

  if (inIf) {
    throw new RenderError(`unterminated #ack:if <${ifPath}> (missing #ack:endif)`, { path: ifPath });
  }

  return out.join('\n');
}

// -----------------------------------------------------------------------------
// §2.3 JSON-safe render
// -----------------------------------------------------------------------------

/** Recursively sort object keys so JSON output is byte-deterministic. */
function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/**
 * §2.3 For `*.json.tpl`: expand directives, substitute `${...}`, then JSON.parse
 * + JSON.stringify with SORTED keys and 2-space indent. Guarantees valid +
 * byte-deterministic JSON regardless of source key order.
 */
export function renderJson(text, managed) {
  const expanded = expandDirectives(text, managed);
  const substituted = render(expanded, managed);
  let parsed;
  try {
    parsed = JSON.parse(substituted);
  } catch (err) {
    throw new RenderError(`rendered JSON is invalid: ${err.message}`);
  }
  return JSON.stringify(sortKeysDeep(parsed), null, 2) + '\n';
}

/**
 * §2 + §3 for text templates: expand directives then substitute. (No re-scan.)
 */
export function renderText(text, managed) {
  const expanded = expandDirectives(text, managed);
  return render(expanded, managed);
}

// -----------------------------------------------------------------------------
// §6 Path hygiene assertion (fail-closed)
// -----------------------------------------------------------------------------

// Default ack-install path probe: the dir holding this very engine, two levels
// up (scripts/render.mjs -> repo root). Used to forbid absolute kit paths in
// rendered child content. Callable code may override via opts.ackInstallDir.
const __filename = fileURLToPath(import.meta.url);
const DEFAULT_ACK_INSTALL_DIR = path.resolve(path.dirname(__filename), '..');

/**
 * §6 Before writing a child file, assert its CONTENT contains:
 *   - NO "templates/archetypes/" substring
 *   - NO absolute path under the ack install dir
 * `${CLAUDE_PROJECT_DIR}` (upper-case) is explicitly permitted (not matched by
 * the lower-case substitution regex, and is the only allowed shell var).
 * Throws RenderError naming the output path on violation.
 */
export function assertPathHygiene(content, outputRelPath, ackInstallDir = DEFAULT_ACK_INSTALL_DIR) {
  if (content.includes('templates/archetypes/')) {
    throw new RenderError(
      `path-hygiene violation: rendered content of "${outputRelPath}" contains "templates/archetypes/"`,
      { path: outputRelPath, violation: 'templates/archetypes/' },
    );
  }
  if (ackInstallDir && content.includes(ackInstallDir)) {
    throw new RenderError(
      `path-hygiene violation: rendered content of "${outputRelPath}" contains the absolute ack install path "${ackInstallDir}"`,
      { path: outputRelPath, violation: ackInstallDir },
    );
  }
  return true;
}

// -----------------------------------------------------------------------------
// §4 render.map.yaml glob guards
// -----------------------------------------------------------------------------

/**
 * Compile an fnmatch-ish glob (with `**`) into a RegExp matched against a POSIX
 * relative path. Supports `**` (any depth incl. zero segments), `*` (within a
 * segment, no `/`), `?` (single non-`/` char). Other regex metachars escaped.
 */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**` — match across path separators (greedy, including none).
        i++;
        // Consume an optional trailing slash so `**/x` also matches `x`.
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

/** Does `glob` match the relative path `p`? */
export function globMatch(glob, p) {
  return globToRegExp(glob).test(p);
}

// -----------------------------------------------------------------------------
// §4.2 Path-segment guards `_when.<bool.path>/`
// -----------------------------------------------------------------------------

const WHEN_SEG_RE = /^_when\.([a-z0-9_]+(?:\.[a-z0-9_]+)*)$/;

/**
 * Given the archetype-relative template path (still containing `.tpl` and any
 * `_when.*` segments), evaluate ALL path-segment guards FIRST.
 * Returns { included: boolean, strippedPath } where strippedPath has every
 * `_when.*` segment removed (regardless of inclusion, for reporting).
 * A single false guard short-circuits to included=false.
 */
export function evalPathSegments(relTemplatePath, managed) {
  const segments = relTemplatePath.split('/');
  const kept = [];
  let included = true;
  for (const seg of segments) {
    const m = WHEN_SEG_RE.exec(seg);
    if (m) {
      const boolPath = m[1];
      if (!lookupBool(boolPath, managed)) {
        included = false;
        // keep evaluating to strip all segments, but result is omit
      }
      // strip the guard segment from the output path
      continue;
    }
    kept.push(seg);
  }
  return { included, strippedPath: kept.join('/') };
}

// -----------------------------------------------------------------------------
// render.map.yaml evaluation
// -----------------------------------------------------------------------------

/**
 * Evaluate the render.map.yaml rules against a POST-STRIP output path that still
 * carries its `.tpl` suffix where applicable (globs in the map reference the
 * template name, e.g. `**​/.mcp.json.tpl`). Logic per RENDER-ENGINE.md §4.2:
 *  - For every rule whose `archetype` is `*` or === managed.archetype AND whose
 *    glob matches the path:
 *      * if rule has `requires_archetype` AND when is truthy AND
 *        managed.archetype is not among requires_archetype => ABORT (RenderError).
 *        requires_archetype may be a SCALAR (single archetype) OR an ARRAY of
 *        allowed archetypes (v3: design-system is shared by [fullstack, saas]).
 *      * the file is included iff EVERY matching rule's `when` is truthy.
 *  - Rules whose archetype scope does not apply are ignored.
 * Returns { included: boolean }.
 */
export function evalRenderMap(renderMap, postStripWithTpl, archetype, managed) {
  if (!renderMap || !Array.isArray(renderMap.rules)) return { included: true };
  let included = true;
  for (const rule of renderMap.rules) {
    const ruleArch = rule.archetype ?? '*';
    if (ruleArch !== '*' && ruleArch !== archetype) continue;
    if (!globMatch(rule.glob, postStripWithTpl)) continue;

    const whenTruthy = rule.when ? lookupBool(rule.when, managed) : true;

    if (rule.requires_archetype && whenTruthy) {
      const allowed = Array.isArray(rule.requires_archetype)
        ? rule.requires_archetype
        : [rule.requires_archetype];
      if (!allowed.includes(archetype)) {
        throw new RenderError(
          `render.map.yaml assertion failed: rule glob "${rule.glob}" matched "${postStripWithTpl}" with when=${rule.when} truthy, ` +
            `but managed.archetype="${archetype}" is not in requires_archetype=${JSON.stringify(rule.requires_archetype)}`,
          { path: postStripWithTpl },
        );
      }
    }
    if (!whenTruthy) included = false;
  }
  return { included };
}

// -----------------------------------------------------------------------------
// §4.1 Directory walk
// -----------------------------------------------------------------------------

/** Recursively list all files under `dir`, returning paths relative to `dir`. */
function walkFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const child of walkFiles(full)) {
        results.push(path.join(entry.name, child));
      }
    } else if (entry.isFile()) {
      results.push(entry.name);
    }
  }
  return results;
}

// -----------------------------------------------------------------------------
// §5.1 / §5.2 Managed-block merge for shared files (re-run)
// -----------------------------------------------------------------------------

const TEXT_MANAGED_START = '<!-- >>> ack:managed';
const TEXT_MANAGED_END = '<!-- <<< ack:managed <<< -->';

/**
 * Text managed-block merge (managed_block: "ack:managed"). `rendered` already
 * contains the full file body INCLUDING fresh markers. On re-run we replace only
 * the region between the existing markers in `existing`, preserving everything
 * outside. If `existing` has no markers, append the managed block at end. If
 * `existing` is absent, the rendered file is used wholesale.
 */
export function mergeTextManaged(existing, rendered) {
  if (existing === null || existing === undefined) return rendered;

  const startIdx = existing.indexOf(TEXT_MANAGED_START);
  const endMarkIdx = existing.indexOf(TEXT_MANAGED_END);

  // Extract the fresh managed region from `rendered`.
  const rStart = rendered.indexOf(TEXT_MANAGED_START);
  const rEnd = rendered.indexOf(TEXT_MANAGED_END);
  if (rStart === -1 || rEnd === -1) {
    // Rendered file declares no managed region; treat as whole-file.
    return rendered;
  }
  const freshBlock = rendered.slice(rStart, rEnd + TEXT_MANAGED_END.length);

  if (startIdx === -1 || endMarkIdx === -1) {
    // No existing markers: append fresh block at the end, preserving human body.
    const sep = existing.endsWith('\n') ? '\n' : '\n\n';
    return existing + sep + freshBlock + '\n';
  }

  const before = existing.slice(0, startIdx);
  const after = existing.slice(endMarkIdx + TEXT_MANAGED_END.length);
  return before + freshBlock + after;
}

/**
 * JSON key-set managed merge.
 *  - settings.json (json:hooks,env): replace only declared managed keys.
 *      * hooks owned only when features.sdd_gate (else remove ack matcher entry).
 *      * env: ack owns ONLY CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS (when
 *        features.agent_teams); other env keys untouched.
 *  - .mcp.json (json:mcpServers): within mcpServers ack owns ONLY ack-* keys;
 *    user-added (non-ack-*) servers untouched.
 * `descriptor` is the `json:<comma-keys>` string. `renderedObj` is the parsed
 * fresh render. `existingObj` is the parsed on-disk file (or {}).
 */
export function mergeJsonManaged(descriptor, renderedObj, existingObj, managed) {
  const keys = descriptor.replace(/^json:/, '').split(',').map((k) => k.trim()).filter(Boolean);
  const result = existingObj && typeof existingObj === 'object' && !Array.isArray(existingObj)
    ? { ...existingObj }
    : {};

  for (const key of keys) {
    if (key === 'hooks') {
      // Owned only when sdd_gate is on.
      if (managed?.features?.sdd_gate) {
        if (Object.prototype.hasOwnProperty.call(renderedObj, 'hooks')) {
          result.hooks = renderedObj.hooks;
        }
      } else {
        // sdd_gate off: remove the ack matcher entry we previously wrote. With a
        // whole-key model we drop `hooks` only if it is solely ack-owned; to be
        // conservative we leave a human-extended hooks block. Here: if rendered
        // has no hooks and existing has hooks, leave as-is (renderer wrote none).
      }
    } else if (key === 'env') {
      // ack owns ONLY CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, and only when
      // agent_teams is on. Preserve all other env keys.
      const existingEnv = (existingObj && typeof existingObj.env === 'object' && !Array.isArray(existingObj.env))
        ? { ...existingObj.env }
        : {};
      const TEAMS = 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS';
      if (managed?.features?.agent_teams) {
        const renderedEnv = (renderedObj && typeof renderedObj.env === 'object') ? renderedObj.env : {};
        if (Object.prototype.hasOwnProperty.call(renderedEnv, TEAMS)) {
          existingEnv[TEAMS] = renderedEnv[TEAMS];
        }
      } else {
        delete existingEnv[TEAMS];
      }
      if (Object.keys(existingEnv).length > 0) {
        result.env = existingEnv;
      } else {
        delete result.env;
      }
    } else if (key === 'mcpServers') {
      // Within mcpServers, ack owns ONLY ack-* keys.
      const existingServers = (existingObj && typeof existingObj.mcpServers === 'object' && !Array.isArray(existingObj.mcpServers))
        ? { ...existingObj.mcpServers }
        : {};
      const renderedServers = (renderedObj && typeof renderedObj.mcpServers === 'object') ? renderedObj.mcpServers : {};
      // Drop stale ack-* servers, then re-add the freshly rendered ack-* ones.
      for (const sk of Object.keys(existingServers)) {
        if (sk.startsWith('ack-')) delete existingServers[sk];
      }
      for (const sk of Object.keys(renderedServers)) {
        if (sk.startsWith('ack-')) existingServers[sk] = renderedServers[sk];
      }
      if (Object.keys(existingServers).length > 0) {
        result.mcpServers = existingServers;
      } else {
        delete result.mcpServers;
      }
    } else {
      // Generic whole-key ownership.
      if (Object.prototype.hasOwnProperty.call(renderedObj, key)) {
        result[key] = renderedObj[key];
      }
    }
  }
  return result;
}

// -----------------------------------------------------------------------------
// manifest_hash (no-op fast path)
// -----------------------------------------------------------------------------

/** Deep clone via structuredClone with a JSON fallback. */
function clone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compute the canonical manifest hash: sha256 of the canonicalized `managed:`
 * subtree, EXCLUDING the renderer-written / provenance fields that are NOT part
 * of the manifest INPUT — `manifest_hash`, `generator.*`, and `rendered_files`
 * (the ownership ledger the renderer writes back AFTER hashing; including it
 * would make the no-op fast path impossible because the hash would change the
 * moment the ledger is written). Canonical = sorted keys, compact (no
 * whitespace) JSON. Returns "sha256:<hex>".
 */
export function computeManifestHash(managed) {
  const copy = clone(managed);
  delete copy.manifest_hash;
  delete copy.generator;
  delete copy.rendered_files;
  const canonical = JSON.stringify(sortKeysDeep(copy));
  const hex = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${hex}`;
}

// -----------------------------------------------------------------------------
// YAML loading (LAZY js-yaml import)
// -----------------------------------------------------------------------------

let _yamlMod = null;
async function loadYamlModule() {
  if (_yamlMod) return _yamlMod;
  try {
    _yamlMod = await import('js-yaml');
  } catch (err) {
    throw new RenderError(
      'js-yaml is required to read/write YAML files but is not installed. ' +
        'Install it at the kit root (npm i js-yaml) or pass an already-parsed ' +
        'manifest object to renderTree({ managed }).',
    );
  }
  return _yamlMod;
}

/** Load + parse a YAML file, returning the JS object. */
export async function loadYamlFile(filePath) {
  const yaml = await loadYamlModule();
  const text = fs.readFileSync(filePath, 'utf8');
  return yaml.load(text);
}

/** Load a manifest YAML file and return its parsed object ({schema_version, managed, ...}). */
export async function loadManifest(manifestPath) {
  const doc = await loadYamlFile(manifestPath);
  if (!doc || typeof doc !== 'object' || !doc.managed) {
    throw new RenderError(`manifest "${manifestPath}" has no managed: subtree`);
  }
  return doc;
}

/** Load render.map.yaml from the archetypes dir (the dir CONTAINING the archetype trees). */
export async function loadRenderMap(archetypesDir) {
  const mapPath = path.join(archetypesDir, 'render.map.yaml');
  if (!fs.existsSync(mapPath)) return { version: 1, rules: [] };
  return loadYamlFile(mapPath);
}

// -----------------------------------------------------------------------------
// §4 + §5 renderTree — the orchestrator
// -----------------------------------------------------------------------------

/**
 * Plan a render: walk templates/archetypes/<archetype>/, evaluate path-segment
 * guards then render.map.yaml globs, and produce the list of files to emit with
 * their resolved output paths and render kind (json | text | static). Does NOT
 * touch the filesystem output. Useful for tests and dry runs.
 *
 * @param {object} opts
 * @param {object} opts.managed       parsed managed: subtree
 * @param {string} opts.archetypesDir dir containing <archetype>/ trees + render.map.yaml
 * @param {object} [opts.renderMap]   pre-loaded render.map (else loaded from archetypesDir)
 * @returns {{ archetype, files: Array<{templateRel, outputRel, kind, included}> }}
 */
export function planTree({ managed, archetypesDir, renderMap }) {
  const archetype = managed.archetype;
  if (!archetype) throw new RenderError('managed.archetype is required to select a template tree');
  const archRoot = path.join(archetypesDir, archetype);
  if (!fs.existsSync(archRoot) || !fs.statSync(archRoot).isDirectory()) {
    throw new RenderError(`archetype template tree not found: ${archRoot}`, { path: archRoot });
  }
  const map = renderMap ?? { version: 1, rules: [] };

  const templateRels = walkFiles(archRoot);
  const files = [];

  for (const templateRel of templateRels) {
    // 1. Path-segment guards FIRST (short-circuit + strip).
    const { included: segIncluded, strippedPath } = evalPathSegments(templateRel, managed);

    // 2. render.map globs against the POST-STRIP path (still carrying .tpl).
    let mapIncluded = true;
    if (segIncluded) {
      const r = evalRenderMap(map, strippedPath, archetype, managed); // may throw (requires_archetype)
      mapIncluded = r.included;
    }

    const included = segIncluded && mapIncluded;

    // Compute output path: strip a trailing .tpl suffix on the basename only.
    const outputRel = strippedPath.endsWith('.tpl')
      ? strippedPath.slice(0, -'.tpl'.length)
      : strippedPath;

    const isTpl = strippedPath.endsWith('.tpl');
    let kind;
    if (!isTpl) {
      kind = 'static';
    } else if (outputRel.endsWith('.json')) {
      kind = 'json';
    } else {
      kind = 'text';
    }

    files.push({ templateRel, outputRel, kind, included });
  }

  // Deterministic order.
  files.sort((a, b) => (a.outputRel < b.outputRel ? -1 : a.outputRel > b.outputRel ? 1 : 0));
  return { archetype, archRoot, files };
}

/**
 * Render a single planned file from its raw template bytes to its output bytes.
 * Returns { content, managedBlock } where managedBlock is the ledger descriptor
 * ("ack:managed" | "json:hooks,env" | "json:mcpServers" | null).
 * Applies path-hygiene assertion before returning.
 */
export function renderFile({ rawBytes, outputRel, kind, managed, ackInstallDir }) {
  let content;
  let managedBlock;

  if (kind === 'static') {
    // Byte-for-byte copy. No substitution scan.
    content = rawBytes;
    managedBlock = null;
  } else if (kind === 'json') {
    const text = rawBytes.toString('utf8');
    content = renderJson(text, managed);
    // JSON ownership descriptor by filename.
    const base = path.basename(outputRel);
    if (base === 'settings.json') managedBlock = 'json:hooks,env';
    else if (base === '.mcp.json') managedBlock = 'json:mcpServers';
    else managedBlock = null;
  } else {
    const text = rawBytes.toString('utf8');
    content = renderText(text, managed);
    // Text files that carry an ack:managed region are merge-owned; others whole.
    managedBlock = content.includes(TEXT_MANAGED_START) ? 'ack:managed' : null;
  }

  // §6 fail-closed hygiene assertion on rendered CONTENT.
  const contentStr = Buffer.isBuffer(content) ? content.toString('utf8') : content;
  assertPathHygiene(contentStr, outputRel, ackInstallDir);

  return { content, managedBlock };
}

/**
 * Full render to disk with idempotent re-run semantics.
 *
 * @param {object} opts
 * @param {object} [opts.manifest]      full manifest doc ({schema_version, managed, ...})
 * @param {object} [opts.managed]       managed subtree (if manifest not given)
 * @param {string} opts.archetypesDir   dir holding <archetype>/ + render.map.yaml
 * @param {string} opts.outDir          child output root
 * @param {object} [opts.renderMap]     pre-loaded map (else read from archetypesDir)
 * @param {string} [opts.ackInstallDir] absolute path forbidden in child content
 * @param {boolean}[opts.dryRun]        plan only, no writes
 * @returns {{ written: string[], skipped: string[], omitted: string[], ledger: Array, noop: boolean }}
 */
export function renderTree(opts) {
  const {
    manifest,
    archetypesDir,
    outDir,
    renderMap = { version: 1, rules: [] },
    ackInstallDir = DEFAULT_ACK_INSTALL_DIR,
    dryRun = false,
  } = opts;

  const managed = opts.managed ?? (manifest && manifest.managed);
  if (!managed) throw new RenderError('renderTree requires opts.managed or opts.manifest.managed');

  const plan = planTree({ managed, archetypesDir, renderMap });

  // No-op fast path: hash unchanged AND every prior rendered_files path present.
  const priorLedger = Array.isArray(managed.rendered_files) ? managed.rendered_files : [];
  const currentHash = computeManifestHash(managed);
  const hashMatches = managed.manifest_hash && managed.manifest_hash === currentHash;
  if (hashMatches && priorLedger.length > 0) {
    const allPresent = priorLedger.every((entry) => fs.existsSync(path.join(outDir, entry.path)));
    if (allPresent) {
      return { written: [], skipped: [], omitted: [], ledger: priorLedger, noop: true, hash: currentHash };
    }
  }

  const written = [];
  const skipped = [];
  const omitted = [];
  const ledger = [];

  // Build a set of paths the PRIOR ledger owned (for re-run merge decisions).
  const priorOwned = new Map(priorLedger.map((e) => [e.path, e.managed_block ?? null]));

  for (const f of plan.files) {
    if (!f.included) {
      omitted.push(f.outputRel);
      continue;
    }
    const rawBytes = fs.readFileSync(path.join(plan.archRoot, f.templateRel));
    const { content, managedBlock } = renderFile({
      rawBytes,
      outputRel: f.outputRel,
      kind: f.kind,
      managed,
      ackInstallDir,
    });

    const absOut = path.join(outDir, f.outputRel);

    // Determine final bytes considering managed-block merge on re-run.
    let finalBytes;
    const existsOnDisk = fs.existsSync(absOut);

    if (managedBlock === 'ack:managed' && existsOnDisk) {
      const existing = fs.readFileSync(absOut, 'utf8');
      finalBytes = mergeTextManaged(existing, content);
    } else if ((managedBlock === 'json:hooks,env' || managedBlock === 'json:mcpServers') && existsOnDisk) {
      const existing = JSON.parse(fs.readFileSync(absOut, 'utf8'));
      const renderedObj = JSON.parse(Buffer.isBuffer(content) ? content.toString('utf8') : content);
      const merged = mergeJsonManaged(managedBlock, renderedObj, existing, managed);
      finalBytes = JSON.stringify(sortKeysDeep(merged), null, 2) + '\n';
    } else {
      finalBytes = content;
    }

    // Re-assert hygiene on the FINAL bytes (merge could have re-introduced text).
    assertPathHygiene(
      Buffer.isBuffer(finalBytes) ? finalBytes.toString('utf8') : finalBytes,
      f.outputRel,
      ackInstallDir,
    );

    ledger.push({ path: f.outputRel, managed_block: managedBlock });

    if (!dryRun) {
      fs.mkdirSync(path.dirname(absOut), { recursive: true });
      if (Buffer.isBuffer(finalBytes)) {
        fs.writeFileSync(absOut, finalBytes);
      } else {
        fs.writeFileSync(absOut, finalBytes, 'utf8');
      }
    }
    written.push(f.outputRel);
  }

  // Note prior-owned paths now omitted (when flipped false): left in place.
  for (const [p] of priorOwned) {
    if (!ledger.find((e) => e.path === p) && !written.includes(p)) {
      // it was owned before but not rendered now; renderer leaves it on disk.
      // (recorded in `skipped` for the run report)
      skipped.push(p);
    }
  }

  return { written, skipped, omitted, ledger, noop: false, hash: currentHash };
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') out.manifest = argv[++i];
    else if (a === '--templates') out.templates = argv[++i];
    else if (a === '--out') out.out = argv[++i];
    else if (a === '--ack-install-dir') out.ackInstallDir = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '-h' || a === '--help') out.help = true;
    else out._.push(a);
  }
  return out;
}

const USAGE = `ai-core-kit render engine

Usage:
  node scripts/render.mjs --manifest <path> --templates <archetypes-dir> --out <dir> [--dry-run]

Options:
  --manifest <path>          FROZEN, schema-valid project.manifest.yaml
  --templates <dir>          dir containing <archetype>/ trees + render.map.yaml
  --out <dir>                child output root
  --ack-install-dir <dir>    absolute path forbidden in rendered child content
  --dry-run                  plan + render in memory; no writes
  -h, --help                 show this help

The renderer is a pure CONSUMER of managed: and a PRODUCER of child files +
the managed.rendered_files[] ledger. It assumes a schema-valid manifest
(validation happens upstream in /ack-init, invariant I6).`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }
  if (!args.manifest || !args.templates || !args.out) {
    process.stderr.write('error: --manifest, --templates and --out are all required\n\n' + USAGE + '\n');
    return 2;
  }

  const manifest = await loadManifest(args.manifest);
  const renderMap = await loadRenderMap(args.templates);

  const result = renderTree({
    manifest,
    archetypesDir: args.templates,
    outDir: args.out,
    renderMap,
    ackInstallDir: args.ackInstallDir,
    dryRun: Boolean(args.dryRun),
  });

  if (result.noop) {
    process.stdout.write('nothing to do (manifest_hash unchanged, ledger intact)\n');
    return 0;
  }

  process.stdout.write(
    `rendered ${result.written.length} file(s)` +
      (result.omitted.length ? `, omitted ${result.omitted.length}` : '') +
      (result.skipped.length ? `, left ${result.skipped.length} now-omitted file(s) in place` : '') +
      (args.dryRun ? ' (dry-run, no writes)' : '') +
      '\n',
  );
  for (const w of result.written) process.stdout.write(`  + ${w}\n`);

  // The renderer is the producer of the ledger; the CLI prints it for the
  // caller (/ack-init writes it back into the manifest — the renderer never
  // writes the manifest itself per §1).
  if (!args.dryRun) {
    process.stdout.write('\nrendered_files ledger (write back into manifest.managed.rendered_files):\n');
    process.stdout.write(JSON.stringify(result.ledger, null, 2) + '\n');
  }
  return 0;
}

// Run as CLI only when invoked directly (not when imported).
const isMain = (() => {
  try {
    return process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
  } catch {
    return false;
  }
})();

if (isMain) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      if (err instanceof RenderError) {
        process.stderr.write(`RenderError: ${err.message}\n`);
        if (err.path) process.stderr.write(`  at path: ${err.path}\n`);
      } else {
        process.stderr.write(`${err && err.stack ? err.stack : err}\n`);
      }
      process.exit(1);
    });
}
