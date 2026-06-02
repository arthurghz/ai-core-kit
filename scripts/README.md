# scripts/render.mjs — the ai-core-kit P4 render engine

`render.mjs` is the deterministic `${VAR}`-substitution + manifest-driven
conditional-inclusion renderer that turns a **FROZEN, schema-valid**
`project.manifest.yaml` plus a `templates/archetypes/<archetype>/` tree into a
working child project. It is the sole producer of child files and the
`managed.rendered_files[]` ownership ledger.

It implements **`docs/RENDER-ENGINE.md` exactly**. It is both an importable ES
module (consumed by `create-ack` / `/ack-init`) and a standalone CLI.

---

## Run as a CLI

```bash
node scripts/render.mjs --manifest <path> --templates <archetypes-dir> --out <dir> [--dry-run]
```

| Flag | Meaning |
|---|---|
| `--manifest <path>` | FROZEN, schema-valid `project.manifest.yaml` (read-only input) |
| `--templates <dir>` | dir containing the `<archetype>/` trees **and** `render.map.yaml` |
| `--out <dir>` | child output root |
| `--ack-install-dir <dir>` | absolute path forbidden in rendered child content (defaults to the kit root, two levels up from this file) |
| `--dry-run` | plan + render in memory; **no writes** |
| `-h`, `--help` | usage |

Exit codes: `0` success (incl. no-op re-run), `1` render error (fail-closed),
`2` usage error.

The CLI **prints** the `rendered_files[]` ledger but does **not** write the
manifest — `/ack-init` is the only writer of `managed:` (RENDER-ENGINE.md §1), so
it writes the printed ledger back into `manifest.managed.rendered_files`.

> `js-yaml` is imported **lazily**, only to read/write YAML *files* (the CLI path
> and `loadManifest`). When `create-ack` already has a parsed `managed` object it
> can call `renderTree({ managed, ... })` and never touch `js-yaml` through this
> module. `ajv` is **not** used here: the renderer assumes a schema-valid
> manifest (validation happens upstream — invariant I6).

## Run the tests

```bash
node --test scripts/render.test.mjs
```

The suite builds hermetic template fixtures in `os.tmpdir()` (never inside the
repo) and covers every invariant below.

---

## Import as a module

```js
import {
  render,            // (text, managed)            §2 scalar substitution
  renderText,        // (text, managed)            §3 directives + §2 substitution
  renderJson,        // (text, managed)            §2.3 substitute -> parse -> sorted/2-space JSON
  expandDirectives,  // (text, managed)            §3 #ack:each / #ack:if
  planTree,          // ({managed, archetypesDir, renderMap}) -> {archetype, archRoot, files[]}
  renderFile,        // ({rawBytes, outputRel, kind, managed, ackInstallDir})
  renderTree,        // ({manifest|managed, archetypesDir, outDir, renderMap, ackInstallDir, dryRun})
  computeManifestHash,   // (managed) -> "sha256:<hex>"
  assertPathHygiene,     // (content, outputRel, ackInstallDir?)
  mergeTextManaged,      // (existing, rendered)
  mergeJsonManaged,      // (descriptor, renderedObj, existingObj, managed)
  loadManifest, loadRenderMap, loadYamlFile,       // lazy-js-yaml file loaders
  RenderError,
} from './scripts/render.mjs';
```

`renderTree` returns `{ written[], skipped[], omitted[], ledger[], noop, hash }`.
`skipped[]` lists paths the prior ledger owned whose `when` is now false — the
renderer **leaves them in place** (it deletes nothing it cannot prove it solely
owns) and reports them.

---

## Engine invariants (the testable contract)

1. **Pure substitution, scalar-only, fail-closed.** The match regex is
   `/\$\{([a-z0-9_]+(?:\.[a-z0-9_]+)*)\}/g` — **lower-case only**. An unbound
   `${...}` is a hard `RenderError` that **names the path** (never a silent `""`);
   a `${...}` resolving to a container (object/array) or `null` is also a hard
   error. `bool` renders as `"true"`/`"false"`, `number` as-is. **Output is NOT
   re-scanned**, so a substituted value containing `${...}` is left alone.

2. **`${CLAUDE_PROJECT_DIR}` is preserved verbatim.** Because the regex is
   lower-case-only, the upper-case shell variable is never matched. It is the one
   shell var allowed in child files (e.g. the gate hook command in
   `settings.json`). This is the mechanism that lets manifest `${...}` and shell
   `${CLAUDE_PROJECT_DIR}` coexist in the same file.

3. **Render directives (the only non-scalar construct), processed BEFORE JSON
   parse.**
   - `#ack:each <list.path> as "<fmt with $item>"` → one rendered line per list
     element; the directive line's leading indentation is preserved; a non-array
     path is a hard error.
   - `#ack:if <bool.path>` … `#ack:endif` → enclosed lines kept iff the bool is
     truthy; **no nesting** (depth 1; a nested `#ack:if` is a hard error); an
     unterminated block is a hard error; an absent bool path ⇒ false ⇒ omit.

4. **JSON templates (`*.json.tpl`) are valid + byte-deterministic.** After
   directive expansion and substitution the engine `JSON.parse`s, then
   `JSON.stringify`s with **deep-sorted keys, 2-space indent, trailing newline**.

5. **Conditional inclusion lives in the manifest, never in template control
   flow.**
   - **Path-segment guards `_when.<bool.path>/` are evaluated FIRST.** ALL guards
     in a path must be truthy; a false one **short-circuits to omit**; truthy
     guards are stripped from the output path.
   - **`render.map.yaml` glob guards then apply** against the **post-strip** path
     (still carrying `.tpl`). A file guarded by BOTH a path-segment and a map
     `when` is included only if **BOTH are truthy** (logical AND).
   - **`requires_archetype` is an assertion, not a selector.** If a rule's glob
     matches AND its `when` is truthy AND `managed.archetype != requires_archetype`,
     the render **ABORTS loudly**. It never silently omits.
   - An absent `managed:` key referenced by any `when` ⇒ false ⇒ omit.

6. **`.tpl` strip + static passthrough.** `.tpl` is stripped from the output path
   (`CLAUDE.md.tpl` → `CLAUDE.md`). A file **without** `.tpl` is copied
   byte-for-byte and **never substitution-scanned**, so literal `${...}` in
   shipped scripts/docs survives.

7. **Path hygiene (fail-closed).** Before writing any child file the engine
   asserts the rendered **content** contains **no `templates/archetypes/`
   substring** and **no absolute ack-install path**. A violation aborts the
   render naming the offending output path. (`${CLAUDE_PROJECT_DIR}` is the only
   permitted shell var.)

8. **Structural idempotency — never clobber hand edits.**
   - **Text managed block** (`managed_block: "ack:managed"`): the engine rewrites
     **only** the bytes between
     `<!-- >>> ack:managed … >>> -->` and `<!-- <<< ack:managed <<< -->`,
     preserving all human prose outside. If a target exists without markers, the
     block is appended at end.
   - **JSON key-set ownership** (no comment markers):
     - `settings.json` (`json:hooks,env`) — `hooks` owned only when
       `features.sdd_gate`; within `env` ack owns **only**
       `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` and only when `features.agent_teams`;
       `permissions` and every other key are human-owned and never written.
     - `.mcp.json` (`json:mcpServers`) — within `mcpServers` ack owns **only**
       `ack-*` server entries; user-added (non-`ack-*`) servers are never touched.
   - **Whole-file ownership** (`managed_block: null`): e.g. the `contract-gate`
     hook — overwritten wholesale on re-run.
   - **Ownership ledger** `managed.rendered_files[]`: anything not in the ledger
     is user territory and is never touched.

9. **No-op fast path + determinism.** `manifest_hash` is the sha256 of the
   canonical (deep-sorted, compact-JSON) `managed:` subtree **minus**
   `manifest_hash`, `generator.*`, and `rendered_files` (the renderer-written
   ledger — excluded so the hash is over the manifest INPUT and the no-op path
   stays reachable). On re-run, a matching stored hash **and** every
   `rendered_files[].path` present on disk ⇒ **zero writes, exit 0**. Identical
   `managed:` + identical templates ⇒ identical child bytes.

10. **Forkability.** The engine renders **only** from the `templates/` tree it is
    pointed at; it never copies the META `.claude/` tree or any meta-only file
    into a child.

---

## A note on the substitution regex vs. template content

The substitution scan is **content-agnostic**: any lower-case `${dotted.path}`
in a scanned `.tpl` file is treated as a placeholder. A `.tpl` file that contains
the literal text `` `${var}` `` (e.g. as documentation prose, or in a JSON `//`
comment) will therefore fail closed with `unbound ${var}` — this is invariant 1
working as designed, and the fix belongs in the **template** (use a non-`.tpl`
static file for such docs, or reword to avoid a lower-case `${…}` token), never
in the engine. Likewise, emitting a manifest value that contains
`templates/archetypes/` (e.g. `design_system.source`) into a child file trips the
path-hygiene assertion (invariant 7) — RENDER-ENGINE.md §6 says `source:` is an
input the renderer reads, **never** emitted into a child.
