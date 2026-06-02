#!/usr/bin/env node
// =============================================================================
// bin/create-ack.mjs
// -----------------------------------------------------------------------------
// create-ack — scaffold a NEW ai-core-kit CHILD project from the frozen archetype
// templates shipped inside this package. Zero kit fork, zero LLM in the loop.
//
//   create-ack <product-name> [options]
//
// Options:
//   --archetype <backend-api|fullstack|saas|monorepo|library-sdk|infra-iac>
//   --here                Scaffold into the current directory (else <product-name>/)
//   --yes                 Non-interactive: use questions.yaml defaults for everything
//   --lang <language>     Pre-set project.language (python|typescript|go|rust|java)
//   --framework <name>    Pre-set project.framework
//   -h, --help            Show usage
//   -v, --version         Show version
//
// Pipeline:
//   1. parse args            6. assemble + validate manifest (lib/manifest.mjs)
//   2. resolve kit root      7. write project.manifest.yaml into target
//   3. meta-guard target     8. render templates/archetypes/<archetype>/ -> target
//   4. resolve archetype        (delegated to scripts/render.mjs)
//   5. interview (or --yes)  9. copy templates/telemetry/* when telemetry.enabled
//                           10. render templates/docs-site/ -> <target>/docs/ (default-on)
//                           11. print next steps
//
// HARD INVARIANTS:
//   * Refuses to scaffold over the kit (templates/archetypes/ or docs/BOOTSTRAP.md
//     present in the target) or over a non-empty target that already owns a manifest.
//   * NEVER copies the META .claude/ tree or docs/BOOTSTRAP.md into a child.
//   * Reads templates FROM the kit package; writes to a SEPARATE target dir (I7).
// =============================================================================

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  copyFileSync,
} from "node:fs";
import { join, resolve, basename } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

import yaml from "js-yaml";

import {
  loadQuestionBank,
  loadSchema,
  verifyWritesTo,
  filterQuestions,
  buildManifest,
  kitRootFromHere,
} from "../lib/manifest.mjs";

const ARCHETYPES = [
  "backend-api",
  "fullstack",
  "saas",
  "monorepo",
  "library-sdk",
  "infra-iac",
];

// -----------------------------------------------------------------------------
// Tiny ANSI helpers (no dependency). Disabled when not a TTY / NO_COLOR set.
// -----------------------------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  bold: (s) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  green: (s) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  red: (s) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  cyan: (s) => (useColor ? `\x1b[36m${s}\x1b[0m` : s),
};

function fail(msg, code = 1) {
  process.stderr.write(c.red("create-ack: ") + msg + "\n");
  process.exit(code);
}

function usageError(msg) {
  process.stderr.write(c.red("create-ack: ") + msg + "\n\n");
  process.stderr.write(USAGE + "\n");
  process.exit(2);
}

const USAGE = `${c.bold("create-ack")} — scaffold a new ai-core-kit child project

${c.bold("Usage:")}
  create-ack <product-name> [options]

${c.bold("Options:")}
  --archetype <name>   backend-api | fullstack | saas | monorepo | library-sdk | infra-iac
  --here               Scaffold into the current directory (default: ./<product-name>/)
  --yes                Non-interactive; use questions.yaml defaults for everything
  --lang <language>    Pre-set project.language (python|typescript|go|rust|java)
  --framework <name>   Pre-set project.framework
  --no-docs            Skip the product-local Nextra docs scaffold (default: on)
  -h, --help           Show this help
  -v, --version        Show version

${c.bold("Examples:")}
  create-ack acme-orders-api --archetype backend-api --yes
  create-ack my-app --archetype fullstack --lang typescript --framework next
  create-ack lib-thing --archetype library-sdk --here`;

// -----------------------------------------------------------------------------
// Argument parsing — minimal, no dependency.
// -----------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    productName: undefined,
    archetype: undefined,
    here: false,
    yes: false,
    lang: undefined,
    framework: undefined,
    docs: true,
  };
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        process.stdout.write(USAGE + "\n");
        process.exit(0);
        break;
      case "-v":
      case "--version":
        process.stdout.write(readKitVersion() + "\n");
        process.exit(0);
        break;
      case "--here":
        opts.here = true;
        break;
      case "--no-docs":
        opts.docs = false;
        break;
      case "--docs":
        opts.docs = true;
        break;
      case "--yes":
      case "-y":
        opts.yes = true;
        break;
      case "--archetype":
        opts.archetype = requireValue(argv, ++i, "--archetype");
        break;
      case "--lang":
      case "--language":
        opts.lang = requireValue(argv, ++i, "--lang");
        break;
      case "--framework":
        opts.framework = requireValue(argv, ++i, "--framework");
        break;
      default:
        if (a.startsWith("--archetype=")) opts.archetype = a.slice("--archetype=".length);
        else if (a.startsWith("--lang=")) opts.lang = a.slice("--lang=".length);
        else if (a.startsWith("--language=")) opts.lang = a.slice("--language=".length);
        else if (a.startsWith("--framework=")) opts.framework = a.slice("--framework=".length);
        else if (a.startsWith("-")) usageError(`unknown option: ${a}`);
        else positionals.push(a);
    }
  }
  if (positionals.length > 1) {
    usageError(`unexpected extra arguments: ${positionals.slice(1).join(" ")}`);
  }
  opts.productName = positionals[0];
  return opts;
}

function requireValue(argv, i, flag) {
  const v = argv[i];
  if (v === undefined || v.startsWith("-")) usageError(`${flag} requires a value`);
  return v;
}

// -----------------------------------------------------------------------------
// Kit version — from the package.json at the kit root.
// -----------------------------------------------------------------------------
function readKitVersion() {
  try {
    const pkg = JSON.parse(readFileSync(join(kitRootFromHere(), "package.json"), "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// -----------------------------------------------------------------------------
// Meta-guard: refuse to scaffold over the kit itself, and refuse a non-empty
// target that already carries a manifest (fail-closed).
// -----------------------------------------------------------------------------
function assertSafeTarget(targetDir) {
  // (1) META-repo sentinels — refuse to run inside / over the kit (I7).
  const metaSentinels = [
    join(targetDir, "templates", "archetypes"),
    join(targetDir, "docs", "BOOTSTRAP.md"),
    join(targetDir, "bootstrap", "ack.bootstrap.yaml"),
  ];
  for (const s of metaSentinels) {
    if (existsSync(s)) {
      fail(
        "refuses to scaffold over the ai-core-kit META repository.\n" +
          `  Sentinel detected: ${s}\n` +
          "  Run create-ack from OUTSIDE the kit, targeting a fresh directory.",
      );
    }
  }
  // (2) Existing manifest — refuse to clobber an already-scaffolded child.
  const manifestPath = join(targetDir, "project.manifest.yaml");
  if (existsSync(manifestPath)) {
    fail(
      "target already contains project.manifest.yaml.\n" +
        `  ${manifestPath}\n` +
        "  create-ack scaffolds NEW projects; re-render an existing one with /ack-init.",
    );
  }
}

function dirIsEmptyish(dir) {
  if (!existsSync(dir)) return true;
  const entries = readdirSync(dir).filter((e) => e !== ".git" && e !== ".DS_Store");
  return entries.length === 0;
}

// -----------------------------------------------------------------------------
// Interactive prompts (Node readline). Only the few key answers are asked; every
// other manifest value comes from questions.yaml defaults via lib/manifest.mjs.
// -----------------------------------------------------------------------------
async function promptInteractive({ questions, presets }) {
  // Line-buffered reader. We collect `line` events into a queue and resolve each
  // ask() from the queue. On EOF (`close`), any line still buffered is delivered
  // first; only an ask() with NO remaining input rejects with ABORT. This avoids
  // the readline-with-piped-stdin race where `close` fires before the final
  // buffered line reaches a question callback.
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const queue = [];
  let waiter = null; // { res, rej } for an ask() awaiting a line
  let closed = false;

  rl.on("line", (line) => {
    if (waiter) {
      const w = waiter;
      waiter = null;
      w.res(line.trim());
    } else {
      queue.push(line);
    }
  });
  rl.on("close", () => {
    closed = true;
    if (waiter) {
      const w = waiter;
      waiter = null;
      const e = new Error("input stream closed before the interview completed");
      e.code = "ABORT";
      w.rej(e);
    }
  });

  const ask = (prompt) =>
    new Promise((res, rej) => {
      process.stdout.write(prompt);
      if (queue.length > 0) {
        res(String(queue.shift()).trim());
        return;
      }
      if (closed) {
        const e = new Error("input stream closed before the interview completed");
        e.code = "ABORT";
        rej(e);
        return;
      }
      waiter = { res, rej };
    });

  const answers = { ...presets };

  process.stdout.write(c.bold("\nai-core-kit — new project interview\n"));
  process.stdout.write(c.dim("Press Enter to accept the [default]. Ctrl-C to abort.\n\n"));

  try {
    // archetype (if not preset)
    if (!answers.archetype) {
      answers.archetype = await promptSelect(
        ask,
        getQuestion(questions, "archetype"),
      );
    }

    // re-filter the question bank for THIS archetype so we only prompt what fires.
    const fired = filterQuestions(questions, answers.archetype, answers);
    const firedIds = new Set(fired.map((q) => q.id));

    // project name
    if (!answers.project_name) {
      answers.project_name = await promptText(
        ask,
        getQuestion(questions, "project_name"),
        { required: true, validate: validateProjectName },
      );
    }

    // description (optional)
    if (answers.project_description === undefined) {
      answers.project_description = await promptText(
        ask,
        getQuestion(questions, "project_description"),
        {},
      );
    }

    // language
    if (!answers.language) {
      answers.language = await promptSelect(ask, getQuestion(questions, "language"));
    }

    // framework — archetype-scoped; only one of the two questions fires.
    if (answers.framework === undefined) {
      const fwId = firedIds.has("framework_backend")
        ? "framework_backend"
        : firedIds.has("framework_fullstack")
          ? "framework_fullstack"
          : null;
      if (fwId) {
        const v = await promptSelect(ask, getQuestion(questions, fwId));
        answers[fwId] = v;
      }
    } else {
      // --framework preset maps onto whichever framework question fires.
      if (firedIds.has("framework_backend")) answers.framework_backend = answers.framework;
      else if (firedIds.has("framework_fullstack")) answers.framework_fullstack = answers.framework;
    }

    // database — only if persistence question fires AND user enables persistence.
    if (firedIds.has("persistence_enabled")) {
      const pe = await promptBool(ask, getQuestion(questions, "persistence_enabled"));
      answers.persistence_enabled = pe;
      if (pe) {
        // re-filter so the DB question is now considered "fired"
        const sub = filterQuestions(questions, answers.archetype, answers);
        const subIds = new Set(sub.map((q) => q.id));
        if (subIds.has("persistence_db")) {
          answers.persistence_db = await promptSelect(
            ask,
            getQuestion(questions, "persistence_db"),
          );
        }
      }
    }
  } finally {
    rl.close();
  }

  return answers;
}

function getQuestion(questions, id) {
  const q = questions.find((x) => x.id === id);
  if (!q) throw new Error(`question '${id}' not found in bank`);
  return q;
}

async function promptText(ask, q, { required = false, validate } = {}) {
  const def = q.default === "" ? "" : q.default;
  const suffix = def ? ` ${c.dim(`[${def}]`)}` : required ? c.dim(" (required)") : "";
  for (;;) {
    const raw = await ask(`${q.prompt}${suffix}: `);
    const v = raw === "" ? def : raw;
    if (required && (v === undefined || v === "")) {
      process.stdout.write(c.yellow("  a value is required\n"));
      continue;
    }
    if (validate && v) {
      const err = validate(v);
      if (err) {
        process.stdout.write(c.yellow(`  ${err}\n`));
        continue;
      }
    }
    return v;
  }
}

async function promptSelect(ask, q) {
  const opts = q.options || [];
  process.stdout.write(`${q.prompt}\n`);
  opts.forEach((o, i) => {
    const label = o.label || o.value;
    const mark = o.value === q.default ? c.green(" (default)") : "";
    process.stdout.write(`  ${c.cyan(String(i + 1))}) ${label}${mark}\n`);
  });
  for (;;) {
    const raw = await ask(`Select 1-${opts.length} ${c.dim(`[${q.default}]`)}: `);
    if (raw === "") return q.default;
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= opts.length) return opts[n - 1].value;
    // also accept the literal value typed out
    const byValue = opts.find((o) => o.value === raw);
    if (byValue) return byValue.value;
    process.stdout.write(c.yellow("  invalid choice\n"));
  }
}

async function promptBool(ask, q) {
  const def = q.default === true;
  for (;;) {
    const raw = (await ask(`${q.prompt} ${c.dim(`[${def ? "Y/n" : "y/N"}]`)}: `)).toLowerCase();
    if (raw === "") return def;
    if (["y", "yes", "true"].includes(raw)) return true;
    if (["n", "no", "false"].includes(raw)) return false;
    process.stdout.write(c.yellow("  please answer y or n\n"));
  }
}

function validateProjectName(name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return "must be lowercase kebab-case, starting with a letter (^[a-z][a-z0-9-]*$)";
  }
  return null;
}

// -----------------------------------------------------------------------------
// Render delegation — import scripts/render.mjs (the kit's render engine) and call
// its renderTree(opts) entrypoint. The engine owns the template walk, conditional
// inclusion (path-segment guards + render.map.yaml), ${VAR} substitution, JSON
// canonicalization, managed-block merge, path-hygiene assertion, and returns the
// rendered_files[] LEDGER. We persist that ledger + the engine's hash back into the
// manifest (the renderer never writes the manifest itself).
//
// renderTree(opts) contract (scripts/render.mjs):
//   opts.manifest | opts.managed   the parsed manifest / managed subtree
//   opts.archetypesDir             dir containing <archetype>/ trees + render.map.yaml
//   opts.outDir                    child output root
//   opts.renderMap (optional)      pre-loaded render.map (else empty)
//   opts.dryRun (optional)
//   -> { written, skipped, omitted, ledger, noop, hash }
// -----------------------------------------------------------------------------
async function renderArchetypeTree({ kitRoot, targetDir, manifest, manifestPath }) {
  const renderPath = join(kitRoot, "scripts", "render.mjs");
  if (!existsSync(renderPath)) {
    fail(
      "render engine not found.\n" +
        `  Expected: ${renderPath}\n` +
        "  This package ships scripts/render.mjs; reinstall ai-core-kit.",
    );
  }

  let mod;
  try {
    mod = await import(pathToFileURL(renderPath).href);
  } catch (e) {
    fail(`failed to load render engine (${renderPath}):\n  ${e.message}`);
  }

  if (typeof mod.renderTree !== "function") {
    fail(
      "render engine exposes no renderTree(opts) entrypoint.\n" +
        `  Inspected: ${renderPath}`,
    );
  }

  const archetypesDir = join(kitRoot, "templates", "archetypes");

  // Minimal-core archetypes (monorepo|library-sdk|infra-iac) are schema-known but
  // ship NO deep template tree. When the tree is absent we produce a manifest-only
  // scaffold rather than crashing — the manifest + telemetry are still valid output.
  const archRoot = join(archetypesDir, manifest.managed.archetype);
  if (!existsSync(archRoot)) {
    return { written: [], omitted: [], skipped: [], ledger: [], noop: false, treeAbsent: true };
  }

  // Load render.map.yaml so the engine's glob guards (mcp/sdd_gate/design-system)
  // are evaluated. loadRenderMap is async and returns {version, rules}.
  let renderMap = { version: 1, rules: [] };
  if (typeof mod.loadRenderMap === "function") {
    try {
      renderMap = await mod.loadRenderMap(archetypesDir);
    } catch (e) {
      fail(`failed to load render.map.yaml:\n  ${e.message}`);
    }
  }

  let result;
  try {
    result = mod.renderTree({
      manifest,
      managed: manifest.managed,
      archetypesDir,
      outDir: targetDir,
      renderMap,
      dryRun: false,
    });
  } catch (e) {
    fail(`render failed:\n  ${e.stack || e.message}`);
  }

  // Persist the ownership ledger the engine produced back into the manifest, so a
  // later /ack-init re-run can do the no-op fast path + managed-block merges.
  if (result && Array.isArray(result.ledger)) {
    manifest.managed.rendered_files = result.ledger;
    writeManifest(manifestPath, manifest);
  }

  return result;
}

// -----------------------------------------------------------------------------
// Product-local docs scaffold — render templates/docs-site/ into <target>/docs/.
// This is a SEPARATE, lighter payload from the kit's own site/ (which is NEVER
// copied). We reuse the SAME render engine (scripts/render.mjs): each file goes
// through renderFile() so `${project.name}`/`${project.description}`/`${archetype}`
// are substituted, `.tpl` is stripped, and §6 path-hygiene is asserted. We render
// against the REAL `managed` subtree so `${archetype}` resolves to the project's
// actual archetype (not a synthetic tree-selector). Default-on; --no-docs skips.
//
// Hard rules honored here:
//   * NEVER copy node_modules/.next/.vercel (build artifacts) from the kit.
//   * NEVER read the kit's own site/; only templates/docs-site/.
//   * The meta-guard already ran on <target>; docs/ is a child of that safe dir.
// -----------------------------------------------------------------------------
const DOCS_SKIP_DIRS = new Set(["node_modules", ".next", ".vercel", "out"]);

function walkDocsTemplates(root, rel = "") {
  const out = [];
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (DOCS_SKIP_DIRS.has(entry.name)) continue;
    const childRel = rel ? join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkDocsTemplates(root, childRel));
    } else if (entry.isFile()) {
      out.push(childRel);
    }
  }
  return out;
}

async function renderDocsSite({ kitRoot, targetDir, manifest, mod }) {
  const docsTemplatesDir = join(kitRoot, "templates", "docs-site");
  if (!existsSync(docsTemplatesDir)) {
    // Graceful no-op when the kit ships without the docs-site payload.
    return { written: [], ledger: [], noop: true };
  }

  // Reuse the already-loaded render module (renderFile is the documented
  // single-file entrypoint: directives + ${VAR} + .tpl strip + hygiene).
  if (!mod || typeof mod.renderFile !== "function") {
    const renderPath = join(kitRoot, "scripts", "render.mjs");
    try {
      mod = await import(pathToFileURL(renderPath).href);
    } catch (e) {
      fail(`failed to load render engine for docs scaffold:\n  ${e.message}`);
    }
  }
  if (typeof mod.renderFile !== "function") {
    fail("render engine exposes no renderFile() entrypoint for the docs scaffold.");
  }

  const managed = manifest.managed;
  const docsOutDir = join(targetDir, "docs");
  const written = [];
  const ledger = [];

  for (const templateRel of walkDocsTemplates(docsTemplatesDir)) {
    const isTpl = templateRel.endsWith(".tpl");
    const outputRel = isTpl ? templateRel.slice(0, -".tpl".length) : templateRel;
    let kind;
    if (!isTpl) kind = "static";
    else if (outputRel.endsWith(".json")) kind = "json";
    else kind = "text";

    const rawBytes = readFileSync(join(docsTemplatesDir, templateRel));
    let content;
    try {
      ({ content } = mod.renderFile({ rawBytes, outputRel, kind, managed }));
    } catch (e) {
      fail(`docs scaffold render failed for ${outputRel}:\n  ${e.stack || e.message}`);
    }

    const absOut = join(docsOutDir, outputRel);
    mkdirSync(join(absOut, ".."), { recursive: true });
    if (Buffer.isBuffer(content)) writeFileSync(absOut, content);
    else writeFileSync(absOut, content, "utf8");

    const relFromTarget = join("docs", outputRel);
    written.push(relFromTarget);
    ledger.push({ path: relFromTarget, managed_block: null });
  }

  return { written, ledger, noop: false };
}

// -----------------------------------------------------------------------------
// MOMENT-0 SPEC SCAFFOLD — lay the NARRATIVE spec SKELETONS the model later fills.
//
// The kit's thesis: at moment-0 the highest-leverage output is CONTEXT (Markdown
// specs + the best CLAUDE.md), NOT generated code. So create-ack lays well-formed
// SKELETONS here and tells the user to run `/ack-spec` (model-driven) to author the
// filled prose. We render two payloads with the SAME engine used elsewhere:
//
//   1. templates/specs/**         -> <target>/specs/**   (PRD/ARCHITECTURE/DOMAIN/
//                                     REQUIREMENTS/ROADMAP/NON-GOALS + adr/)
//   2. templates/CLAUDE.child.md.tmpl -> <target>/CLAUDE.md  (the lean pointer)
//
// Each file goes through renderFile() so `${project.*}`/`${archetype}`/gate vars are
// substituted, `#ack:if/#ack:each` directives expand, `.tpl` is stripped, and §6
// path-hygiene is asserted. The spec/CLAUDE templates reference ${project.framework}
// and ${project.architecture}, which the manifest only carries for the DEEP
// archetypes (backend-api, fullstack) — minimal-core never answers those questions.
// To avoid an unbound-var RenderError, we lay these payloads ONLY when both vars are
// bound; minimal-core scaffolds skip them (the printed note tells the user that
// `/ack-spec` will author the specs + CLAUDE.md from scratch in the child).
//
// Hard rules honored: never read templates/archetypes/ here; render into the
// already-meta-guarded <target>; never emit raw `.tpl` files.
// -----------------------------------------------------------------------------
const SPECS_SKIP_DIRS = new Set(["node_modules", "__pycache__"]);

function walkSpecTemplates(root, rel = "") {
  const out = [];
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    if (SPECS_SKIP_DIRS.has(entry.name)) continue;
    const childRel = rel ? join(rel, entry.name) : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkSpecTemplates(root, childRel));
    } else if (entry.isFile()) {
      out.push(childRel);
    }
  }
  return out;
}

// The spec/CLAUDE templates are authored for the DEEP archetypes; they reference
// project.framework/architecture which minimal-core never has. Gate on both.
function specVarsBound(managed) {
  const p = managed && managed.project;
  return Boolean(p && p.framework !== undefined && p.architecture !== undefined);
}

async function loadRenderModule(kitRoot, mod, ctxLabel) {
  if (mod && typeof mod.renderFile === "function") return mod;
  const renderPath = join(kitRoot, "scripts", "render.mjs");
  try {
    const loaded = await import(pathToFileURL(renderPath).href);
    if (typeof loaded.renderFile !== "function") {
      fail(`render engine exposes no renderFile() entrypoint for ${ctxLabel}.`);
    }
    return loaded;
  } catch (e) {
    fail(`failed to load render engine for ${ctxLabel}:\n  ${e.message}`);
  }
}

// Render templates/specs/** into <target>/specs/**. Returns { written[], ledger[],
// noop } with paths relative to the target. SKELETON files are wholly ack-laid here
// (the model OWNS them after /ack-spec), so each ledger entry is managed_block:null
// — /ack-init does not re-render specs (they are the human/model's narrative).
async function renderSpecsScaffold({ kitRoot, targetDir, manifest, mod }) {
  const specsTemplatesDir = join(kitRoot, "templates", "specs");
  if (!existsSync(specsTemplatesDir)) {
    return { written: [], ledger: [], noop: true, skippedReason: "no templates/specs/ payload" };
  }
  const managed = manifest.managed;
  if (!specVarsBound(managed)) {
    return { written: [], ledger: [], noop: true, skippedReason: "minimal-core (run /ack-spec)" };
  }

  mod = await loadRenderModule(kitRoot, mod, "the spec scaffold");

  const specsOutDir = join(targetDir, "specs");
  const written = [];
  const ledger = [];

  for (const templateRel of walkSpecTemplates(specsTemplatesDir)) {
    const isTpl = templateRel.endsWith(".tpl");
    const outputRel = isTpl ? templateRel.slice(0, -".tpl".length) : templateRel;
    let kind;
    if (!isTpl) kind = "static";
    else if (outputRel.endsWith(".json")) kind = "json";
    else kind = "text";

    const rawBytes = readFileSync(join(specsTemplatesDir, templateRel));
    let content;
    try {
      ({ content } = mod.renderFile({ rawBytes, outputRel, kind, managed }));
    } catch (e) {
      fail(`spec scaffold render failed for ${outputRel}:\n  ${e.stack || e.message}`);
    }

    const absOut = join(specsOutDir, outputRel);
    mkdirSync(join(absOut, ".."), { recursive: true });
    if (Buffer.isBuffer(content)) writeFileSync(absOut, content);
    else writeFileSync(absOut, content, "utf8");

    const relFromTarget = join("specs", outputRel);
    written.push(relFromTarget);
    ledger.push({ path: relFromTarget, managed_block: null });
  }

  return { written, ledger, noop: false };
}

// Render the starter child CLAUDE.md from templates/CLAUDE.child.md.tmpl. This is
// the "best CLAUDE.md" the kit can lay at moment-0: a lean, spec-first pointer to
// specs/ + contracts + conventions, with a kit-shaped pointer body and a
// human-owned "House notes" tail. It SUPERSEDES the older per-archetype
// CLAUDE.md.tpl stub: the archetype tree renders first and may lay a minimal
// CLAUDE.md; in a FRESH create-ack scaffold that file is itself ack-laid this same
// run, so we overwrite it with the richer spec-first template. We never run over a
// populated/human repo (the meta-guard + empty-target check upstream guarantee a
// fresh target), so there is no human CLAUDE.md to clobber here. The ledger's
// managed_block is whatever renderFile derives from the template (the spec-first
// child template carries no ack:managed markers today => null; /ack-spec is the
// model-driven refresher of this file thereafter).
async function renderStarterClaude({ kitRoot, targetDir, manifest, mod }) {
  const tmplPath = join(kitRoot, "templates", "CLAUDE.child.md.tmpl");
  if (!existsSync(tmplPath)) {
    return { written: null, ledger: [], noop: true, skippedReason: "no CLAUDE.child.md.tmpl" };
  }
  const managed = manifest.managed;
  if (!specVarsBound(managed)) {
    return { written: null, ledger: [], noop: true, skippedReason: "minimal-core (run /ack-spec)" };
  }

  const claudeOut = join(targetDir, "CLAUDE.md");

  mod = await loadRenderModule(kitRoot, mod, "the starter CLAUDE.md");

  const rawBytes = readFileSync(tmplPath);
  let content;
  let managedBlock;
  try {
    ({ content, managedBlock } = mod.renderFile({
      rawBytes,
      outputRel: "CLAUDE.md",
      kind: "text",
      managed,
    }));
  } catch (e) {
    fail(`starter CLAUDE.md render failed:\n  ${e.stack || e.message}`);
  }
  if (Buffer.isBuffer(content)) writeFileSync(claudeOut, content);
  else writeFileSync(claudeOut, content, "utf8");

  // Record the ACTUAL ownership descriptor renderFile derived from the content
  // (the engine returns "ack:managed" iff the rendered body carries the managed
  // markers, else null). Hardcoding it would desync the ledger from what /ack-init
  // re-computes; we mirror the engine so re-render merge/own decisions stay correct.
  return {
    written: "CLAUDE.md",
    ledger: [{ path: "CLAUDE.md", managed_block: managedBlock ?? null }],
    noop: false,
  };
}

// -----------------------------------------------------------------------------
// SPEC-STATUS MARKER — the spec-first contract made visible in the child.
//
// create-ack is zero-LLM: it renders the full structural scaffold + spec
// SKELETONS, but it CANNOT author the prose or confirm the brand color (that is
// the /ack-spec LLM island). So it lays a small, deterministic marker file that
// states, in the child itself, that the specs are DRAFT skeletons pending the
// /ack-spec authoring pass, and that the design system currently shows the
// DEFAULT brand until /ack-spec confirms one (and a finalize re-render
// materializes it). The marker is the in-repo banner the printed "Next steps"
// echo points at; it survives `cd`-ing into the project and re-finding context.
//
// It is written ONLY when spec skeletons were actually laid (deep archetypes);
// minimal-core scaffolds skip it (the printed note already tells the user that
// /ack-spec authors the specs from scratch). The marker is human/model territory
// after /ack-spec runs — it is NOT recorded in the managed ledger and /ack-init
// never re-renders it.
// -----------------------------------------------------------------------------
function writeSpecStatusMarker({ targetDir, manifest }) {
  const m = manifest.managed || {};
  const archetype = m.archetype || "?";
  const designBearing = Boolean(m.design_system && m.design_system.install);
  const brand =
    (m.design_system &&
      m.design_system.tokens &&
      m.design_system.tokens.color_brand) ||
    null;

  const lines = [
    "# Specs: DRAFT — run `/ack-spec`",
    "",
    "> This file is a deterministic marker laid by `create-ack`. It is safe to",
    "> delete once the specs are authored; `/ack-init` never re-renders it.",
    "",
    "The structural scaffold for this **" + archetype + "** project is rendered, but",
    "the specs under `specs/` are **SKELETONS** — each section still holds only its",
    "inline author prompt. They are NOT yet the project's source of intent.",
    "",
    "## Required next step",
    "",
    "Open this project in Claude Code and run **`/ack-spec`**. It runs the deep,",
    "narrative discovery interview and authors the complete intent set BEFORE any",
    "code is written:",
    "",
    "- `specs/PRD.md`, `specs/ARCHITECTURE.md`, `specs/DOMAIN.md`,",
    "  `specs/REQUIREMENTS.md`, `specs/PLAN.md`, `specs/ROADMAP.md`,",
    "  `specs/NON-GOALS.md`" +
      (designBearing ? " + `specs/DESIGN.md`" : "") +
      " — filled prose, not skeletons.",
    "- a refreshed, lean spec-first `CLAUDE.md`.",
    "- a draft first contract `docs/contracts/C-001-*.contract.md` (left `status: draft`).",
    "",
    "**Specs lead; code follows.** Do not start writing application code until the",
    "specs are authored and the first contract is reviewed.",
    "",
  ];

  if (designBearing) {
    lines.push(
      "## Design system: DEFAULT brand until confirmed",
      "",
      "A design system is installed and currently materialized from the **default**",
      "brand color `" + (brand || "#0066CC") + "` " +
        "(`design_system.tokens.color_brand`). During `/ack-spec` you confirm THIS",
      "product's brand color; that single value is the one design input that crosses",
      "into the deterministic scaffold. After you confirm it, **finalize** by",
      "re-running `/ack-init` (or `create-ack --here` on a fresh tree) — the renderer",
      "re-materializes `design-system/theme/` (`globals.css`, `theme.tokens.json`)",
      "from the confirmed token, idempotently and byte-deterministically.",
      "",
    );
  }

  lines.push(
    "## The ordered bootstrap flow",
    "",
    "1. **interview + scaffold** — `create-ack` (done): manifest + structural",
    "   scaffold + spec SKELETONS + this marker.",
    "2. **author** — `/ack-spec`: the narrative interview authors the filled specs +",
    "   PLAN + best `CLAUDE.md`" +
      (designBearing ? " and confirms the brand color." : "."),
    "3. **finalize** — re-run `/ack-init`: re-render the manifest-derived scaffold" +
      (designBearing ? " with the confirmed design tokens." : "."),
    "",
  );

  const specsDir = join(targetDir, "specs");
  mkdirSync(specsDir, { recursive: true });
  const markerPath = join(specsDir, ".spec-status.md");
  writeFileSync(markerPath, lines.join("\n") + "\n", "utf8");
  return join("specs", ".spec-status.md");
}

// -----------------------------------------------------------------------------
// Telemetry payload copy — when telemetry.enabled, drop the offline aggregator +
// pricing map into the child's telemetry/ dir. Only ships concrete payload files
// (aggregate.py, pricing.json); the README.md.tpl is left to the render engine if
// it chooses to render it (we skip .tpl here to avoid emitting raw templates).
// -----------------------------------------------------------------------------
function copyTelemetry({ kitRoot, targetDir }) {
  const src = join(kitRoot, "templates", "telemetry");
  if (!existsSync(src)) return [];
  const dst = join(targetDir, "telemetry");
  const copied = [];
  for (const entry of readdirSync(src)) {
    if (entry === "__pycache__" || entry.endsWith(".tpl")) continue;
    const sp = join(src, entry);
    if (!statSync(sp).isFile()) continue;
    mkdirSync(dst, { recursive: true });
    const dp = join(dst, entry);
    copyFileSync(sp, dp);
    copied.push(join("telemetry", entry));
  }
  return copied;
}

// -----------------------------------------------------------------------------
// project.manifest.yaml writer — schema_version, generator (provenance, leading
// comment), managed (machine-owned), user (human-owned).
// -----------------------------------------------------------------------------
function writeManifest(manifestPath, manifest) {
  const banner =
    "# project.manifest.yaml — generated by create-ack (ai-core-kit).\n" +
    "# `managed:` is MACHINE-OWNED: /ack-init rewrites it wholesale. Edit `user:` only.\n" +
    "# Schema: templates/manifest/project.manifest.schema.json (schema_version 3).\n";
  const body = yaml.dump(manifest, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
    sortKeys: false,
  });
  writeFileSync(manifestPath, banner + body, "utf8");
}

// -----------------------------------------------------------------------------
// main
// -----------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const kitRoot = kitRootFromHere();
  const toolVersion = readKitVersion();

  // Load frozen inputs + author-time integrity check (I1).
  let questionBank, schema;
  try {
    questionBank = loadQuestionBank(kitRoot);
    schema = loadSchema(kitRoot);
  } catch (e) {
    fail(`failed to load frozen kit inputs:\n  ${e.message}`);
  }
  const questions = questionBank.questions;
  try {
    verifyWritesTo(questions, schema);
  } catch (e) {
    fail(e.message);
  }

  // Validate archetype preset, if any.
  if (opts.archetype && !ARCHETYPES.includes(opts.archetype)) {
    usageError(
      `invalid --archetype '${opts.archetype}'. One of: ${ARCHETYPES.join(", ")}`,
    );
  }

  // Resolve product name + target dir.
  if (!opts.productName && opts.here) {
    opts.productName = basename(resolve(process.cwd()));
  }
  if (!opts.productName && opts.yes) {
    usageError("a <product-name> is required (or run interactively without --yes)");
  }
  // When neither a product name nor --here is given, the interactive path collects
  // the name and the target dir is derived from it after the interview.

  // Build presets that map CLI flags onto question ids.
  const presets = {};
  if (opts.archetype) presets.archetype = opts.archetype;
  if (opts.productName) presets.project_name = opts.productName;
  if (opts.lang) presets.language = opts.lang;
  if (opts.framework) presets.framework = opts.framework;

  // Collect answers.
  let answers;
  if (opts.yes) {
    // Non-interactive: presets + questions.yaml defaults (resolved in lib/manifest).
    answers = { ...presets };
    if (!answers.archetype) {
      answers.archetype = getQuestion(questions, "archetype").default;
    }
    // Map --framework preset onto the firing framework question id.
    if (opts.framework) {
      const fired = new Set(
        filterQuestions(questions, answers.archetype, answers).map((q) => q.id),
      );
      if (fired.has("framework_backend")) answers.framework_backend = opts.framework;
      else if (fired.has("framework_fullstack")) answers.framework_fullstack = opts.framework;
    }
  } else {
    try {
      answers = await promptInteractive({ questions, presets });
    } catch (e) {
      if (e && e.code === "ABORT") fail("aborted.", 130);
      throw e;
    }
  }

  // Validate / finalize project name.
  const productName = answers.project_name;
  if (!productName) usageError("a project name is required");
  const nameErr = validateProjectName(productName);
  if (nameErr) usageError(`invalid project name '${productName}': ${nameErr}`);

  // Resolve target directory.
  const targetDir = opts.here
    ? resolve(process.cwd())
    : resolve(process.cwd(), productName);

  // Safety: if creating a NEW subdir, it must not already be a populated project.
  if (!opts.here && existsSync(targetDir) && !dirIsEmptyish(targetDir)) {
    fail(
      `target directory is not empty: ${targetDir}\n` +
        "  Choose a fresh directory or use --here in an empty/clean one.",
    );
  }
  if (opts.here && !dirIsEmptyish(targetDir)) {
    process.stderr.write(
      c.yellow(
        `create-ack: warning — scaffolding into a non-empty directory (${targetDir}).\n`,
      ),
    );
  }

  mkdirSync(targetDir, { recursive: true });

  // Meta-guard (fail-closed) AFTER the dir exists — covers --here over the kit.
  assertSafeTarget(targetDir);

  // Assemble + validate the manifest (lib/manifest.mjs owns I1/I4/I6 + hash).
  let manifest;
  try {
    manifest = buildManifest(answers, { questions, schema, toolVersion });
  } catch (e) {
    fail(e.message);
  }

  // Write the manifest BEFORE rendering so the engine can read/update it in place.
  const manifestPath = join(targetDir, "project.manifest.yaml");
  writeManifest(manifestPath, manifest);

  // Render the archetype template tree into the target (delegated engine).
  const renderResult = await renderArchetypeTree({
    kitRoot,
    targetDir,
    manifest,
    manifestPath,
  });

  // Re-read the manifest in case the renderer rewrote rendered_files[] / hash.
  let finalManifest = manifest;
  try {
    finalManifest = yaml.load(readFileSync(manifestPath, "utf8")) || manifest;
  } catch {
    /* keep in-memory manifest on parse failure */
  }

  // Copy telemetry payload when enabled.
  let telemetryCopied = [];
  if (finalManifest?.managed?.telemetry?.enabled) {
    telemetryCopied = copyTelemetry({ kitRoot, targetDir });
  }

  // MOMENT-0 SPEC SCAFFOLD: lay the narrative spec SKELETONS + the lean spec-first
  // CLAUDE.md (CONTEXT, not code). Deep archetypes only (minimal-core skips; the
  // printed note tells the user `/ack-spec` will author them in the child). Reuses
  // the SAME render engine. The starter CLAUDE.md SUPERSEDES the archetype stub.
  const specsResult = await renderSpecsScaffold({
    kitRoot,
    targetDir,
    manifest: finalManifest,
  });
  const claudeResult = await renderStarterClaude({
    kitRoot,
    targetDir,
    manifest: finalManifest,
  });

  // SPEC-STATUS MARKER: lay the in-repo "Specs: DRAFT — run /ack-spec" banner
  // whenever spec skeletons were actually written (deep archetypes). It makes the
  // spec-first contract visible inside the child and is the anchor the printed
  // headline next-step points at. Minimal-core scaffolds (no skeletons) skip it.
  let specStatusMarker = null;
  if (specsResult && !specsResult.noop && Array.isArray(specsResult.written) && specsResult.written.length) {
    specStatusMarker = writeSpecStatusMarker({ targetDir, manifest: finalManifest });
  }

  // Record the spec/CLAUDE files in the manifest ledger so /ack-init re-runs see
  // them. CLAUDE.md may already be in the ledger from the archetype tree; keep one
  // entry, preferring the ack:managed ownership (the starter overwrote the stub).
  const specLedger = [
    ...(specsResult && Array.isArray(specsResult.ledger) ? specsResult.ledger : []),
    ...(claudeResult && Array.isArray(claudeResult.ledger) ? claudeResult.ledger : []),
  ];
  if (specLedger.length) {
    if (!Array.isArray(finalManifest.managed.rendered_files)) {
      finalManifest.managed.rendered_files = [];
    }
    const byPath = new Map(
      finalManifest.managed.rendered_files.map((e) => [e.path, e]),
    );
    for (const entry of specLedger) byPath.set(entry.path, entry);
    finalManifest.managed.rendered_files = Array.from(byPath.values());
    writeManifest(manifestPath, finalManifest);
  }

  // Render the product-local docs scaffold (default-on; --no-docs skips). Uses the
  // SAME render engine as the archetype tree; renders into <target>/docs/.
  let docsResult = { written: [], ledger: [], noop: true };
  if (opts.docs) {
    docsResult = await renderDocsSite({
      kitRoot,
      targetDir,
      manifest: finalManifest,
    });
    // Record the docs files in the manifest ledger so /ack-init re-runs see them.
    if (docsResult && Array.isArray(docsResult.ledger) && docsResult.ledger.length) {
      if (!Array.isArray(finalManifest.managed.rendered_files)) {
        finalManifest.managed.rendered_files = [];
      }
      const known = new Set(finalManifest.managed.rendered_files.map((e) => e.path));
      for (const entry of docsResult.ledger) {
        if (!known.has(entry.path)) finalManifest.managed.rendered_files.push(entry);
      }
      writeManifest(manifestPath, finalManifest);
    }
  }

  printNextSteps({
    targetDir,
    manifest: finalManifest,
    here: opts.here,
    telemetryCopied,
    treeAbsent: Boolean(renderResult && renderResult.treeAbsent),
    docsWritten: docsResult && Array.isArray(docsResult.written) ? docsResult.written.length : 0,
    docsSkipped: !opts.docs,
    specsWritten: specsResult && Array.isArray(specsResult.written) ? specsResult.written.length : 0,
    specsSkippedReason:
      specsResult && specsResult.noop ? specsResult.skippedReason || null : null,
    claudeWritten: Boolean(claudeResult && claudeResult.written),
    specStatusMarker,
  });
}

// -----------------------------------------------------------------------------
// Next-steps summary.
// -----------------------------------------------------------------------------
function printNextSteps({
  targetDir,
  manifest,
  here,
  telemetryCopied,
  treeAbsent,
  docsWritten = 0,
  docsSkipped = false,
  specsWritten = 0,
  specsSkippedReason = null,
  claudeWritten = false,
  specStatusMarker = null,
}) {
  const m = manifest.managed || {};
  const rel = here ? "." : basename(targetDir);
  // rendered_files now also carries the docs/ + specs/ + CLAUDE.md ledgers; subtract
  // them for the archetype-tree "files written" count so lines don't double-report.
  const ledger = Array.isArray(m.rendered_files) ? m.rendered_files : [];
  const renderedCount = ledger.filter(
    (e) =>
      e.path &&
      !e.path.startsWith("docs/") &&
      !e.path.startsWith("specs/") &&
      e.path !== "CLAUDE.md",
  ).length;

  const out = process.stdout;
  out.write("\n" + c.green("✓ ") + c.bold(`scaffolded ${m.project?.name || rel}`) + "\n");
  out.write(c.dim("  ─────────────────────────────────────────\n"));
  out.write(`  archetype     ${c.cyan(m.archetype || "?")}\n`);
  out.write(
    `  language      ${m.project?.language || "?"}` +
      (m.project?.framework ? ` / ${m.project.framework}` : "") +
      "\n",
  );
  out.write(`  contract gate ${m.contract_gate?.mode || "?"}\n`);
  if (renderedCount) out.write(`  files written ${renderedCount}\n`);
  if (specsWritten)
    out.write(`  specs         ${specsWritten} DRAFT skeleton(s) -> specs/  (author via /ack-spec)\n`);
  else if (specsSkippedReason)
    out.write(`  specs         skipped (${specsSkippedReason})\n`);
  if (specStatusMarker) out.write(`  status        ${specStatusMarker}  (the spec-first banner)\n`);
  if (claudeWritten) out.write(`  CLAUDE.md     spec-first pointer written\n`);
  if (telemetryCopied.length) out.write(`  telemetry     ${telemetryCopied.length} file(s)\n`);
  if (docsWritten) out.write(`  docs scaffolded: ${docsWritten} files -> docs/\n`);
  else if (docsSkipped) out.write(`  docs          skipped (--no-docs)\n`);
  out.write(c.dim("  ─────────────────────────────────────────\n"));

  if (treeAbsent) {
    out.write(
      "\n" +
        c.yellow(
          `note: '${m.archetype}' is a minimal-core archetype with no deep template tree.\n` +
            "      A valid project.manifest.yaml was written; populate the scaffold yourself.\n",
        ),
    );
  }

  // THE HEADLINE: spec-first is the default. create-ack rendered the structural
  // scaffold + DRAFT spec skeletons; the REQUIRED next step is to AUTHOR the
  // complete specs + PLAN + best CLAUDE.md + clear design/requirements via
  // /ack-spec, BEFORE any code is written. This is framed as a required step,
  // not a footnote.
  const designBearing = Boolean(m.design_system && m.design_system.install);
  out.write("\n" + c.bold("REQUIRED NEXT STEP — author your specs first:\n"));
  if (!here) out.write(c.dim("  $ ") + `cd ${rel}\n`);
  out.write(
    "  " +
      c.bold("Open the project in Claude Code and run ") +
      c.cyan(c.bold("/ack-spec")) +
      c.bold(".\n"),
  );
  out.write(
    c.dim(
      "  It runs the deep narrative interview and AUTHORS the complete intent set\n" +
        "  BEFORE you write any code: the filled PRD / ARCHITECTURE / DOMAIN /\n" +
        "  REQUIREMENTS / PLAN / ROADMAP / NON-GOALS" +
        (designBearing ? " / DESIGN" : "") +
        " specs, a refreshed best-in-class\n" +
        "  CLAUDE.md, and a draft first contract. " +
        c.bold("Specs lead; code follows.\n"),
    ),
  );
  if (specsWritten || claudeWritten) {
    out.write(
      c.dim(
        "  The specs/ above are DRAFT skeletons (inline author prompts only) — see\n" +
          "  specs/.spec-status.md. They are NOT yet your source of intent.\n",
      ),
    );
  } else if (treeAbsent || specsSkippedReason) {
    out.write(
      c.dim(
        "  No skeletons were laid for this minimal-core archetype; /ack-spec authors\n" +
          "  the specs/ + CLAUDE.md from scratch.\n",
      ),
    );
  }
  if (designBearing) {
    out.write(
      c.dim(
        "  Design system: installed and showing the DEFAULT brand " +
          ((m.design_system.tokens && m.design_system.tokens.color_brand) || "#0066CC") +
          ".\n" +
          "  /ack-spec confirms THIS product's brand color (the one design value that\n" +
          "  crosses into the deterministic scaffold).\n",
      ),
    );
  }

  // The ordered three-stage flow, made explicit. The finalize re-render is the
  // deterministic close of the loop after /ack-spec confirms intent + brand.
  out.write("\n" + c.bold("Then, in order:\n"));
  out.write(
    c.dim("  1. ") +
      c.cyan("/ack-spec") +
      "   author the filled specs + PLAN + best CLAUDE.md" +
      (designBearing ? " and confirm the brand color\n" : "\n"),
  );
  out.write(
    c.dim("  2. ") +
      "review specs + get docs/contracts/C-001-*.contract.md approved (status: draft -> approved)\n",
  );
  out.write(
    c.dim("  3. ") +
      c.cyan("/ack-init") +
      "   FINALIZE: re-render the manifest-derived scaffold" +
      (designBearing
        ? " (re-materializes design-system/theme/ from the confirmed token, idempotently)\n"
        : " after any stack edits (idempotent)\n"),
  );
  if (m.features?.sdd_gate && !treeAbsent) {
    out.write(
      c.dim(
        "  The contract gate is wired in .claude/settings.json — it permits edits under\n" +
          "  the protected paths only once C-001 is approved.\n",
      ),
    );
  }
  if (docsWritten) {
    const docsPath = here ? "docs" : `${rel}/docs`;
    out.write(c.dim(`  Product docs site: cd ${docsPath} && npm install && npm run dev\n`));
  }
  out.write("\n");
}

main().catch((e) => {
  fail(e?.stack || String(e));
});
