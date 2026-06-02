// =============================================================================
// lib/manifest.mjs
// -----------------------------------------------------------------------------
// Deterministic ASSEMBLY + VALIDATION of a child project's `project.manifest.yaml`
// from the FROZEN interview question bank (templates/interview/questions.yaml) and
// the FROZEN schema (templates/manifest/project.manifest.schema.json).
//
// There is NO LLM in this path. Given the same answers + the same frozen inputs,
// the assembled manifest is byte-identical (manifest invariant I2). The only
// non-deterministic value (generator.rendered_at) lives OUTSIDE managed: and is
// excluded from manifest_hash by construction.
//
// Public surface:
//   loadQuestionBank(kitRoot)                  -> { schema_target, questions }
//   loadSchema(kitRoot)                        -> JSON-Schema object
//   verifyWritesTo(questions, schema)          -> throws on orphan keys (I1)
//   filterQuestions(questions, archetype, ans) -> [questions that fire]
//   assembleManaged(answers, opts)             -> the managed: subtree (validated)
//   buildManifest(answers, opts)               -> full manifest {schema_version, generator, managed, user}
//   validateManifest(schema, manifest)         -> { valid, errors }
//   computeManifestHash(managed)               -> "sha256:<64 hex>"
//
// The CLI (bin/create-ack.mjs) collects a flat answers map keyed by question `id`
// (e.g. { archetype: "backend-api", project_name: "acme", ... }) and hands it to
// buildManifest(). Any answer left out falls back to the question's `default`,
// honoring applies_to + ask_if/skip_if gating so non-applicable keys are never
// written (deterministic, schema-aligned).
// =============================================================================

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";
// The frozen schema is JSON-Schema draft 2020-12, so we use Ajv's 2020 build
// (the default `ajv` entrypoint only knows draft-07 and would reject the $schema).
import { Ajv2020 as Ajv } from "ajv/dist/2020.js";

// Schema-declaration order of keys under managed:. The manifest must emit keys in
// this exact order so the canonical hash + on-disk YAML are byte-stable across runs
// regardless of the order answers happen to be collected.
const MANAGED_KEY_ORDER = [
  "manifest_hash",
  "project",
  "archetype",
  "features",
  "api_first",
  "persistence",
  "contract_gate",
  "contracts",
  "design_system",
  "telemetry",
  "discovery",
  "ci_cd",
  "rendered_files",
];

const PROJECT_KEY_ORDER = [
  "name",
  "description",
  "language",
  "runtime",
  "package_manager",
  "framework",
  "architecture",
];

// Sentinel for "this question was gated out / never answered". Against UNKNOWN the
// tiny predicate grammar makes ==/in false and !=/not_in true (fail-safe: skip).
const UNKNOWN = Symbol("ack.unknown");

// -----------------------------------------------------------------------------
// Loading frozen inputs
// -----------------------------------------------------------------------------

export function loadQuestionBank(kitRoot) {
  const p = join(kitRoot, "templates", "interview", "questions.yaml");
  const doc = yaml.load(readFileSync(p, "utf8"));
  if (!doc || !Array.isArray(doc.questions)) {
    throw new Error(`questions.yaml at ${p} has no questions[] array`);
  }
  return doc;
}

export function loadSchema(kitRoot) {
  const p = join(kitRoot, "templates", "manifest", "project.manifest.schema.json");
  return JSON.parse(readFileSync(p, "utf8"));
}

// -----------------------------------------------------------------------------
// I1: every writes_to resolves to a declared schema property under managed:.
// Walk the dotted writes_to against the schema's managed.properties tree. Orphan
// keys HARD-REFUSE at startup (no silent divergence between interview + schema).
// -----------------------------------------------------------------------------

export function verifyWritesTo(questions, schema) {
  const managedProps = schema?.properties?.managed?.properties;
  if (!managedProps) {
    throw new Error("schema has no properties.managed.properties");
  }
  const orphans = [];
  for (const q of questions) {
    if (!q || typeof q.writes_to !== "string") continue;
    if (!schemaHasPath(managedProps, q.writes_to.split("."))) {
      orphans.push(`${q.id} -> managed.${q.writes_to}`);
    }
  }
  if (orphans.length) {
    throw new Error(
      "interview/manifest divergence (invariant I1): writes_to without a schema target:\n  " +
        orphans.join("\n  "),
    );
  }
}

function schemaHasPath(props, segments) {
  let node = props;
  for (let i = 0; i < segments.length; i++) {
    if (!node || typeof node !== "object") return false;
    const seg = segments[i];
    if (!Object.prototype.hasOwnProperty.call(node, seg)) return false;
    const child = node[seg];
    if (i === segments.length - 1) return true;
    // descend: an object schema node exposes its children under .properties
    node = child && child.properties;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Question gating: applies_to (archetype) FIRST, then ask_if/skip_if against the
// answers gathered so far (earlier questions only, by document order).
// -----------------------------------------------------------------------------

export function filterQuestions(questions, archetype, answers = {}) {
  const fired = [];
  const known = { archetype }; // archetype is always the first known value
  for (const q of questions) {
    if (q.id === "archetype") {
      fired.push(q);
      continue;
    }
    if (!appliesToArchetype(q, archetype)) continue;

    let ask = true;
    if (typeof q.skip_if === "string") {
      ask = !evalPredicate(q.skip_if, known);
    } else if (typeof q.ask_if === "string") {
      ask = evalPredicate(q.ask_if, known);
    }
    if (!ask) continue;

    fired.push(q);
    // Record this question's effective value so later predicates can reference it.
    known[q.id] = resolveAnswer(q, answers);
  }
  return fired;
}

function appliesToArchetype(q, archetype) {
  const a = q.applies_to;
  if (a === "all") return true;
  if (Array.isArray(a)) return a.includes(archetype);
  return false;
}

// resolveAnswer: prefer an explicit answer for q.id, else the question default.
function resolveAnswer(q, answers) {
  if (answers && Object.prototype.hasOwnProperty.call(answers, q.id)) {
    const v = answers[q.id];
    if (v !== undefined && v !== null) return v;
  }
  return q.default;
}

// -----------------------------------------------------------------------------
// Predicate grammar (intentionally tiny + deterministic):
//   "<id> == <literal>" | "<id> != <literal>"
//   "<id> in [a, b]"    | "<id> not_in [a, b]"
// A referenced id that is UNKNOWN makes ==/in false and !=/not_in true.
// -----------------------------------------------------------------------------

export function evalPredicate(expr, known) {
  const m = expr.trim().match(/^([a-z0-9_]+)\s+(==|!=|in|not_in)\s+(.+)$/i);
  if (!m) throw new Error(`unparseable predicate: ${JSON.stringify(expr)}`);
  const [, id, op, rhsRaw] = m;
  const lhs = Object.prototype.hasOwnProperty.call(known, id) ? known[id] : UNKNOWN;

  if (op === "in" || op === "not_in") {
    const list = parseList(rhsRaw);
    if (lhs === UNKNOWN) return op === "not_in"; // in->false, not_in->true
    const hit = list.some((x) => looseEq(x, lhs));
    return op === "in" ? hit : !hit;
  }

  const rhs = parseScalar(rhsRaw);
  if (lhs === UNKNOWN) return op === "!="; // ==->false, !=->true
  const eq = looseEq(lhs, rhs);
  return op === "==" ? eq : !eq;
}

function parseList(raw) {
  const s = raw.trim();
  if (!s.startsWith("[") || !s.endsWith("]")) {
    throw new Error(`expected [list] operand, got ${JSON.stringify(raw)}`);
  }
  const inner = s.slice(1, -1).trim();
  if (inner === "") return [];
  return inner.split(",").map((p) => parseScalar(p.trim()));
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith("'") && s.endsWith("'")) ||
    (s.startsWith('"') && s.endsWith('"'))
  ) {
    return s.slice(1, -1);
  }
  return s; // bareword
}

// Compare with light coercion so bool/number answers match bareword literals.
function looseEq(a, b) {
  if (a === b) return true;
  return String(a) === String(b);
}

// -----------------------------------------------------------------------------
// Per-archetype seeds — quality defaults the interview does NOT write but the
// renderer/gate expect. Only `contracts` differs by archetype today (backend-api
// gets one draft stub; everything else seeds []). protected_paths etc. come from
// the per-archetype questions' defaults, NOT here.
// -----------------------------------------------------------------------------

function seedContracts(archetype, projectName) {
  if (archetype === "backend-api" && projectName) {
    return [
      {
        id: `C-001-${projectName}`,
        scope: ["src/**"],
        status: "draft",
      },
    ];
  }
  return [];
}

// -----------------------------------------------------------------------------
// assembleManaged: gate the question bank, collect effective values, then shape
// them into the schema's managed: subtree with deterministic key order. Optional
// sub-objects are only emitted when their gating question fired.
// -----------------------------------------------------------------------------

export function assembleManaged(answers, opts = {}) {
  const { questions } = opts;
  if (!questions) throw new Error("assembleManaged requires opts.questions");

  const archetype = resolveArchetype(answers, questions);
  const fired = filterQuestions(questions, archetype, answers);

  // collected: question id -> effective value (answer || default), for fired Qs only.
  const collected = {};
  for (const q of fired) collected[q.id] = resolveAnswer(q, answers);

  const has = (id) => Object.prototype.hasOwnProperty.call(collected, id);
  const val = (id) => collected[id];

  const managed = {};

  // manifest_hash placeholder; replaced at the very end of buildManifest.
  managed.manifest_hash = "";

  // --- project (ordered) ------------------------------------------------------
  const project = {};
  if (has("project_name")) project.name = val("project_name");
  // description: ALWAYS emitted (even ""), because deep-archetype templates
  // reference ${project.description} unconditionally and the render engine treats
  // an absent key as a hard unbound-var error. Empty string is a valid free string.
  if (has("project_description")) project.description = val("project_description") ?? "";
  if (has("language")) project.language = val("language");
  // runtime: only emitted when non-empty (templates reference it but the worked
  // example shows it populated; an empty pin is meaningfully "skip"). Deep archetype
  // CLAUDE.md references ${project.runtime} -> emit "" when blank to keep it bound.
  if (has("runtime")) project.runtime = val("runtime") ?? "";
  if (has("package_manager")) project.package_manager = val("package_manager");
  // framework: backend / fullstack questions both write project.framework
  if (has("framework_backend")) project.framework = val("framework_backend");
  else if (has("framework_fullstack")) project.framework = val("framework_fullstack");
  if (has("architecture")) project.architecture = val("architecture");
  managed.project = orderKeys(project, PROJECT_KEY_ORDER);

  // --- archetype --------------------------------------------------------------
  managed.archetype = archetype;

  // --- features ---------------------------------------------------------------
  managed.features = {
    hooks: boolOr(val("feat_hooks"), true),
    mcp: boolOr(val("feat_mcp"), false),
    agent_teams: boolOr(val("feat_agent_teams"), false),
    sdd_gate: boolOr(val("feat_sdd_gate"), true),
  };

  // --- api_first (deep archetypes only) --------------------------------------
  if (has("api_first")) managed.api_first = boolOr(val("api_first"), true);

  // --- persistence (deep archetypes only; cascade-gated) ----------------------
  if (has("persistence_enabled")) {
    const persistence = { enabled: boolOr(val("persistence_enabled"), false) };
    if (has("persistence_db")) persistence.db = val("persistence_db");
    if (has("persistence_orm")) persistence.orm = val("persistence_orm");
    if (has("migrations_enabled")) {
      const migrations = { enabled: boolOr(val("migrations_enabled"), false) };
      if (has("migrations_tool")) migrations.tool = val("migrations_tool");
      if (has("migrations_dir")) migrations.dir = val("migrations_dir");
      persistence.migrations = migrations;
    }
    managed.persistence = persistence;
  }

  // --- contract_gate (universal mode + protected_paths; deep: scope/exempt) ----
  const gate = {};
  if (has("gate_mode")) gate.mode = val("gate_mode");
  else gate.mode = "block"; // gate is never vacuous; even sdd_gate=false keeps a recorded mode
  if (has("gate_glob_dialect")) gate.glob_dialect = val("gate_glob_dialect");
  else gate.glob_dialect = "fnmatch";
  gate.protected_paths = resolveProtectedPaths(collected);
  const scope = firstDefined(
    has("gate_scope_backend") ? val("gate_scope_backend") : undefined,
    has("gate_scope_fullstack") ? val("gate_scope_fullstack") : undefined,
  );
  if (scope !== undefined) gate.scope = scope;
  const exempt = firstDefined(
    has("gate_exempt_backend") ? val("gate_exempt_backend") : undefined,
    has("gate_exempt_fullstack") ? val("gate_exempt_fullstack") : undefined,
  );
  if (exempt !== undefined) gate.exempt = exempt;
  if (has("gate_require_approval_by")) {
    gate.require_approval_by = val("gate_require_approval_by");
  }
  managed.contract_gate = gate;

  // --- contracts (per-archetype seed) ----------------------------------------
  managed.contracts = seedContracts(archetype, project.name);

  // --- design_system (fullstack ONLY; forbidden for backend-api) -------------
  if (archetype === "fullstack" && has("design_system_install")) {
    const ds = { install: boolOr(val("design_system_install"), true) };
    if (has("design_system_source")) ds.source = val("design_system_source");
    managed.design_system = ds;
  }

  // --- telemetry (enabled universal; attribution gated on enabled) ------------
  if (has("telemetry_enabled")) {
    const tel = { enabled: boolOr(val("telemetry_enabled"), true) };
    if (has("telemetry_attr_mode")) {
      const attr = { mode: val("telemetry_attr_mode") };
      if (has("telemetry_branch_prefix")) {
        attr.branch_prefix = val("telemetry_branch_prefix");
      }
      if (has("telemetry_default_bucket")) {
        attr.default_bucket = val("telemetry_default_bucket");
      }
      tel.attribution = attr;
    }
    if (has("telemetry_pricing_ref")) tel.pricing_ref = val("telemetry_pricing_ref");
    managed.telemetry = tel;
  }

  // --- discovery (default off; forkability I7) --------------------------------
  if (has("discovery_enabled")) {
    managed.discovery = { enabled: boolOr(val("discovery_enabled"), false) };
  }

  // --- ci_cd ------------------------------------------------------------------
  if (has("ci_cd_target")) managed.ci_cd = { target: val("ci_cd_target") };

  // --- rendered_files: ownership ledger, written by the renderer, not here ----
  managed.rendered_files = [];

  return orderKeys(managed, MANAGED_KEY_ORDER);
}

function resolveArchetype(answers, questions) {
  if (answers && answers.archetype) return answers.archetype;
  const q = questions.find((x) => x.id === "archetype");
  return q ? q.default : undefined;
}

// protected_paths is REQUIRED non-empty (schema I4). One of three per-archetype
// questions supplies it; fall back to ["src/**"] if all are absent (sdd_gate off).
function resolveProtectedPaths(collected) {
  const pick = firstDefined(
    collected.gate_protected_paths_backend,
    collected.gate_protected_paths_fullstack,
    collected.gate_protected_paths_core,
  );
  if (Array.isArray(pick) && pick.length > 0) return pick;
  return ["src/**"];
}

function firstDefined(...vals) {
  for (const v of vals) if (v !== undefined) return v;
  return undefined;
}

function boolOr(v, fallback) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

// orderKeys: rebuild an object with keys in the given canonical order; any key not
// in the order list is appended afterwards (stable, but the manifest never has those).
function orderKeys(obj, order) {
  const out = {};
  for (const k of order) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  for (const k of Object.keys(obj)) {
    if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = obj[k];
  }
  return out;
}

// -----------------------------------------------------------------------------
// manifest_hash: sha256 over the canonical (compact, key-sorted) managed: subtree,
// EXCLUDING manifest_hash itself. generator.* is not in managed: so it is already
// excluded. Output: "sha256:<64 lowercase hex>" (matches schema pattern).
// -----------------------------------------------------------------------------

export function computeManifestHash(managed) {
  const clone = structuredClone(managed);
  delete clone.manifest_hash;
  const canonical = canonicalJson(clone);
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `sha256:${digest}`;
}

// Deterministic compact JSON with recursively sorted object keys. Arrays keep order.
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") +
    "}"
  );
}

// -----------------------------------------------------------------------------
// validateManifest: validate the FULL manifest against the frozen JSON-Schema
// (draft 2020-12). manifest_hash is pattern-checked, so it must be set first.
// -----------------------------------------------------------------------------

export function validateManifest(schema, manifest) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const valid = validate(manifest);
  return { valid, errors: validate.errors || [] };
}

export function formatAjvErrors(errors) {
  if (!errors || !errors.length) return "(no details)";
  return errors
    .map((e) => `  ${e.instancePath || "(root)"} ${e.message}`)
    .join("\n");
}

// -----------------------------------------------------------------------------
// buildManifest: assemble managed:, validate (pre-hash), set manifest_hash,
// re-validate (hash pattern), then wrap with schema_version + generator + user.
//
// opts: { questions, schema, toolVersion, existingUser }
//   existingUser: carry an already-seeded user: block verbatim on re-runs (I2).
// -----------------------------------------------------------------------------

export function buildManifest(answers, opts = {}) {
  const { questions, schema, toolVersion, existingUser } = opts;
  if (!questions) throw new Error("buildManifest requires opts.questions");
  if (!schema) throw new Error("buildManifest requires opts.schema");

  const managed = assembleManaged(answers, { questions });

  // user: seeded once, never overwritten thereafter.
  const user =
    existingUser && typeof existingUser === "object"
      ? existingUser
      : { notes: "", overrides: {} };

  // Validate the managed shape BEFORE committing the hash (placeholder hash is a
  // valid sha256 pattern only after we set it, so validate the assembled body via
  // a probe with a deterministic placeholder that satisfies the pattern).
  managed.manifest_hash = "sha256:" + "0".repeat(64);
  let manifest = {
    schema_version: 2,
    managed,
    user,
  };
  let { valid, errors } = validateManifest(schema, manifest);
  if (!valid) {
    const err = new Error(
      "assembled manifest failed schema validation (invariant I6):\n" +
        formatAjvErrors(errors),
    );
    err.ajvErrors = errors;
    throw err;
  }

  // Now set the REAL content hash (over managed minus the hash field) and attach
  // provenance. generator.* never participates in the hash.
  managed.manifest_hash = computeManifestHash(managed);

  manifest = {
    schema_version: 2,
    generator: {
      tool: "ai-core-kit",
      tool_version: toolVersion || "0.0.0",
      rendered_at: new Date().toISOString(),
    },
    managed,
    user,
  };

  // Final validation including the real hash + generator block.
  ({ valid, errors } = validateManifest(schema, manifest));
  if (!valid) {
    const err = new Error(
      "final manifest failed schema validation (invariant I6):\n" +
        formatAjvErrors(errors),
    );
    err.ajvErrors = errors;
    throw err;
  }

  return manifest;
}

// -----------------------------------------------------------------------------
// Convenience: resolve the kit root (the package directory) from this module's URL.
// lib/manifest.mjs lives at <kitRoot>/lib/, so the kit root is one level up.
// -----------------------------------------------------------------------------

export function kitRootFromHere() {
  const here = fileURLToPath(import.meta.url); // <kitRoot>/lib/manifest.mjs
  return join(here, "..", "..");
}

export { UNKNOWN };
