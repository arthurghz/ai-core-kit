// =============================================================================
// scripts/manifest.test.mjs
// -----------------------------------------------------------------------------
// Tests for lib/manifest.mjs — the deterministic manifest assembler that backs
// the create-ack CLI. Covered: I1 writes_to integrity, archetype branching,
// ask_if/skip_if + unknown-sentinel gating, per-archetype seeds, hash determinism,
// user: seed/carry, and schema validation (I6).
//
// Run: node --test scripts/manifest.test.mjs   (or `npm test`)
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import {
  loadQuestionBank,
  loadSchema,
  verifyWritesTo,
  filterQuestions,
  evalPredicate,
  assembleManaged,
  buildManifest,
  validateManifest,
  computeManifestHash,
  kitRootFromHere,
} from "../lib/manifest.mjs";

const kitRoot = kitRootFromHere();
const bank = loadQuestionBank(kitRoot);
const questions = bank.questions;
const schema = loadSchema(kitRoot);

function mk(answers) {
  return buildManifest(answers, { questions, schema, toolVersion: "0.1.0-test" });
}

// -----------------------------------------------------------------------------
// I1: every writes_to resolves to a schema property under managed:.
// -----------------------------------------------------------------------------
test("I1: verifyWritesTo accepts the frozen question bank (no orphans)", () => {
  assert.doesNotThrow(() => verifyWritesTo(questions, schema));
});

test("I1: verifyWritesTo HARD-REFUSES an orphan writes_to", () => {
  const bad = [{ id: "x", writes_to: "project.not_a_real_key" }];
  assert.throws(() => verifyWritesTo(bad, schema), /invariant I1/);
});

// -----------------------------------------------------------------------------
// Predicate grammar + unknown sentinel.
// -----------------------------------------------------------------------------
test("predicate: == / != with known value", () => {
  assert.equal(evalPredicate("p == true", { p: true }), true);
  assert.equal(evalPredicate("p != true", { p: true }), false);
  assert.equal(evalPredicate("p == false", { p: true }), false);
});

test("predicate: in / not_in lists", () => {
  assert.equal(evalPredicate("m in [branch_prefix, sidecar_map]", { m: "branch_prefix" }), true);
  assert.equal(evalPredicate("m not_in [a, b]", { m: "branch_prefix" }), true);
  assert.equal(evalPredicate("m in [a, b]", { m: "branch_prefix" }), false);
});

test("predicate: unknown sentinel is fail-safe (== false, != true)", () => {
  assert.equal(evalPredicate("missing == true", {}), false);
  assert.equal(evalPredicate("missing != true", {}), true);
  assert.equal(evalPredicate("missing in [a]", {}), false);
  assert.equal(evalPredicate("missing not_in [a]", {}), true);
});

test("predicate: loose equality across bool/string", () => {
  assert.equal(evalPredicate("p == true", { p: true }), true);
  assert.equal(evalPredicate("p == true", { p: "true" }), true);
});

// -----------------------------------------------------------------------------
// Question gating: applies_to (archetype) then ask_if/skip_if.
// -----------------------------------------------------------------------------
test("gating: persistence cascade — DB questions skip when persistence disabled", () => {
  const ids = filterQuestions(questions, "backend-api", {
    archetype: "backend-api",
    persistence_enabled: false,
  }).map((q) => q.id);
  assert.ok(ids.includes("persistence_enabled"));
  assert.ok(!ids.includes("persistence_db"));
  assert.ok(!ids.includes("persistence_orm"));
  assert.ok(!ids.includes("migrations_tool"));
});

test("gating: gate questions skip when sdd_gate is false", () => {
  const ids = filterQuestions(questions, "backend-api", {
    archetype: "backend-api",
    feat_sdd_gate: false,
  }).map((q) => q.id);
  assert.ok(!ids.includes("gate_mode"));
  assert.ok(!ids.includes("gate_protected_paths_backend"));
});

test("gating: minimal-core archetype never sees DB/design questions", () => {
  const ids = filterQuestions(questions, "library-sdk", { archetype: "library-sdk" }).map(
    (q) => q.id,
  );
  assert.ok(!ids.includes("persistence_enabled"));
  assert.ok(!ids.includes("design_system_install"));
  assert.ok(!ids.includes("api_first"));
  assert.ok(!ids.includes("framework_backend"));
});

// -----------------------------------------------------------------------------
// Archetype branching + per-archetype shapes.
// -----------------------------------------------------------------------------
test("backend-api: full shape, contract seed, NO design_system", () => {
  const m = mk({ archetype: "backend-api", project_name: "acme-orders-api" }).managed;
  assert.equal(m.archetype, "backend-api");
  assert.equal(m.project.framework, "fastapi");
  assert.equal(m.persistence.enabled, true);
  assert.equal(m.persistence.db, "postgres");
  assert.deepEqual(m.contracts, [
    { id: "C-001-acme-orders-api", scope: ["src/**"], status: "draft" },
  ]);
  assert.ok(!("design_system" in m)); // schema-FORBIDDEN for backend-api
  assert.deepEqual(m.contract_gate.protected_paths, ["src/**", "migrations/**", "openapi/**"]);
});

test("fullstack: design_system REQUIRED, contracts [], framework next", () => {
  const m = mk({ archetype: "fullstack", project_name: "web-app" }).managed;
  assert.equal(m.archetype, "fullstack");
  assert.equal(m.project.framework, "next");
  assert.equal(m.design_system.install, true);
  assert.deepEqual(m.contracts, []);
});

test("Phase B: fullstack design_system.tokens.color_brand seeded to default when install=true", () => {
  // The renderer materializes ${design_system.tokens.color_brand}; the engine has
  // no default syntax, so the assembler MUST always bind it. Default: #0066CC.
  const m = mk({ archetype: "fullstack", project_name: "web-app" }).managed;
  assert.equal(m.design_system.tokens.color_brand, "#0066CC");
});

test("Phase B: confirmed design_brand_color (the /ack-spec answer) materializes into tokens.color_brand", () => {
  const m = mk({ archetype: "fullstack", project_name: "web-app", design_brand_color: "#0B5FFF" }).managed;
  assert.equal(m.design_system.tokens.color_brand, "#0B5FFF");
});

test("Phase B: a carried design_system_tokens map (re-run merge) is preserved verbatim", () => {
  const m = mk({
    archetype: "fullstack",
    project_name: "web-app",
    design_system_tokens: { color_brand: "#112233", radius_base: "0.5rem" },
  }).managed;
  assert.equal(m.design_system.tokens.color_brand, "#112233");
  assert.equal(m.design_system.tokens.radius_base, "0.5rem");
});

test("Phase B: brand color participates in the hash (re-brand => new hash)", () => {
  const a = mk({ archetype: "fullstack", project_name: "web-app", design_brand_color: "#0B5FFF" });
  const b = mk({ archetype: "fullstack", project_name: "web-app", design_brand_color: "#000000" });
  assert.notEqual(a.managed.manifest_hash, b.managed.manifest_hash);
});

test("Phase B: design_system NOT seeded when install=false (var has no .tpl to bind)", () => {
  // With install=false the design-system subtree is omitted (path-segment guard),
  // so there is no template referencing the token — no need to seed it.
  const m = mk({
    archetype: "fullstack",
    project_name: "web-app",
    design_system_install: false,
  }).managed;
  assert.equal(m.design_system.install, false);
  assert.ok(!("tokens" in m.design_system));
});

test("minimal-core (library-sdk): no persistence/api_first/design_system; protected_paths defaulted", () => {
  const m = mk({ archetype: "library-sdk", project_name: "lib-thing" }).managed;
  assert.ok(!("persistence" in m));
  assert.ok(!("api_first" in m));
  assert.ok(!("design_system" in m));
  assert.deepEqual(m.contract_gate.protected_paths, ["src/**"]);
  assert.ok(!("scope" in m.contract_gate)); // deep-only
});

test("gate is never vacuous even when sdd_gate is off", () => {
  const m = mk({
    archetype: "monorepo",
    project_name: "mono",
    feat_sdd_gate: false,
  }).managed;
  assert.equal(m.features.sdd_gate, false);
  assert.ok(m.contract_gate.protected_paths.length >= 1); // schema I4 minItems:1
});

// -----------------------------------------------------------------------------
// Determinism + hash.
// -----------------------------------------------------------------------------
test("I2: identical answers => identical managed + hash", () => {
  const a = mk({ archetype: "backend-api", project_name: "same" }).managed;
  const b = mk({ archetype: "backend-api", project_name: "same" }).managed;
  assert.equal(a.manifest_hash, b.manifest_hash);
  assert.deepEqual(a, b);
});

test("hash: changing an answer changes the hash", () => {
  const a = mk({ archetype: "backend-api", project_name: "alpha" }).managed;
  const b = mk({ archetype: "backend-api", project_name: "beta" }).managed;
  assert.notEqual(a.manifest_hash, b.manifest_hash);
});

test("hash: format is sha256:<64 hex> and excludes manifest_hash itself", () => {
  const m = mk({ archetype: "backend-api", project_name: "h" }).managed;
  assert.match(m.manifest_hash, /^sha256:[0-9a-f]{64}$/);
  // recomputing over the body (hash field stripped) reproduces the stored hash
  assert.equal(computeManifestHash(m), m.manifest_hash);
});

test("hash: generator.* never participates (full manifest has provenance, hash stable)", () => {
  const m1 = mk({ archetype: "backend-api", project_name: "g" });
  // a second build a moment later has a different rendered_at but same hash
  const m2 = mk({ archetype: "backend-api", project_name: "g" });
  assert.equal(m1.managed.manifest_hash, m2.managed.manifest_hash);
});

// -----------------------------------------------------------------------------
// user: seed + carry.
// -----------------------------------------------------------------------------
test("user: seeded once with {notes, overrides}", () => {
  const m = mk({ archetype: "backend-api", project_name: "u" });
  assert.deepEqual(m.user, { notes: "", overrides: {} });
});

test("user: existing block carried verbatim (never overwritten)", () => {
  const existingUser = { notes: "keep me", overrides: { foo: 1 }, extra: true };
  const m = buildManifest(
    { archetype: "backend-api", project_name: "u2" },
    { questions, schema, toolVersion: "0.1.0", existingUser },
  );
  assert.deepEqual(m.user, existingUser);
});

// -----------------------------------------------------------------------------
// I6: schema validation of the assembled manifest.
// -----------------------------------------------------------------------------
test("I6: every archetype produces a schema-valid manifest", () => {
  for (const arch of ["backend-api", "fullstack", "monorepo", "library-sdk", "infra-iac"]) {
    const m = mk({ archetype: arch, project_name: `proj-${arch}` });
    const { valid, errors } = validateManifest(schema, m);
    assert.ok(valid, `${arch} invalid: ${JSON.stringify(errors)}`);
  }
});

test("I6: an invalid project name is rejected by schema validation", () => {
  assert.throws(
    () => mk({ archetype: "backend-api", project_name: "Bad_Name" }),
    /schema validation/,
  );
});

// -----------------------------------------------------------------------------
// description / runtime always bound (templates reference them unconditionally).
// -----------------------------------------------------------------------------
test("project.description + runtime always present (even empty) for deep archetypes", () => {
  const m = mk({ archetype: "backend-api", project_name: "deep" }).managed;
  assert.ok("description" in m.project);
  assert.ok("runtime" in m.project);
});

// -----------------------------------------------------------------------------
// Managed key ordering is canonical (byte-stable YAML).
// -----------------------------------------------------------------------------
test("managed key order follows schema declaration order", () => {
  const m = mk({ archetype: "backend-api", project_name: "order" }).managed;
  const keys = Object.keys(m);
  assert.equal(keys[0], "manifest_hash");
  assert.equal(keys[1], "project");
  assert.equal(keys[2], "archetype");
  assert.equal(keys[3], "features");
});

// assembleManaged is exercised indirectly; a direct smoke test for the export.
test("assembleManaged returns a managed subtree with a placeholder hash", () => {
  const managed = assembleManaged(
    { archetype: "backend-api", project_name: "sm" },
    { questions },
  );
  assert.equal(managed.archetype, "backend-api");
  assert.equal(managed.manifest_hash, ""); // placeholder; buildManifest sets the real one
});
