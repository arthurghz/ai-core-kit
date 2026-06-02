#!/usr/bin/env node
// =============================================================================
// bin/create-ack.mjs
// -----------------------------------------------------------------------------
// create-ack — the ai-core-kit CLI. Principle: EVERYTHING the kit can do must be
// reachable from this binary, not only from Claude Code slash commands or the
// site. The CLI is a thin SUBCOMMAND DISPATCHER:
//
//   create-ack [new] <product-name> [options]   scaffold a CHILD project (default)
//   create-ack cost      [...]                   offline cost/token aggregator
//   create-ack dora      [...]                   DORA "four keys" from local git
//   create-ack report    [...]                   delivery & AI-cost report (md/html)
//   create-ack dashboard [...]                   interactive offline-cost dashboard
//   create-ack watch     [...]                   live per-feature cost TUI
//   create-ack monitor   [...]                   budget alert monitor
//   create-ack spec      [...]                   author specs (LLM step → /ack-spec)
//   create-ack feature <name> [--end]            branch-free per-feature cost window
//   create-ack update                            cached @latest version check
//   create-ack migrate                           manifest v2 -> v3 (stub)
//   create-ack --help | --version
//
// DISPATCH RULE: argv[1] is matched against the known subcommand table. If it is
// a known subcommand it routes there; OTHERWISE the WHOLE argv is treated as the
// classic scaffold invocation, so historic usage is byte-for-byte unchanged:
//   npx @arthurghz/create-ack my-app --archetype fullstack   (still scaffolds)
// `new` is an explicit alias for the scaffold so `create-ack new my-app …` works.
//
// SCAFFOLD pipeline (zero kit fork, zero LLM in the loop):
//   1. parse args            6. assemble + validate manifest (lib/manifest.mjs)
//   2. resolve kit root      7. write project.manifest.yaml into target
//   3. meta-guard target     8. render templates/archetypes/<archetype>/ -> target
//   4. resolve archetype        (delegated to scripts/render.mjs)
//   5. interview (or --yes)  9. copy templates/telemetry/* when telemetry.enabled
//                           10. render templates/docs-site/ -> <target>/docs/ (default-on)
//                           11. print next steps
//
// TELEMETRY subcommands shell out to the stdlib-python tools under telemetry/
// (resolved cwd/telemetry first, else the package-bundled telemetry/), passing
// args through with stdio:'inherit'. The heavy logic stays in Python; the CLI is
// only the front door.
//
// HARD INVARIANTS (scaffold):
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
  realpathSync,
} from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { createInterface } from "node:readline";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir, homedir } from "node:os";

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

    // language — prompt ONLY for archetypes where it's a real choice (applies_to
    // gating via firedIds). fullstack/saas pin TypeScript + pnpm (derived in
    // lib/manifest.mjs assembleManaged), so the language question never fires for
    // them and we must not prompt it here.
    if (!answers.language && firedIds.has("language")) {
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
// Child slash-command copy — drop the SHARED, child-correct commands from
// templates/commands/ into the child's .claude/commands/. These are the action
// primitives a fork runs in Claude Code: /ack-spec (the moment-0 spec author the
// `create-ack spec` CLI also shells to), the RPI trio, prd, rice. They are NOT in
// the per-archetype tree (which only carries hooks + settings) because they are
// archetype-agnostic; this mirrors copyTelemetry's shared-payload model.
//
// Hard rules: the META .claude/ tree is never copied (these come from templates/,
// the CHILD authoring root). We copy *.md verbatim — these commands are already
// CHILD-correct (literal ${CLAUDE_PROJECT_DIR} in any hook refs; no META vars).
// .tpl is skipped (none today) so we never emit a raw template into a child.
// -----------------------------------------------------------------------------
function copyChildCommands({ kitRoot, targetDir }) {
  const src = join(kitRoot, "templates", "commands");
  if (!existsSync(src)) return [];
  const dstRoot = join(targetDir, ".claude", "commands");
  const copied = [];
  const walk = (relDir) => {
    const abs = join(src, relDir);
    for (const entry of readdirSync(abs)) {
      if (entry === "__pycache__") continue;
      const rel = relDir ? join(relDir, entry) : entry;
      const sp = join(src, rel);
      const st = statSync(sp);
      if (st.isDirectory()) {
        walk(rel);
        continue;
      }
      if (!st.isFile() || !entry.endsWith(".md")) continue;
      const dp = join(dstRoot, rel);
      mkdirSync(dirname(dp), { recursive: true });
      copyFileSync(sp, dp);
      copied.push(join(".claude", "commands", rel));
    }
  };
  walk("");
  return copied;
}

// -----------------------------------------------------------------------------
// Child SUBAGENT copy — drop templates/agents/*.md into the child's .claude/agents/.
// These are the specialist agents the build commands delegate to (code-explorer,
// code-reviewer, requirement-parser, architect, security-reviewer, …). Without
// them, /ack-build + the RPI trio cannot fan work out. Copied verbatim (.md only;
// no .tpl today). The META .claude/ tree is never the source — these come from the
// CHILD authoring root templates/agents/.
// -----------------------------------------------------------------------------
function copyChildAgents({ kitRoot, targetDir }) {
  const src = join(kitRoot, "templates", "agents");
  if (!existsSync(src)) return [];
  const dstRoot = join(targetDir, ".claude", "agents");
  const copied = [];
  for (const entry of readdirSync(src)) {
    if (entry === "__pycache__") continue;
    const sp = join(src, entry);
    const st = statSync(sp);
    if (!st.isFile() || !entry.endsWith(".md")) continue;
    const dp = join(dstRoot, entry);
    mkdirSync(dirname(dp), { recursive: true });
    copyFileSync(sp, dp);
    copied.push(join(".claude", "agents", entry));
  }
  return copied;
}

// -----------------------------------------------------------------------------
// Child SKILL copy — ship templates/skills/** into the child's .claude/skills/
// (verbatim; skills are not templates — the `project.language == x` strings are
// routing-doc conditions, not ${...} vars). Preserves the dir structure (SKILL.md
// + references/ + scripts/ + assets/). EXCLUDES, by policy:
//   * __pycache__ dirs + *.pyc        — build artifacts, never shipped;
//   * docx / pdf / pptx / xlsx        — the PROPRIETARY Anthropic document skills
//     ("All rights reserved"; see templates/skills/INDEX.md + docs/REFERENCES.md).
//     The licensing guardrail forbids copying/redistributing them, so a fork never
//     receives them. (They are present in the kit tree but fenced off here.)
// -----------------------------------------------------------------------------
const PROPRIETARY_DOC_SKILLS = new Set(["docx", "pdf", "pptx", "xlsx"]);
function copyChildSkills({ kitRoot, targetDir }) {
  const src = join(kitRoot, "templates", "skills");
  if (!existsSync(src)) return [];
  const dstRoot = join(targetDir, ".claude", "skills");
  const copied = [];
  const walk = (relDir) => {
    const abs = join(src, relDir);
    for (const entry of readdirSync(abs)) {
      if (entry === "__pycache__") continue;
      const rel = relDir ? join(relDir, entry) : entry;
      // Fence off the proprietary document skills at their top-level dir.
      if (!relDir && PROPRIETARY_DOC_SKILLS.has(entry)) continue;
      const sp = join(src, rel);
      const st = statSync(sp);
      if (st.isDirectory()) {
        walk(rel);
        continue;
      }
      if (!st.isFile() || entry.endsWith(".pyc")) continue;
      const dp = join(dstRoot, rel);
      mkdirSync(dirname(dp), { recursive: true });
      copyFileSync(sp, dp);
      copied.push(join(".claude", "skills", rel));
    }
  };
  walk("");
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
// runScaffold — the classic create-ack scaffold pipeline. `argv` is the slice
// AFTER the binary name (i.e. process.argv.slice(2), with a leading `new` alias
// already stripped by the dispatcher). Preserved verbatim from the original
// single-command CLI so every historic flag + the interview behave identically.
// -----------------------------------------------------------------------------
async function runScaffold(argv) {
  const opts = parseArgs(argv);
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

  // Resolve product name + target dir. Name is OPTIONAL: interactive runs prompt
  // for it (after the archetype, questions.yaml `project_name`); non-interactive
  // runs (--here or --yes) fall back to the current folder's name. So
  // `create-ack --archetype fullstack` drops you into the interview, and
  // `--archetype fullstack --yes` scaffolds using the folder name.
  if (!opts.productName && (opts.here || opts.yes)) {
    opts.productName = basename(resolve(process.cwd()));
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

  // Ship the shared child slash commands (/ack-spec + RPI trio + prd/rice) into
  // the child's .claude/commands/. Always-on: every fork needs /ack-spec (the
  // `create-ack spec` CLI shells to it). Record in the ledger so /ack-init sees
  // them; they are ack:managed (the kit owns the command text).
  const commandsCopied = copyChildCommands({ kitRoot, targetDir });
  // Ship the rest of the .claude/ payload a working fork needs: the specialist
  // AGENTS the build commands delegate to, and the SKILLS library (minus the
  // proprietary document skills). Without agents, /ack-build + the RPI trio cannot
  // fan work out; without skills, the conventions packs never reach the fork.
  const agentsCopied = copyChildAgents({ kitRoot, targetDir });
  const skillsCopied = copyChildSkills({ kitRoot, targetDir });
  const childPayloadCopied = [...commandsCopied, ...agentsCopied, ...skillsCopied];
  if (childPayloadCopied.length) {
    if (!Array.isArray(finalManifest.managed.rendered_files)) {
      finalManifest.managed.rendered_files = [];
    }
    const known = new Set(finalManifest.managed.rendered_files.map((e) => e.path));
    for (const p of childPayloadCopied) {
      if (!known.has(p)) {
        finalManifest.managed.rendered_files.push({ path: p, managed_block: null });
      }
    }
    writeManifest(manifestPath, finalManifest);
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
    commandsCopied,
    agentsCopied,
    skillsCopied,
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
  commandsCopied = [],
  agentsCopied = [],
  skillsCopied = [],
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
  if (commandsCopied.length)
    out.write(`  commands      ${commandsCopied.length} -> .claude/commands/  (ack-spec/build/agents/tooling/cost + rpi)\n`);
  if (agentsCopied.length)
    out.write(`  agents        ${agentsCopied.length} -> .claude/agents/  (build/review specialists)\n`);
  if (skillsCopied.length)
    out.write(`  skills        ${skillsCopied.length} file(s) -> .claude/skills/  (conventions packs)\n`);
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

// =============================================================================
// SUBCOMMAND DISPATCHER
// -----------------------------------------------------------------------------
// Telemetry subcommands -> the stdlib-python tool that owns the logic. monitor.sh
// is bash; the rest are python3 scripts under telemetry/.
// =============================================================================
const TELEMETRY_SUBCOMMANDS = {
  cost: { script: "aggregate.py", runner: "python3" },
  dora: { script: "dora.py", runner: "python3" },
  report: { script: "report.py", runner: "python3" },
  dashboard: { script: "dashboard.py", runner: "python3" },
  watch: { script: "watch.py", runner: "python3" },
  monitor: { script: "monitor.sh", runner: "bash" },
};

// Child-authoring commands that are LLM islands: the CLI stays THIN and shells to
// Claude Code headless (`claude -p /<command>`) so `create-ack <cmd>` == running the
// slash command in the child. The heavy logic lives in the command files
// (templates/commands/ack-*.md), not here. Keeps CLI ⇄ slash-command parity.
const CLAUDE_COMMAND_SUBCOMMANDS = {
  build: { slash: "/ack-build", blurb: "build the next slice from the specs (multi-agent, gated)" },
  agents: { slash: "/ack-agents", blurb: "fan a unit of work out to parallel agents" },
  tooling: { slash: "/ack-tooling", blurb: "stand up the project's engineering tooling" },
};

// All recognized subcommands (telemetry + the kit-native ones). `new` aliases the
// scaffold. Anything NOT here makes argv fall through to the scaffold unchanged.
const KNOWN_SUBCOMMANDS = new Set([
  "new",
  ...Object.keys(TELEMETRY_SUBCOMMANDS),
  ...Object.keys(CLAUDE_COMMAND_SUBCOMMANDS),
  "spec",
  "sync",
  "feature",
  "update",
  "migrate",
]);

const DISPATCH_USAGE = `${c.bold("create-ack")} — the ai-core-kit CLI

${c.bold("Usage:")}
  create-ack [new] <product-name> [options]   scaffold a new child project (default)

${c.bold("Subcommands:")}
  ${c.cyan("new")} <name> [options]   scaffold a child project (alias of the default)
  ${c.cyan("cost")} [...]             offline cost & token aggregator (telemetry/aggregate.py)
  ${c.cyan("dora")} [...]             DORA four-keys from local git (telemetry/dora.py)
  ${c.cyan("report")} [...]           delivery & AI-cost report, md/html (telemetry/report.py)
  ${c.cyan("dashboard")} [...]        interactive offline-cost dashboard (telemetry/dashboard.py)
  ${c.cyan("watch")} [...]            live per-feature cost TUI (telemetry/watch.py)
  ${c.cyan("monitor")} [...]          budget-alert monitor (telemetry/monitor.sh)
  ${c.cyan("spec")} [...]             author specs — the LLM step (runs /ack-spec)
  ${c.cyan("build")} [<slice>]        build the next slice from the specs (runs /ack-build)
  ${c.cyan("agents")} [<work>]        fan work out to parallel agents (runs /ack-agents)
  ${c.cyan("tooling")} [...]          stand up engineering tooling (runs /ack-tooling)
  ${c.cyan("sync")}                   pull the latest kit commands/agents/skills into this fork
  ${c.cyan("feature")} <name> [--end] branch-free per-feature cost window (sidecar map)
  ${c.cyan("update")}                 check for a newer @arthurghz/create-ack
  ${c.cyan("migrate")}                manifest v2 -> v3 (stub)

${c.bold("Scaffold options:")} (run ${c.cyan("create-ack new --help")} for the full list)
  --archetype <name>   backend-api | fullstack | saas | monorepo | library-sdk | infra-iac
  --here  --yes  --lang <l>  --framework <f>  --no-docs

${c.bold("Global:")}
  -h, --help           Show this help
  -v, --version        Show version`;

// Resolve the telemetry/ dir: the consuming project's cwd/telemetry first (so a
// CHILD repo with copied telemetry uses ITS scripts), else the package's bundled
// telemetry/ (so a bare `npx create-ack cost` still works from the kit).
function resolveTelemetryDir() {
  const cwdTel = join(process.cwd(), "telemetry");
  if (existsSync(cwdTel)) return cwdTel;
  const pkgTel = join(kitRootFromHere(), "telemetry");
  if (existsSync(pkgTel)) return pkgTel;
  return null;
}

// Is an executable resolvable on PATH? (used for python3 / claude hints.)
function hasOnPath(cmd) {
  const probe = process.platform === "win32" ? "where" : "command";
  const args = process.platform === "win32" ? [cmd] : ["-v", cmd];
  try {
    const r = spawnSync(probe, args, { stdio: "ignore" });
    return r.status === 0;
  } catch {
    return false;
  }
}

// Shell out to a telemetry tool, forwarding args + inheriting stdio. Exits with
// the child's status code. Prints a clear hint when python3 or the script is gone.
function runTelemetry(name, args) {
  const spec = TELEMETRY_SUBCOMMANDS[name];
  const telDir = resolveTelemetryDir();
  if (!telDir) {
    fail(
      `telemetry directory not found.\n` +
        `  Looked in: ${join(process.cwd(), "telemetry")} and the create-ack package.\n` +
        `  Run this from a project that has a telemetry/ dir, or reinstall create-ack.`,
    );
  }
  const scriptPath = join(telDir, spec.script);
  if (!existsSync(scriptPath)) {
    fail(
      `telemetry tool not found: ${spec.script}\n` +
        `  Expected: ${scriptPath}\n` +
        `  Reinstall ai-core-kit or run from a project that ships telemetry/${spec.script}.`,
    );
  }
  if (!hasOnPath(spec.runner)) {
    fail(
      `'${spec.runner}' is required for \`create-ack ${name}\` but was not found on PATH.\n` +
        (spec.runner === "python3"
          ? "  Install Python 3 (https://www.python.org/downloads/) and re-run.\n" +
            `  Or run it directly: python3 ${scriptPath} ${args.join(" ")}`
          : `  Install bash, or run it directly: bash ${scriptPath} ${args.join(" ")}`),
    );
  }
  const child = spawnSync(spec.runner, [scriptPath, ...args], { stdio: "inherit" });
  if (child.error) fail(`failed to run ${spec.script}: ${child.error.message}`);
  process.exit(child.status === null ? 1 : child.status);
}

// -----------------------------------------------------------------------------
// `spec` — spec authoring is the LLM island. The CLI stays THIN: it shells to
// Claude Code headless (`claude -p`) to drive /ack-spec when `claude` is on PATH,
// else it tells the user to run /ack-spec in their Claude Code session. The heavy
// logic lives in the /ack-spec command + skill, not here.
// -----------------------------------------------------------------------------
function runSpec(args) {
  process.stdout.write(
    c.bold("create-ack spec") +
      " — authoring specs is the LLM step (the narrative interview).\n",
  );
  if (hasOnPath("claude")) {
    process.stdout.write(
      c.dim("  Driving Claude Code headless to run ") + c.cyan("/ack-spec") + c.dim("…\n"),
    );
    // Pass through any extra args; default prompt invokes the slash command.
    const promptArgs = args.length ? args : ["-p", "/ack-spec"];
    const child = spawnSync("claude", promptArgs, { stdio: "inherit" });
    if (child.error) fail(`failed to launch claude: ${child.error.message}`);
    process.exit(child.status === null ? 1 : child.status);
  }
  process.stdout.write(
    "\n  The " +
      c.cyan("claude") +
      " CLI is not on PATH. Open this project in Claude Code and run " +
      c.cyan(c.bold("/ack-spec")) +
      "\n  (you have the subscription). It runs the deep narrative interview and authors\n" +
      "  the filled specs + best CLAUDE.md before any code is written.\n",
  );
  process.exit(0);
}

// -----------------------------------------------------------------------------
// build / agents / tooling — the post-spec build commands. Like `spec`, these are
// LLM islands: the CLI shells to Claude Code headless (`claude -p /<command>`) so
// `create-ack build` == running /ack-build in the child. Positional args become the
// slash command's arguments; a leading `-` is treated as raw `claude` flags.
// -----------------------------------------------------------------------------
function runClaudeCommand(name, args) {
  const spec = CLAUDE_COMMAND_SUBCOMMANDS[name];
  process.stdout.write(
    c.bold(`create-ack ${name}`) + ` — runs ${c.cyan(spec.slash)} in Claude Code.\n`,
  );
  if (hasOnPath("claude")) {
    process.stdout.write(
      c.dim("  Driving Claude Code headless to run ") + c.cyan(spec.slash) + c.dim("…\n"),
    );
    let promptArgs;
    if (!args.length) promptArgs = ["-p", spec.slash];
    else if (args[0].startsWith("-")) promptArgs = args; // power-user: raw claude flags
    else promptArgs = ["-p", `${spec.slash} ${args.join(" ")}`]; // positional => slash args
    const child = spawnSync("claude", promptArgs, { stdio: "inherit" });
    if (child.error) fail(`failed to launch claude: ${child.error.message}`);
    process.exit(child.status === null ? 1 : child.status);
  }
  process.stdout.write(
    "\n  The " +
      c.cyan("claude") +
      " CLI is not on PATH. Open this project in Claude Code and run " +
      c.cyan(c.bold(spec.slash)) +
      `\n  (you have the subscription) to ${spec.blurb}.\n`,
  );
  process.exit(0);
}

// -----------------------------------------------------------------------------
// `feature <name> [--end]` — the BRANCH-FREE per-feature cost tracker. Maintains
// telemetry/sidecar.local.json in the exact shape aggregate.py's sidecar_map mode
// reads: {"entries": [{"from": ISO, "to": ISO|null, "bucket": <name>}]}. Starting
// a feature appends an OPEN window (to:null) after CLOSING any currently-open one.
// `--end` just closes the open window. Cost is then attributable per feature with
//   create-ack cost --sidecar-map telemetry/sidecar.local.json --by feature
// without any branch naming convention.
// -----------------------------------------------------------------------------
const SIDECAR_FILE = "sidecar.local.json";

function sidecarPath() {
  // Prefer the cwd's telemetry/ (the project being measured). If the project has
  // no telemetry/ yet, create one in cwd so attribution is local to that repo.
  const cwdTel = join(process.cwd(), "telemetry");
  return join(cwdTel, SIDECAR_FILE);
}

function loadSidecar(p) {
  if (!existsSync(p)) return { entries: [] };
  try {
    const data = JSON.parse(readFileSync(p, "utf8"));
    if (!data || !Array.isArray(data.entries)) return { entries: [] };
    return data;
  } catch {
    return { entries: [] };
  }
}

function saveSidecar(p, data) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function closeOpenWindow(entries, iso) {
  for (const e of entries) {
    if (e && (e.to === null || e.to === undefined || e.to === "")) e.to = iso;
  }
}

function runFeature(args) {
  let end = false;
  const positionals = [];
  for (const a of args) {
    if (a === "--end") end = true;
    else if (a === "-h" || a === "--help") {
      process.stdout.write(
        "create-ack feature <name>   start a branch-free cost window for <name>\n" +
          "create-ack feature --end    close the currently-open window\n\n" +
          "Windows are written to telemetry/" +
          SIDECAR_FILE +
          " (sidecar_map shape).\n" +
          "Attribute with: create-ack cost --sidecar-map telemetry/" +
          SIDECAR_FILE +
          " --by feature\n",
      );
      process.exit(0);
    } else if (a.startsWith("-")) {
      usageError(`unknown option for feature: ${a}`);
    } else positionals.push(a);
  }

  const p = sidecarPath();
  const data = loadSidecar(p);
  const now = new Date().toISOString();

  if (end) {
    const hadOpen = data.entries.some((e) => e && (e.to === null || e.to === undefined || e.to === ""));
    closeOpenWindow(data.entries, now);
    saveSidecar(p, data);
    if (hadOpen) {
      process.stdout.write(c.green("✓ ") + `closed the active feature window at ${now}\n`);
    } else {
      process.stdout.write(c.yellow("no active feature window to close.\n"));
    }
    process.stdout.write(c.dim(`  ${p}\n`));
    return;
  }

  const name = positionals[0];
  if (!name) {
    usageError("create-ack feature <name>  (or --end to close the current window)");
  }
  // Close any open window, then append a fresh open one for <name>.
  closeOpenWindow(data.entries, now);
  data.entries.push({ from: now, to: null, bucket: name });
  saveSidecar(p, data);

  process.stdout.write(c.green("✓ ") + `tracking feature ${c.bold(name)} from ${now}\n`);
  process.stdout.write(c.dim(`  ${p}\n`));
  process.stdout.write(
    c.dim(
      `  Cost for this feature: create-ack cost --sidecar-map ${join("telemetry", SIDECAR_FILE)} --by feature\n`,
    ),
  );
}

// -----------------------------------------------------------------------------
// `sync` — pull the latest kit .claude PAYLOAD (slash commands + agents + skills)
// into an EXISTING fork, WITHOUT re-scaffolding. Run from a fork root (where a
// project.manifest.yaml exists), typically `npx @arthurghz/create-ack@latest sync`,
// so a fork picks up new features as the kit evolves. Idempotent: it overwrites the
// KIT-OWNED payload (commands/agents/skills) and never touches specs, code, or
// contracts. The slash-command face is /ack-sync.
// -----------------------------------------------------------------------------
function runSync(args) {
  if (args.includes("-h") || args.includes("--help")) {
    process.stdout.write(
      "create-ack sync   pull the latest kit commands/agents/skills into this fork's .claude/\n" +
        "  Run from a fork root. Overwrites kit-owned files only; your specs/code are untouched.\n" +
        "  Tip: `npx @arthurghz/create-ack@latest sync` to sync against the newest kit.\n",
    );
    return;
  }
  const cwd = process.cwd();
  // Refuse the META kit itself (sync is a FORK operation, the inverse of the guard).
  if (existsSync(join(cwd, "templates", "archetypes")) || existsSync(join(cwd, "docs", "BOOTSTRAP.md"))) {
    fail("`create-ack sync` runs in a FORK, not the ai-core-kit repository itself.");
  }
  if (!existsSync(join(cwd, "project.manifest.yaml"))) {
    fail(
      "no project.manifest.yaml here — `create-ack sync` updates an EXISTING fork's .claude\n" +
        "  payload. Run it from your project root, or scaffold a new project with `create-ack`.",
    );
  }
  const kitRoot = kitRootFromHere();
  const commands = copyChildCommands({ kitRoot, targetDir: cwd });
  const agents = copyChildAgents({ kitRoot, targetDir: cwd });
  const skills = copyChildSkills({ kitRoot, targetDir: cwd });
  const out = process.stdout;
  out.write(c.green("✓ ") + c.bold("synced the kit payload into .claude/") + ` (v${readKitVersion()})\n`);
  out.write(c.dim(`  commands  ${commands.length}  ·  agents  ${agents.length}  ·  skills  ${skills.length} file(s)\n`));
  out.write(
    "\n  These files are KIT-OWNED — review the update with " +
      c.cyan("git diff .claude/") +
      " (your specs, code, and contracts were not touched).\n",
  );
}

// =============================================================================
// UPDATE CHECK — both the explicit `update` subcommand and the passive notifier
// share this cached @latest lookup. The package is published as
// @arthurghz/create-ack; the registry's dist-tags/latest gives the newest version.
// =============================================================================
const PKG_NAME = "@arthurghz/create-ack";
const REGISTRY_URL = "https://registry.npmjs.org/@arthurghz%2Fcreate-ack/latest";
const UPDATE_TTL_MS = 24 * 60 * 60 * 1000; // notifier: at most once per 24h

function cacheFilePath() {
  const base =
    process.env.XDG_CACHE_HOME ||
    (process.platform === "darwin"
      ? join(homedir(), "Library", "Caches")
      : join(homedir(), ".cache"));
  try {
    const dir = join(base, "create-ack");
    return join(dir, "update-check.json");
  } catch {
    return join(tmpdir(), "create-ack-update-check.json");
  }
}

function readUpdateCache() {
  try {
    return JSON.parse(readFileSync(cacheFilePath(), "utf8"));
  } catch {
    return null;
  }
}

function writeUpdateCache(obj) {
  try {
    const p = cacheFilePath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(obj), "utf8");
  } catch {
    /* fail-silent: the cache is a nicety, never load-bearing */
  }
}

// Fetch dist-tags/latest with a hard timeout. Resolves to the version string, or
// null on ANY failure (no network, timeout, non-200, bad JSON). NEVER throws.
async function fetchLatestVersion(timeoutMs = 3000) {
  if (typeof fetch !== "function") return null; // very old Node; skip silently
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: ac.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.version === "string" ? body.version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Compare dotted semver-ish strings. Returns true iff `latest` > `current`.
function isNewer(latest, current) {
  if (!latest || !current) return false;
  const norm = (v) => String(v).replace(/^v/, "").split("-")[0].split(".").map((n) => parseInt(n, 10) || 0);
  const a = norm(latest);
  const b = norm(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

function upgradeHint() {
  return (
    "  npm i -g " +
    PKG_NAME +
    "@latest        (global install)\n" +
    "  npx " +
    PKG_NAME +
    "@latest         (one-off)\n"
  );
}

// Explicit `update` subcommand — does the live (cached) check and PRINTS a result.
async function runUpdate() {
  const current = readKitVersion();
  const latest = await fetchLatestVersion(3000);
  if (latest) writeUpdateCache({ checkedAt: Date.now(), latest });
  if (latest === null) {
    process.stdout.write(
      c.dim("could not reach the npm registry (offline?). ") +
        `Installed: ${current}.\n`,
    );
    process.exit(0);
  }
  if (isNewer(latest, current)) {
    process.stdout.write(
      c.yellow("update available ") + c.bold(`${current} → ${latest}`) + "\n" + upgradeHint(),
    );
  } else {
    process.stdout.write(c.green("✓ ") + `up to date (${current}).\n`);
  }
  process.exit(0);
}

// PASSIVE notifier — runs after a command, at most once per 24h, async +
// non-blocking + fail-silent. Prints one stderr line if an update exists. Never
// blocks (unref'd timer + detached promise), never errors the command. Skipped
// under --yes / CI / non-tty.
function maybeNotifyUpdate(argv) {
  try {
    const suppress =
      process.env.CI ||
      process.env.NO_UPDATE_NOTIFIER ||
      !process.stderr.isTTY ||
      argv.includes("--yes") ||
      argv.includes("-y");
    if (suppress) return;

    const current = readKitVersion();
    const cache = readUpdateCache();
    const fresh = cache && Date.now() - (cache.checkedAt || 0) < UPDATE_TTL_MS;

    const announce = (latest) => {
      if (isNewer(latest, current)) {
        process.stderr.write(
          c.yellow(`\nupdate available ${current} → ${latest} `) +
            c.dim(`(run \`create-ack update\`)\n`),
        );
      }
    };

    if (fresh) {
      // Use the cached latest; no network this run.
      if (cache.latest) announce(cache.latest);
      return;
    }

    // Stale/absent cache: refresh in the background. Do NOT await — let the event
    // loop drain naturally. Unref the abort timer inside fetch isn't needed since
    // the promise itself keeps no handle the caller waits on.
    fetchLatestVersion(2500)
      .then((latest) => {
        if (latest) {
          writeUpdateCache({ checkedAt: Date.now(), latest });
          announce(latest);
        }
      })
      .catch(() => {
        /* fail-silent */
      });
  } catch {
    /* the notifier must NEVER affect the command's outcome */
  }
}

// -----------------------------------------------------------------------------
// `migrate` — manifest schema v2 -> v3. The frozen schema is already v3, so this
// is a forward-looking stub: it detects a v2 manifest and explains the path. It
// never mutates the schema (META rule) and is safe to call as a no-op.
// -----------------------------------------------------------------------------
function runMigrate(args) {
  const target = args.find((a) => !a.startsWith("-")) || process.cwd();
  const manifestPath = existsSync(join(target, "project.manifest.yaml"))
    ? join(target, "project.manifest.yaml")
    : target.endsWith(".yaml")
      ? target
      : join(target, "project.manifest.yaml");

  if (!existsSync(manifestPath)) {
    process.stdout.write(
      c.yellow("create-ack migrate: ") +
        `no project.manifest.yaml found at ${manifestPath}.\n` +
        c.dim("  Run this inside a scaffolded child project.\n"),
    );
    process.exit(0);
  }

  let manifest;
  try {
    manifest = yaml.load(readFileSync(manifestPath, "utf8")) || {};
  } catch (e) {
    fail(`could not parse ${manifestPath}: ${e.message}`);
  }

  const v = manifest.schema_version;
  if (v === 3) {
    process.stdout.write(c.green("✓ ") + `manifest is already schema_version 3 (no migration needed).\n`);
    process.exit(0);
  }
  if (v === 2) {
    process.stdout.write(
      c.yellow("create-ack migrate: ") +
        "manifest is schema_version 2.\n" +
        c.dim(
          "  v2 -> v3 migration is not yet automated. Re-scaffold with the current\n" +
            "  create-ack, or re-run /ack-init in the child to regenerate the managed block.\n",
        ),
    );
    process.exit(0);
  }
  process.stdout.write(
    c.yellow("create-ack migrate: ") +
      `unrecognized schema_version: ${JSON.stringify(v)} — nothing to do.\n`,
  );
  process.exit(0);
}

// =============================================================================
// main — the dispatcher.
// =============================================================================
async function main() {
  const argv = process.argv.slice(2);
  const first = argv[0];

  // Top-level --version / --help only when they are the FIRST token (so a scaffold
  // like `create-ack my-app --help` still reaches parseArgs' per-flag help).
  if (first === "-v" || first === "--version") {
    process.stdout.write(readKitVersion() + "\n");
    return;
  }
  if (first === "-h" || first === "--help") {
    process.stdout.write(DISPATCH_USAGE + "\n");
    return;
  }

  // Telemetry passthroughs — shell out to the python/bash tool. These never
  // return (they process.exit with the child's status).
  if (first in TELEMETRY_SUBCOMMANDS) {
    runTelemetry(first, argv.slice(1));
    return;
  }

  // Kit-native subcommands.
  if (first === "spec") {
    runSpec(argv.slice(1));
    return;
  }
  // build / agents / tooling — shell to Claude Code to run the slash command.
  if (first in CLAUDE_COMMAND_SUBCOMMANDS) {
    runClaudeCommand(first, argv.slice(1));
    return;
  }
  if (first === "sync") {
    runSync(argv.slice(1));
    maybeNotifyUpdate(argv);
    return;
  }
  if (first === "feature") {
    runFeature(argv.slice(1));
    maybeNotifyUpdate(argv);
    return;
  }
  if (first === "update") {
    await runUpdate();
    return;
  }
  if (first === "migrate") {
    runMigrate(argv.slice(1));
    return;
  }

  // Scaffold — either the explicit `new` alias or the fall-through (unknown first
  // arg == the classic positional product-name). Strip `new` if present.
  const scaffoldArgv = first === "new" ? argv.slice(1) : argv;
  await runScaffold(scaffoldArgv);

  // Passive, fail-silent, non-blocking update notice after a successful scaffold.
  maybeNotifyUpdate(argv);
}

// Guard: only auto-run when invoked as the CLI binary, NOT when imported by a test
// (so scripts/cli.test.mjs can import the dispatcher's helpers without side effects).
// Resolve symlinks on BOTH sides: when installed from npm, the binary is run via
// a `node_modules/.bin/create-ack` symlink, so process.argv[1] is the symlink
// while import.meta.url is the real file. Without realpath they never match and
// main() would silently never run (the v0.2.0 bug). realpathSync collapses both
// to the real path so npx / global installs work.
function invokedAsCli() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
const INVOKED_AS_CLI = invokedAsCli();

if (INVOKED_AS_CLI) {
  main().catch((e) => {
    fail(e?.stack || String(e));
  });
}

// Exported for tests (no side effects on import).
export {
  main,
  runScaffold,
  runFeature,
  runUpdate,
  runMigrate,
  fetchLatestVersion,
  isNewer,
  resolveTelemetryDir,
  loadSidecar,
  saveSidecar,
  sidecarPath,
  closeOpenWindow,
  cacheFilePath,
  maybeNotifyUpdate,
  KNOWN_SUBCOMMANDS,
  TELEMETRY_SUBCOMMANDS,
};
