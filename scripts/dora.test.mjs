// =============================================================================
// dora.test.mjs  --  node --test wrapper around telemetry/dora.py's self-test
// =============================================================================
// Run:  node --test scripts/dora.test.mjs   (or just `npm test`)
//
// dora.py is stdlib-only PYTHON, so the authoritative correctness proof lives
// in `python3 telemetry/dora.py --selftest`, which pins the four-key MATH on a
// synthetic, git-free fixture (see _selftest() in dora.py). This Node test only
// DRIVES that self-test (so it joins the existing `npm test` suite) and adds a
// few CLI-surface checks: --help documents the heuristics, --json/--prom render
// without crashing on THIS repo, and the prom output is valid exposition text.
//
// We do NOT assert exact metric values on the live repo here -- the live repo's
// git history is not a fixture; correctness is proven by --selftest, not by the
// real numbers (which legitimately drift as the repo evolves).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DORA = path.join(REPO_ROOT, 'telemetry', 'dora.py');

function runDora(args, opts = {}) {
  return spawnSync('python3', [DORA, ...args], {
    cwd: opts.cwd || REPO_ROOT,
    encoding: 'utf8',
    timeout: 60_000,
  });
}

test('dora.py --selftest passes (four-key math on a synthetic fixture)', () => {
  const r = runDora(['--selftest']);
  assert.equal(r.status, 0, `selftest exited non-zero.\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /SELFTEST: PASS/);
});

test('dora.py --help documents the deploy/failure HEURISTICS and their limits', () => {
  const r = runDora(['--help']);
  assert.equal(r.status, 0, r.stderr);
  // The help text must be honest about the proxy nature of the metrics.
  assert.match(r.stdout, /HEURISTIC/i);
  assert.match(r.stdout, /LIMITS/i);
  assert.match(r.stdout, /deploy-tag-glob/);
  assert.match(r.stdout, /--deploy-mode/);
});

test('dora.py --json runs on this repo and emits the four keys', () => {
  const r = runDora(['--since', '1y', '--json']);
  assert.equal(r.status, 0, `dora --json exited non-zero.\nstderr:\n${r.stderr}`);
  const doc = JSON.parse(r.stdout);
  for (const key of [
    'deployment_frequency',
    'lead_time_for_changes',
    'change_failure_rate',
    'mean_time_to_restore',
  ]) {
    assert.ok(doc[key], `missing DORA key block: ${key}`);
  }
  assert.equal(typeof doc.deployment_frequency.deploys, 'number');
  assert.ok(doc.window && typeof doc.window.span_days === 'number');
});

test('dora.py --prom emits valid Prometheus exposition for every ack_dora_* metric', () => {
  const r = runDora(['--since', '1y', '--prom']);
  assert.equal(r.status, 0, `dora --prom exited non-zero.\nstderr:\n${r.stderr}`);
  const out = r.stdout;
  const expected = [
    'ack_dora_deploys_total',
    'ack_dora_deploy_frequency_per_day',
    'ack_dora_deploy_frequency_per_week',
    'ack_dora_lead_time_seconds',
    'ack_dora_change_failure_rate',
    'ack_dora_failed_deploys_total',
    'ack_dora_mttr_seconds',
    'ack_dora_window_span_days',
  ];
  for (const m of expected) {
    // each metric must carry a HELP, a TYPE, and a value line
    assert.match(out, new RegExp(`# HELP ${m} `), `missing HELP for ${m}`);
    assert.match(out, new RegExp(`# TYPE ${m} gauge`), `missing TYPE for ${m}`);
    assert.match(out, new RegExp(`^${m} `, 'm'), `missing sample line for ${m}`);
  }
});

test('dora.py rejects a malformed --since window (fail-loud)', () => {
  const r = runDora(['--since', 'not-a-window']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /FATAL/);
});
