// =============================================================================
// scripts/bootstrap-order.test.mjs
// -----------------------------------------------------------------------------
// Phase E — the SPEC-FIRST bootstrap ORDER + IDEMPOTENCY, end-to-end.
//
// These tests spawn the REAL `bin/create-ack.mjs` into an os.tmpdir() target
// (never inside the repo) and assert the docs-first contract the headline goal
// demands: a fresh fork FIRST gets the complete spec SKELETONS + a best
// CLAUDE.md + a "Specs: DRAFT" marker, and is PROMINENTLY directed to /ack-spec
// as the required next step — BEFORE any product code is hand-written. The
// deterministic finalize re-render (the Option-A close of the loop) is exercised
// through the same lib/manifest.mjs + scripts/render.mjs path /ack-init drives,
// proving (d) idempotency and (e) brand-token re-materialization.
//
// Run: node --test scripts/bootstrap-order.test.mjs   (or `npm test`)
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  buildManifest,
  loadQuestionBank,
  loadSchema,
  kitRootFromHere,
} from "../lib/manifest.mjs";
import { renderTree, loadRenderMap } from "./render.mjs";

const kitRoot = kitRootFromHere();
const CREATE_ACK = path.join(kitRoot, "bin", "create-ack.mjs");
const questions = loadQuestionBank(kitRoot).questions;
const schema = loadSchema(kitRoot);
const archetypesDir = path.join(kitRoot, "templates", "archetypes");

// Spawn create-ack into a hermetic tmp CWD (it derives the target dir from CWD +
// product name). Returns { dir, stdout }. NO_COLOR strips ANSI so we can assert
// on the printed next-steps text.
function runCreateAck(name, args) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ack-bo-"));
  const stdout = execFileSync("node", [CREATE_ACK, name, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { dir: path.join(cwd, name), stdout };
}

function readManifest(dir) {
  // Avoid a YAML dep in the test: pull manifest_hash + archetype via regex over
  // the deterministic YAML the writer emits (key: value, two-space indent).
  const raw = fs.readFileSync(path.join(dir, "project.manifest.yaml"), "utf8");
  const hash = (raw.match(/manifest_hash:\s*(sha256:[0-9a-f]{64})/) || [])[1];
  const archetype = (raw.match(/^\s{2}archetype:\s*(\S+)/m) || [])[1];
  return { raw, hash, archetype };
}

// The deterministic FINALIZE re-render the same way /ack-init STEP 7.5 does it:
// feed answers (optionally a confirmed brand) through buildManifest, then
// renderTree into a fresh out dir. Returns { manifest, result, outDir }.
async function deterministicRender(answers, label) {
  const renderMap = await loadRenderMap(archetypesDir);
  const manifest = buildManifest(answers, { questions, schema, toolVersion: "test" });
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `ack-render-${label}-`));
  const result = renderTree({
    manifest,
    managed: manifest.managed,
    archetypesDir,
    outDir,
    renderMap,
    dryRun: false,
  });
  return { manifest, result, outDir };
}

// -----------------------------------------------------------------------------
// (a) The post-render output PROMINENTLY directs the user to /ack-spec first.
// -----------------------------------------------------------------------------
test("bootstrap-order(a): create-ack prints /ack-spec as the REQUIRED next step", () => {
  const { stdout } = runCreateAck("s", ["--archetype", "saas", "--yes"]);
  assert.match(stdout, /REQUIRED NEXT STEP/i, "headline 'REQUIRED NEXT STEP' is printed");
  assert.match(stdout, /\/ack-spec/, "the headline names /ack-spec");
  // /ack-spec must precede the /ack-init finalize line (specs lead, code follows).
  assert.ok(
    stdout.indexOf("/ack-spec") < stdout.indexOf("/ack-init"),
    "/ack-spec is surfaced before the /ack-init finalize step",
  );
  assert.match(stdout, /Specs lead; code follows/i, "the spec-first thesis is stated");
});

// -----------------------------------------------------------------------------
// (b) A specs-pending marker exists in the child.
// -----------------------------------------------------------------------------
test("bootstrap-order(b): a specs-pending marker (specs/.spec-status.md) is laid", () => {
  const { dir } = runCreateAck("s", ["--archetype", "saas", "--yes"]);
  const marker = path.join(dir, "specs", ".spec-status.md");
  assert.ok(fs.existsSync(marker), "specs/.spec-status.md exists");
  const body = fs.readFileSync(marker, "utf8");
  assert.match(body, /Specs: DRAFT/);
  assert.match(body, /\/ack-spec/, "the marker names the required /ack-spec step");
});

// -----------------------------------------------------------------------------
// (c) The spec SKELETONS are present (DESIGN.md, PLAN.md, PRD.md, ...).
// -----------------------------------------------------------------------------
test("bootstrap-order(c): the full spec skeleton set is rendered into specs/", () => {
  const { dir } = runCreateAck("s", ["--archetype", "saas", "--yes"]);
  const specs = path.join(dir, "specs");
  for (const f of [
    "PRD.md",
    "ARCHITECTURE.md",
    "DOMAIN.md",
    "REQUIREMENTS.md",
    "PLAN.md",
    "ROADMAP.md",
    "NON-GOALS.md",
    "DESIGN.md", // design-bearing archetype (saas) gets DESIGN.md
  ]) {
    assert.ok(fs.existsSync(path.join(specs, f)), `specs/${f} present`);
  }
  // CLAUDE.md (the best-in-class lean pointer) is laid at the child root.
  assert.ok(fs.existsSync(path.join(dir, "CLAUDE.md")), "CLAUDE.md present");
  // No raw template suffix leaked through.
  assert.ok(!fs.existsSync(path.join(specs, "PRD.md.tpl")), "no raw .tpl leaked");
});

// -----------------------------------------------------------------------------
// (d) Re-rendering with the SAME inputs is idempotent (hash stable, no dupes).
// -----------------------------------------------------------------------------
test("bootstrap-order(d): create-ack manifest_hash matches a deterministic re-render (no drift)", async () => {
  const { dir } = runCreateAck("s", ["--archetype", "saas", "--yes"]);
  const fromCli = readManifest(dir);
  assert.equal(fromCli.archetype, "saas");
  assert.match(fromCli.hash, /^sha256:[0-9a-f]{64}$/);

  // The same answers through the deterministic assembler reproduce the hash byte
  // for byte (the create-ack default-answer path == buildManifest defaults).
  const { manifest } = await deterministicRender(
    { archetype: "saas", project_name: "s" },
    "idem",
  );
  assert.equal(manifest.managed.manifest_hash, fromCli.hash, "I2: hash is stable across runs");
});

test("bootstrap-order(d): two deterministic renders of the same answers are byte-identical", async () => {
  const a = await deterministicRender({ archetype: "saas", project_name: "s" }, "a");
  const b = await deterministicRender({ archetype: "saas", project_name: "s" }, "b");
  assert.equal(a.manifest.managed.manifest_hash, b.manifest.managed.manifest_hash);
  const css = "design-system/theme/globals.css";
  const ca = fs.readFileSync(path.join(a.outDir, css), "utf8");
  const cb = fs.readFileSync(path.join(b.outDir, css), "utf8");
  assert.equal(ca, cb, "globals.css renders byte-identically (no clobber/dupe)");
  // Default brand materialized to a concrete hex at the substitution point — NOT
  // left as a `${design_system.tokens.color_brand}` expression. (A surviving
  // render PROVES there was no unbound var: the engine throws on any unbound
  // ${...}; the file's own header comment legitimately mentions the literal
  // string `${...}` while documenting that contract, so we assert the SUBSTITUTION
  // SITE specifically, not the absence of the byte-sequence everywhere.)
  assert.match(ca, /--brand:\s*#0066CC/, "default brand #0066CC materialized");
  assert.ok(
    !/--brand:\s*\$\{/.test(ca),
    "the --brand declaration is a concrete hex, not an unsubstituted ${...}",
  );
});

// -----------------------------------------------------------------------------
// (e) A FINALIZE re-render supplying a confirmed brand re-materializes the theme.
// -----------------------------------------------------------------------------
test("bootstrap-order(e): finalize with a confirmed brand re-materializes design-system/theme with that hex", async () => {
  const base = await deterministicRender({ archetype: "saas", project_name: "s" }, "base");
  const BRAND = "#0B5FFF";
  const fin = await deterministicRender(
    { archetype: "saas", project_name: "s", design_brand_color: BRAND },
    "fin",
  );

  // The confirmed hex enters managed: through the normal deterministic path.
  assert.equal(fin.manifest.managed.design_system.tokens.color_brand, BRAND);
  assert.notEqual(
    fin.manifest.managed.manifest_hash,
    base.manifest.managed.manifest_hash,
    "a different confirmed brand yields a different hash",
  );

  const css = fs.readFileSync(path.join(fin.outDir, "design-system/theme/globals.css"), "utf8");
  const tokens = fs.readFileSync(
    path.join(fin.outDir, "design-system/theme/theme.tokens.json"),
    "utf8",
  );
  assert.match(css, new RegExp(`--brand:\\s*${BRAND}`), "globals.css carries the confirmed brand");
  assert.match(tokens, new RegExp(`"color_brand":\\s*"${BRAND}"`), "theme.tokens.json carries the brand");
});

test("bootstrap-order(e): the finalize is itself idempotent (same brand => same hash)", async () => {
  const args = { archetype: "saas", project_name: "s", design_brand_color: "#123456" };
  const a = await deterministicRender({ ...args }, "fin1");
  const b = await deterministicRender({ ...args }, "fin2");
  assert.equal(a.manifest.managed.manifest_hash, b.manifest.managed.manifest_hash);
});

// -----------------------------------------------------------------------------
// The unchanged Phase C invariant: a default backend-api carries NO features.iac.
// (Re-asserted end-to-end through the spawned CLI so the bootstrap path is covered,
// not just the unit assembler.)
// -----------------------------------------------------------------------------
test("bootstrap-order: default backend-api manifest has NO features.iac key (byte-stability)", () => {
  const { dir } = runCreateAck("svc", ["--archetype", "backend-api", "--yes"]);
  const { raw } = readManifest(dir);
  assert.ok(!/^\s+iac:/m.test(raw), "no managed.iac / features.iac key in a default backend-api manifest");
});
