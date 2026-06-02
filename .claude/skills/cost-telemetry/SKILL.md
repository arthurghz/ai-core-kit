---
name: cost-telemetry
description: Runs the offline ai-core-kit cost aggregator and interprets its output — computes USD spend for a Claude Code run from transcript token-usage lines times a versioned pricing map, attributed by model, feature, agent, and session. TRIGGER when the user asks how much a build/session/feature/agent cost, wants a token or cost breakdown or report, asks to attribute or reconcile spend, mentions telemetry/pricing.json/aggregate.py, or asks why a model is missing from the cost report. SKIP when the user wants a LIVE/real-time cost meter (impossible — see issue 11008; cost is offline only), is editing the contract gate or interview/manifest schema, or is asking about Anthropic API billing rather than this repo's transcript-derived estimate.
---

# cost-telemetry — run & interpret the offline cost aggregator

This skill drives `telemetry/aggregate.py`, the stdlib-only offline cost tool for
the **META** repo. It computes spend from Claude Code transcript `message.usage`
lines × `telemetry/pricing.json` and attributes it by model / feature / agent /
session. See `telemetry/README.md` for the full data contract;
`references/attribution.md` and `references/interpreting-output.md` here are the
operator playbook.

## The one hard constraint (state it before promising live cost)

Cost is **offline only**. Hooks receive no token/cost fields
([issue 11008](https://github.com/anthropics/claude-code/issues/11008), open), and
`/usage` is an interactive TUI an agent cannot query. If the user asks for a live
meter, explain this and offer the offline report instead. Never fabricate a "live"
number.

## When to use

- "How much did this build / session / feature cost?"
- "Break down token spend by model / agent / session."
- "Attribute cost to features" → confirm `branch_prefix` vs `sidecar_map` first.
- "Why is the cost report erroring on a model?" → an unknown model id; see below.

## When NOT to use

- A real-time/streaming cost meter (impossible — explain offline-only).
- Anthropic console/API invoice reconciliation (this is a transcript estimate).
- Editing the contract gate, interview, or manifest schema (different clusters).

## Procedure

1. **Locate the engine.** It lives at `telemetry/aggregate.py` with
   `telemetry/pricing.json` beside it. Confirm `python3` is available (stdlib only;
   no install step).

2. **Pick the scope.**
   - Whole machine: omit `--project-dir` (defaults to `~/.claude/projects`).
   - One build window: add `--since YYYY-MM-DD` (UTC).
   - A specific project's transcripts: `--project-dir <encoded-dir>`.

3. **Pick feature attribution** (only matters for the `feature` axis):
   - Branches named `feat/<feature>` → use `--branch-prefix feat/` (default).
   - A timestamp→contract map exists → `--sidecar-map <file>` (overrides branches).
   - Neither → the `feature` axis collapses to the default bucket; say so plainly.

4. **Run it** (Bash):
   ```bash
   python3 telemetry/aggregate.py --by feature,model,agent,session --format both
   ```
   For a machine-readable result pipe `--format json`.

5. **Interpret** using `references/interpreting-output.md`:
   - Read the GRAND TOTAL and the per-axis tables.
   - **Verify `reconciled: YES`** on every axis — if any axis prints `MISMATCH`
     or the process exits non-zero, the report is NOT trustworthy; investigate
     before quoting numbers.
   - Call out the `unattributed` (default) bucket explicitly — a large default
     bucket means feature attribution is mostly unconfigured, not that work was
     free.

## Failure modes (all fail loud)

- `FATAL: unknown model '<id>' …` (exit 1) → that model has no row in
  `pricing.json`. Add it (copy a same-tier row, set the right USD/MTok values,
  bump `as_of`) and re-run. Never edit the transcript to dodge this.
- `FATAL: bucket sums do not reconcile …` (exit 1) → a real bug; do not report
  the numbers. Escalate.
- `error: unknown axis…` / sidecar not found (exit 2) → fix the flag and re-run.

## Keeping pricing honest

`pricing.json` carries `as_of` and `source`. When prices change, update those
fields and the affected model rows; bump `schema_version` only if the *shape*
changes. The CHILD copy at `templates/telemetry/pricing.json` must stay
shape-identical (same keys, same `unknown_model_policy`).
