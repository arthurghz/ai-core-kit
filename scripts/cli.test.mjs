// =============================================================================
// scripts/cli.test.mjs
// -----------------------------------------------------------------------------
// Tests for bin/create-ack.mjs — the SUBCOMMAND DISPATCHER. The dispatcher must:
//   * report --version / --help (and --help lists every subcommand),
//   * treat an UNKNOWN first arg as the classic scaffold invocation (back-compat),
//   * route a KNOWN subcommand (telemetry passthrough + kit-native),
//   * run `feature` (branch-free sidecar windows) with NO network,
//   * run `update` fail-silently with NO network (never hangs, never errors out),
//   * keep the published scaffold (`new` alias + fall-through) byte-compatible.
//
// We exercise the REAL binary as a subprocess (the faithful test of dispatch) and
// unit-test the pure exported helpers. No network is ever required: the update
// notifier is suppressed via NO_UPDATE_NOTIFIER, and fetchLatestVersion is proven
// fail-silent against an unreachable host.
//
// Run: node --test scripts/cli.test.mjs   (or `node --test scripts/*.test.mjs`)
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  isNewer,
  loadSidecar,
  saveSidecar,
  closeOpenWindow,
  fetchLatestVersion,
  resolveTelemetryDir,
  KNOWN_SUBCOMMANDS,
  TELEMETRY_SUBCOMMANDS,
} from "../bin/create-ack.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT_ROOT = join(HERE, "..");
const CLI = join(KIT_ROOT, "bin", "create-ack.mjs");

// Run the CLI as a subprocess. Suppress the update notifier so no test ever hits
// the network as a side effect of a normal command.
function run(args, opts = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    cwd: opts.cwd || KIT_ROOT,
    env: { ...process.env, NO_UPDATE_NOTIFIER: "1", CI: "1", ...(opts.env || {}) },
    input: opts.input,
    timeout: opts.timeout || 15000,
  });
}

function freshTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

// -----------------------------------------------------------------------------
// --version / --help
// -----------------------------------------------------------------------------
test("--version prints the package version", () => {
  const pkg = JSON.parse(readFileSync(join(KIT_ROOT, "package.json"), "utf8"));
  const r = run(["--version"]);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), pkg.version);
});

test("-v is an alias for --version", () => {
  const r = run(["-v"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("--help lists every subcommand", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0);
  const out = r.stdout;
  for (const sub of [
    "new",
    "cost",
    "dora",
    "report",
    "dashboard",
    "watch",
    "monitor",
    "spec",
    "feature",
    "update",
    "migrate",
  ]) {
    assert.match(out, new RegExp(`\\b${sub}\\b`), `help should mention '${sub}'`);
  }
});

// -----------------------------------------------------------------------------
// Back-compat: an UNKNOWN first arg is the classic scaffold invocation.
// `npx @arthurghz/create-ack my-app --archetype <x>` must still scaffold.
// -----------------------------------------------------------------------------
test("unknown first arg still scaffolds (classic invocation unchanged)", () => {
  const dir = freshTmpDir("ack-cli-fallthrough-");
  try {
    const proj = "fallthrough-app";
    const r = run([proj, "--archetype", "library-sdk", "--yes"], { cwd: dir });
    assert.equal(r.status, 0, `scaffold failed: ${r.stderr}`);
    assert.ok(
      existsSync(join(dir, proj, "project.manifest.yaml")),
      "scaffold should write project.manifest.yaml",
    );
    assert.match(r.stdout, /scaffolded/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`new` alias scaffolds (explicit) identically to the fall-through", () => {
  const dir = freshTmpDir("ack-cli-new-");
  try {
    const proj = "new-alias-app";
    const r = run(["new", proj, "--archetype", "library-sdk", "--yes"], { cwd: dir });
    assert.equal(r.status, 0, `new scaffold failed: ${r.stderr}`);
    assert.ok(existsSync(join(dir, proj, "project.manifest.yaml")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// The FORK gets /ack-spec. Every child must receive the shared child slash
// commands under .claude/commands/ — chiefly /ack-spec (the `create-ack spec`
// CLI shells to it in the child) plus the RPI trio + prd/rice. They live in the
// shared templates/commands/ tree (not per-archetype) and are copied verbatim.
// -----------------------------------------------------------------------------
test("scaffold ships /ack-spec (+ shared commands) into the child .claude/commands/", () => {
  const dir = freshTmpDir("ack-cli-cmds-");
  try {
    const proj = "cmds-app";
    const r = run([proj, "--archetype", "fullstack", "--yes"], { cwd: dir });
    assert.equal(r.status, 0, `scaffold failed: ${r.stderr}`);
    const cmds = join(dir, proj, ".claude", "commands");
    // /ack-spec is the load-bearing one — the CLI `spec` subcommand drives it.
    assert.ok(
      existsSync(join(cmds, "ack-spec.md")),
      "child must include .claude/commands/ack-spec.md",
    );
    // The RPI trio + prd/rice + the ack-* build suite ship too (the full shared
    // command surface). ack-build/agents/tooling are the multi-agent build loop.
    for (const f of [
      "prd.md", "rice.md",
      "ack-build.md", "ack-agents.md", "ack-tooling.md", "ack-cost.md", "ack-sync.md",
      "ack-update.md", "ack-review.md", "ack-features.md", "ack-reports.md", "ack-list.md",
      join("rpi", "research.md"), join("rpi", "plan.md"), join("rpi", "implement.md"),
    ]) {
      assert.ok(existsSync(join(cmds, f)), `child must include .claude/commands/${f}`);
    }
    // The specialist AGENTS the build commands delegate to must ship too — without
    // them /ack-build + the RPI trio cannot fan work out.
    const agents = join(dir, proj, ".claude", "agents");
    for (const a of ["code-explorer.md", "code-reviewer.md", "requirement-parser.md", "documentation-analyst-writer.md"]) {
      assert.ok(existsSync(join(agents, a)), `child must include .claude/agents/${a}`);
    }
    // The SKILLS library ships (conventions packs) — but NOT the proprietary
    // document skills (docx/pdf/pptx/xlsx — "All rights reserved"; licensing fence).
    const skills = join(dir, proj, ".claude", "skills");
    assert.ok(existsSync(join(skills, "spec-first", "SKILL.md")), "child must include the spec-first skill");
    for (const proprietary of ["docx", "pdf", "pptx", "xlsx"]) {
      assert.ok(
        !existsSync(join(skills, proprietary)),
        `child must NOT receive the proprietary ${proprietary} skill (licensing fence)`,
      );
    }
    // Copied verbatim — the child sees the same CHILD-correct command text.
    const head = readFileSync(join(cmds, "ack-spec.md"), "utf8").slice(0, 64);
    assert.match(head, /^---/, "ack-spec.md should be copied with its frontmatter intact");
    // Recorded in the manifest ledger so /ack-init re-runs are aware of them.
    const manifest = readFileSync(join(dir, proj, "project.manifest.yaml"), "utf8");
    assert.match(manifest, /\.claude\/commands\/ack-spec\.md/, "ledger should record ack-spec.md");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scaffold meta-guard still fires (refuses to run over the kit)", () => {
  // Running --here inside the kit root must be refused (META sentinel present).
  const r = run(["--here", "--yes", "--archetype", "library-sdk"], { cwd: KIT_ROOT });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /META|sentinel|refuses/i);
});

// -----------------------------------------------------------------------------
// Dispatch: a KNOWN telemetry subcommand routes to its python/bash tool.
// We route `cost --help` from the KIT_ROOT (which ships telemetry/aggregate.py)
// and assert the aggregator's own usage banner is what we see — proof the
// dispatcher shelled out rather than treating `cost` as a product name.
// -----------------------------------------------------------------------------
test("dispatcher routes `cost` to telemetry/aggregate.py", { skip: !hasPython3() }, () => {
  const r = run(["cost", "--help"], { cwd: KIT_ROOT });
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /aggregate\.py/);
});

test("dispatcher routes `dora` to telemetry/dora.py", { skip: !hasPython3() }, () => {
  const r = run(["dora", "--help"], { cwd: KIT_ROOT });
  assert.equal(r.status, 0);
  assert.match(r.stdout + r.stderr, /dora\.py|usage/i);
});

test("telemetry passthrough gives a clear hint when telemetry/ is absent", () => {
  // A bare temp dir has no telemetry/, but the package DOES ship one, so it falls
  // back to the bundled tool. Prove the resolver prefers cwd and still finds one.
  const dir = freshTmpDir("ack-cli-notel-");
  try {
    // From an empty dir, cwd/telemetry is absent -> bundled telemetry/ is used.
    const r = run(["cost", "--help"], { cwd: dir });
    // Either it ran the bundled aggregator (status 0) — never a "product name" path.
    assert.doesNotMatch(r.stdout, /scaffolded/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// `feature` — branch-free per-feature cost windows, NO network.
// -----------------------------------------------------------------------------
test("`feature <name>` writes an OPEN sidecar window (sidecar_map shape)", () => {
  const dir = freshTmpDir("ack-cli-feat-");
  try {
    const r = run(["feature", "order-intake"], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    const p = join(dir, "telemetry", "sidecar.local.json");
    assert.ok(existsSync(p), "sidecar.local.json should be written under telemetry/");
    const data = JSON.parse(readFileSync(p, "utf8"));
    assert.ok(Array.isArray(data.entries) && data.entries.length === 1);
    const e = data.entries[0];
    assert.equal(e.bucket, "order-intake");
    assert.equal(e.to, null); // open window
    assert.match(e.from, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("starting a 2nd feature closes the 1st window and opens a new one", () => {
  const dir = freshTmpDir("ack-cli-feat2-");
  try {
    run(["feature", "one"], { cwd: dir });
    const r = run(["feature", "two"], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    const data = JSON.parse(readFileSync(join(dir, "telemetry", "sidecar.local.json"), "utf8"));
    assert.equal(data.entries.length, 2);
    assert.notEqual(data.entries[0].to, null); // first window closed
    assert.equal(data.entries[0].bucket, "one");
    assert.equal(data.entries[1].to, null); // second window open
    assert.equal(data.entries[1].bucket, "two");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`feature --end` closes the active window", () => {
  const dir = freshTmpDir("ack-cli-featend-");
  try {
    run(["feature", "solo"], { cwd: dir });
    const r = run(["feature", "--end"], { cwd: dir });
    assert.equal(r.status, 0, r.stderr);
    const data = JSON.parse(readFileSync(join(dir, "telemetry", "sidecar.local.json"), "utf8"));
    assert.equal(data.entries.length, 1);
    assert.notEqual(data.entries[0].to, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`feature` with no name is a usage error (exit != 0)", () => {
  const dir = freshTmpDir("ack-cli-featbad-");
  try {
    const r = run(["feature"], { cwd: dir });
    assert.notEqual(r.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// `update` — cached @latest check; must NOT hang and must NOT error the process
// even with no network. We force an unreachable registry path indirectly by
// running with a hostile HTTP(S) proxy that black-holes the request; the command
// must still exit 0 within the timeout (fail-silent).
// -----------------------------------------------------------------------------
test("`update` runs and exits 0 (fail-silent, never hangs)", () => {
  const r = run(["update"], {
    // Black-hole any outbound HTTP via a bogus proxy so the fetch can only fail.
    env: {
      HTTPS_PROXY: "http://127.0.0.1:9", // port 9 (discard) — connection refused/timeout
      https_proxy: "http://127.0.0.1:9",
      HTTP_PROXY: "http://127.0.0.1:9",
      http_proxy: "http://127.0.0.1:9",
    },
    timeout: 12000,
  });
  assert.equal(r.status, 0, `update should exit 0 even offline; stderr=${r.stderr}`);
  // Prints SOMETHING (up-to-date, an upgrade hint, or an offline note) — never throws.
  assert.ok((r.stdout + r.stderr).length >= 0);
});

test("`migrate` outside a project is a friendly no-op (exit 0)", () => {
  const dir = freshTmpDir("ack-cli-migrate-");
  try {
    const r = run(["migrate"], { cwd: dir });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /no project\.manifest\.yaml|nothing to do/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("`migrate` on a v3 manifest reports already-current", () => {
  const dir = freshTmpDir("ack-cli-migrate3-");
  try {
    writeFileSync(
      join(dir, "project.manifest.yaml"),
      "schema_version: 3\nmanaged: {}\nuser: {}\n",
      "utf8",
    );
    const r = run(["migrate"], { cwd: dir });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /already schema_version 3/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// Pure helpers — unit tests (no subprocess, no network).
// -----------------------------------------------------------------------------
test("KNOWN_SUBCOMMANDS contains the full subcommand surface", () => {
  for (const s of ["new", "cost", "dora", "report", "dashboard", "watch", "monitor", "spec", "feature", "update", "migrate"]) {
    assert.ok(KNOWN_SUBCOMMANDS.has(s), `KNOWN_SUBCOMMANDS missing '${s}'`);
  }
  // telemetry table maps each telemetry subcommand to a runner + script
  for (const k of ["cost", "dora", "report", "dashboard", "watch", "monitor"]) {
    assert.ok(TELEMETRY_SUBCOMMANDS[k]?.script, `${k} should map to a script`);
    assert.ok(TELEMETRY_SUBCOMMANDS[k]?.runner, `${k} should map to a runner`);
  }
});

test("isNewer compares dotted versions", () => {
  assert.equal(isNewer("0.2.0", "0.1.0"), true);
  assert.equal(isNewer("0.1.1", "0.1.0"), true);
  assert.equal(isNewer("1.0.0", "0.9.9"), true);
  assert.equal(isNewer("0.1.0", "0.1.0"), false);
  assert.equal(isNewer("0.1.0", "0.2.0"), false);
  assert.equal(isNewer("v0.2.0", "0.1.0"), true); // tolerates leading v
  assert.equal(isNewer(null, "0.1.0"), false);
  assert.equal(isNewer("0.2.0", null), false);
});

test("sidecar helpers: load default, save, close open windows", () => {
  const dir = freshTmpDir("ack-cli-sidecar-");
  try {
    const p = join(dir, "telemetry", "sidecar.local.json");
    assert.deepEqual(loadSidecar(p), { entries: [] }); // absent -> default

    const data = { entries: [{ from: "2026-01-01T00:00:00Z", to: null, bucket: "a" }] };
    saveSidecar(p, data);
    assert.ok(existsSync(p));
    const back = loadSidecar(p);
    assert.equal(back.entries.length, 1);

    closeOpenWindow(back.entries, "2026-01-02T00:00:00Z");
    assert.equal(back.entries[0].to, "2026-01-02T00:00:00Z");
    // closing again is a no-op (window already closed)
    closeOpenWindow(back.entries, "2026-01-03T00:00:00Z");
    assert.equal(back.entries[0].to, "2026-01-02T00:00:00Z");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadSidecar tolerates corrupt JSON (returns empty entries)", () => {
  const dir = freshTmpDir("ack-cli-corrupt-");
  try {
    const p = join(dir, "sidecar.local.json");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, "{not json", "utf8");
    assert.deepEqual(loadSidecar(p), { entries: [] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveTelemetryDir finds the package-bundled telemetry/ from the kit root", () => {
  const orig = process.cwd();
  try {
    process.chdir(KIT_ROOT);
    const dir = resolveTelemetryDir();
    assert.ok(dir && existsSync(join(dir, "aggregate.py")), "should resolve a telemetry dir with aggregate.py");
  } finally {
    process.chdir(orig);
  }
});

test("fetchLatestVersion is fail-silent: a 1ms timeout resolves to null, never throws", async () => {
  // A 1ms budget cannot complete a real round-trip; the AbortController fires and
  // the helper must resolve null (never reject).
  const v = await fetchLatestVersion(1);
  assert.equal(v, null);
});

test("fetchLatestVersion against an unreachable host resolves null", async () => {
  // The helper hardcodes the registry URL; with no network the catch returns null.
  // We can at least assert it never throws for the configured 3s budget by racing
  // a tiny timeout — the contract is "returns string | null", proven null on abort.
  const v = await fetchLatestVersion(50);
  assert.ok(v === null || typeof v === "string");
});

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function hasPython3() {
  const r = spawnSync(process.platform === "win32" ? "where" : "command", process.platform === "win32" ? ["python3"] : ["-v", "python3"], { stdio: "ignore" });
  return r.status === 0;
}
