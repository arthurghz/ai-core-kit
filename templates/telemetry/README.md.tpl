# Telemetry — offline cost & token aggregation for `${project.name}`

> **What this is:** a post-run analysis tool that computes the USD cost of a
> Claude Code run in this project by reading transcript token-usage lines and
> multiplying them by a versioned pricing map. It attributes spend by **model**,
> **feature**, **agent**, and **session**.
>
> **What this is NOT:** a live meter. Hooks cannot see cost (see
> [the issue-11008 limitation](#the-issue-11008-limitation)); every number here
> is derived **offline**, after a session, from the transcript.

`ai-core-kit` installed this telemetry into `${project.name}` because the
project manifest has `telemetry.enabled: true`. The aggregator engine is the
same one the kit uses on itself.

## Files

| File | Role |
|---|---|
| `telemetry/aggregate.py` | stdlib-only offline aggregator (no third-party deps). |
| `telemetry/pricing.json` | versioned model → USD/MTok price map with an `as_of` date. |
| `project.manifest.yaml` (`telemetry.*`) | attribution mode + budgets for this project. |

## The issue-11008 limitation

Claude Code hooks receive only `session_id`, `transcript_path`, `cwd`,
`permission_mode`, and `hook_event_name` — **no token or cost fields**
([anthropics/claude-code#11008](https://github.com/anthropics/claude-code/issues/11008),
open). A hook cannot emit live cost, and `PostToolUse` only fires on tool turns
(text-only turns — often the majority — would be invisible). So **all** cost is
computed here, offline, from the assistant `message.usage` lines × `pricing.json`.
Every assistant turn carries a usage line, so this captures 100% of spend.

## How cost is computed

| `message.usage` field | priced at `pricing.json` key |
|---|---|
| `input_tokens` | `input` |
| `output_tokens` | `output` |
| `cache_read_input_tokens` | `cache_read` |
| `cache_creation.ephemeral_5m_input_tokens` | `cache_write_5m` |
| `cache_creation.ephemeral_1h_input_tokens` | `cache_write_1h` |
| `cache_creation_input_tokens` (no split present) | `cache_write_5m` |

Prices are USD per 1,000,000 tokens. A `message.model` absent from `pricing.json`
is a **hard error** that names the model (`unknown_model_policy: error`) — cost is
never silently under-counted.

## Attribution

`--by` picks one or more of `model,feature,agent,session` (default: all four).

- **model** — exact `message.model`. **session** — exact `sessionId`.
- **agent** — `isSidechain`: `main` vs `subagent:<requestId>` (transcripts have no
  agent name; this is the only agent-adjacent signal).
- **feature** — supplied by one of two conventions configured in this project's
  manifest under `telemetry.attribution`:
  - **`branch_prefix`** (default): branch named `<prefix><feature>` →
    feature = branch tail. Your manifest's `branch_prefix` is the prefix.
  - **`sidecar_map`**: a JSON file of `{from,to,bucket}` time windows
    (`--sidecar-map`). A `SessionStart` hook may record `timestamp → contract_id`
    windows (recording time + a label is allowed; recording cost is not).
  - Anything matching no rule lands in `telemetry.attribution.default_bucket`
    — **never silently dropped**.

## Reconciliation

For every axis the tool proves `sum(bucket costs) == grand total` and prints an
`OK`/`MISMATCH` line; the JSON output carries `"reconciled": true|false` and a
mismatch exits non-zero. Trust the breakdown only when it reconciles.

## Running

The aggregator resolves `pricing.json` and `project.manifest.yaml` under
`${CLAUDE_PROJECT_DIR}` automatically (attribution defaults come from the
manifest; CLI flags override them):

```bash
# whole-machine transcripts, all axes, table + JSON:
python3 ${CLAUDE_PROJECT_DIR}/telemetry/aggregate.py

# this project's spend since a date, by feature + agent, JSON only:
python3 ${CLAUDE_PROJECT_DIR}/telemetry/aggregate.py \
  --since 2026-06-01 --by feature,agent --format json

# precise per-contract attribution via a sidecar timestamp→bucket map:
python3 ${CLAUDE_PROJECT_DIR}/telemetry/aggregate.py \
  --sidecar-map ${CLAUDE_PROJECT_DIR}/telemetry/sidecar.local.json --by feature
```

Flags: `--project-dir`, `--since YYYY-MM-DD`, `--pricing`, `--by`,
`--branch-prefix`, `--default-bucket`, `--sidecar-map`, `--manifest`,
`--format table|json|both`.

## Budgets

Declare advisory USD caps in `project.manifest.yaml` under `telemetry.budgets[]`
(scope `project|feature|contract|agent`). Compare a cap to the matching bucket
total from the report. Budgets only **flag** overage — they never block a live
session.

## Locality

Transcripts live under `~/.claude/projects/<encoded-cwd>/…` on the machine that
ran them, so this reads **local** transcripts only. Aggregating across machines
or CI runners requires first collecting the JSONL into one `--project-dir`.

## Keeping pricing current

`pricing.json` carries `as_of` and `source`. When prices change, update those
fields and the affected model rows. If a new model appears in your transcripts
and aborts the run, copy a same-tier row, set its USD/MTok values, and re-run.
