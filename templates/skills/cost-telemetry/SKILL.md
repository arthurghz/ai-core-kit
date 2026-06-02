---
name: cost-telemetry
description: Runs this project's offline cost aggregator and interprets its output — computes USD spend for a Claude Code run from transcript token-usage lines times a versioned pricing map, attributed by model, feature, agent, and session. TRIGGER when the user asks how much a session/feature/agent/the project cost, wants a token or cost breakdown or report, asks to attribute or reconcile spend, mentions telemetry/pricing.json/aggregate.py, or asks why a model is missing from the cost report. SKIP when the user wants a LIVE/real-time cost meter (impossible — see issue 11008; cost is offline only) or is asking about their Anthropic API invoice rather than this project's transcript-derived estimate.
---

# cost-telemetry — run & interpret the offline cost aggregator

This skill drives `telemetry/aggregate.py`, the stdlib-only offline cost tool
shipped into this project by `ai-core-kit`. It computes spend from Claude Code
transcript `message.usage` lines × `telemetry/pricing.json` and attributes it by
model / feature / agent / session. See `telemetry/README.md` for the full
data contract.

## The one hard constraint (state it before promising live cost)

Cost is **offline only**. Hooks receive no token/cost fields
([issue 11008](https://github.com/anthropics/claude-code/issues/11008), open) and
`/usage` is an interactive TUI an agent cannot query. If the user wants a live
meter, explain this and offer the offline report. Never fabricate a live number.

## When to use

- "How much did this session / feature / the project cost so far?"
- "Break token spend down by model / agent / session."
- "Attribute cost to features" → check the manifest's
  `telemetry.attribution.mode` (`branch_prefix` or `sidecar_map`) first.
- "Why is the cost report erroring on a model?" → an unknown model id (see below).

## When NOT to use

- A real-time/streaming cost meter (impossible — explain offline-only).
- Anthropic console/API invoice reconciliation (this is a transcript estimate).

## Procedure

1. **Confirm telemetry is enabled.** `project.manifest.yaml` →
   `telemetry.enabled: true`. If false, the aggregator was not wired; say so.

2. **Pick scope:** omit `--project-dir` for all local transcripts; add
   `--since YYYY-MM-DD` to window a build.

3. **Attribution defaults come from the manifest.** The aggregator reads
   `telemetry.attribution.{mode,branch_prefix,default_bucket}` from
   `${CLAUDE_PROJECT_DIR}/project.manifest.yaml` automatically; CLI flags
   override. For `mode: sidecar_map`, pass `--sidecar-map <file>`.

4. **Run it** (Bash):
   ```bash
   python3 ${CLAUDE_PROJECT_DIR}/telemetry/aggregate.py \
     --by feature,model,agent,session --format both
   ```

5. **Interpret:**
   - Read the GRAND TOTAL and per-axis tables.
   - **Verify `reconciled: YES`** on every axis. If any axis shows `MISMATCH` or
     the process exits non-zero, the report is NOT trustworthy — investigate
     before quoting numbers.
   - Call out the default bucket explicitly: a large `unattributed` (or the
     manifest's `default_bucket`) means feature attribution is mostly
     unconfigured (work on `main`, or no sidecar windows), not that it was free.
   - Compare per-bucket totals to any `telemetry.budgets[]` caps in the manifest
     (advisory only — caps flag overage, they never block).

## Failure modes (all fail loud)

- `FATAL: unknown model '<id>' …` (exit 1) → add a row to `telemetry/pricing.json`
  (copy a same-tier row, set USD/MTok values, bump `as_of`) and re-run. Never
  edit the transcript to dodge this.
- `FATAL: bucket sums do not reconcile …` (exit 1) → do not report the numbers;
  escalate.
- `error: unknown axis…` / sidecar not found (exit 2) → fix the flag and re-run.
