# Telemetry — offline cost & token aggregation (META layer)

> **What this is:** a post-run analysis tool that computes the USD cost of a
> Claude Code run by reading transcript token-usage lines and multiplying them
> by a versioned pricing map. It attributes spend by **model**, **feature**,
> **agent**, and **session**.
>
> **What this is NOT:** a live meter. There is no live cost API and hooks cannot
> see cost (see [the issue-11008 limitation](#the-issue-11008-limitation)). All
> numbers here are derived **offline**, after a session, from the transcript.

This directory is the META-layer telemetry used to measure the cost of building
`ai-core-kit` itself. The **identical engine** ships to forked CHILD projects
under `templates/telemetry/` and is wired by `/ack-init` when
`telemetry.enabled: true` in the child manifest.

## Files

| File | Role |
|---|---|
| `aggregate.py` | stdlib-only offline aggregator (no third-party deps). |
| `pricing.json` | versioned model → USD/MTok price map with an `as_of` date. |
| `README.md` | this document. |

## The issue-11008 limitation

Claude Code hooks (`PreToolUse`, `PostToolUse`, …) receive only
`session_id`, `transcript_path`, `cwd`, `permission_mode`, and
`hook_event_name`. **They carry no token or cost fields**
([anthropics/claude-code#11008](https://github.com/anthropics/claude-code/issues/11008),
open). Therefore:

- A hook **cannot** emit a live cost number, and `PostToolUse` cannot meter spend.
- `PostToolUse` only fires on **tool** turns. In a representative transcript,
  61 of 98 assistant turns were **text-only** (no tool call) — invisible to
  `PostToolUse`. Apportioning cost by tool activity would silently drop the
  majority of spend.

**The fix this directory implements:** compute *all* cost from the assistant
`message.usage` lines in the transcript (every assistant turn has one, tool or
not) multiplied by `pricing.json`. This captures 100% of spend and is fully
reproducible offline.

## How cost is computed

For each `assistant` line, `message.usage` provides the token counts and
`message.model` selects the price row:

| usage field | priced at `pricing.json` key |
|---|---|
| `input_tokens` | `input` |
| `output_tokens` | `output` |
| `cache_read_input_tokens` | `cache_read` |
| `cache_creation.ephemeral_5m_input_tokens` | `cache_write_5m` |
| `cache_creation.ephemeral_1h_input_tokens` | `cache_write_1h` |
| `cache_creation_input_tokens` (when no `cache_creation` split is present) | `cache_write_5m` (default ephemeral) |

Prices are **USD per 1,000,000 tokens (MTok)**; the aggregator divides by 1e6.
Every model that appears in a transcript **must** be present in `pricing.json`,
or the run aborts (see [fail-loud](#fail-loud-guarantees)).

## Attribution axes

`--by` selects one or more of `model,feature,agent,session` (default: all four).

- **model** — keyed on the exact `message.model` id. Always exact and reliable.
- **session** — keyed on `sessionId`. Always reliable.
- **agent** — transcripts have no agent *name*, so we use the one agent-adjacent
  signal that exists: `isSidechain`. A non-sidechain turn buckets to `main`; a
  sidechain (subagent / `Task`) turn buckets to `subagent:<requestId>`. This
  separates main-session spend from delegated-subagent spend.
- **feature** — transcripts carry **no native feature field**, so a feature must
  be supplied by one of two explicit conventions below. Anything that matches no
  rule lands in the **default bucket** (never silently dropped).

### feature attribution: `branch_prefix` vs `sidecar_map`

Two mutually exclusive ways to derive a feature label:

**1. `branch_prefix` (default; zero extra tooling).** Work each feature on its
own branch named `<prefix><feature>`, e.g. `feat/order-intake`. With
`--branch-prefix feat/` the turn's `gitBranch` field after the prefix becomes the
bucket → `order-intake`. Branches that don't match the prefix (`main`, `HEAD`,
detached) fall to the default bucket.

```
gitBranch = "feat/order-intake"   --branch-prefix "feat/"   →  bucket "order-intake"
gitBranch = "main"                                            →  bucket "<default>"
```

**2. `sidecar_map` (precise; needs a tiny recorder).** A JSON file maps time
windows to bucket labels. A turn whose `timestamp` falls in `[from, to)` buckets
to that entry. Because a hook *can* legitimately record a `timestamp → contract_id`
mapping at session start/stop (it just can't record cost), a `SessionStart`
hook can append windows to this file as the contract under work changes.

```json
{
  "entries": [
    {"from": "2026-05-19T16:40:00Z", "to": "2026-05-19T16:55:00Z", "bucket": "C-001-order-intake"},
    {"from": "2026-05-21T09:00:00Z", "to": null,                   "bucket": "C-007-telemetry"}
  ]
}
```

Pass it with `--sidecar-map sidecar.json`; this overrides `branch_prefix`.

## Reconciliation guarantee

For **every** axis, the aggregator proves that the sum of the per-bucket costs
equals the grand total (within float epsilon). The human table prints a
`reconcile vs total … OK` line per axis, the JSON output carries a top-level
`"reconciled": true|false`, and **a mismatch exits non-zero**. This is what makes
the breakdown trustworthy: no spend is invented, double-counted, or lost. The
default bucket guarantees the identity holds even when nothing matches a feature
or agent rule.

## Fail-loud guarantees

- **Unknown model** → hard error naming the offending `message.model`, listing
  the known ids, exit `1` (`unknown_model_policy: error` in `pricing.json`).
  Cost is never silently under-counted because a new model slipped in.
- **Missing / invalid `pricing.json`** → hard error, exit `1`.
- **Bucket sums don't reconcile** → hard error, exit `1`.
- **Bad `--by` axis / missing sidecar file** → usage error, exit `2`.
- A single malformed JSONL *line* is skipped (not fatal) so one bad line can't
  void an otherwise complete report.

## Running

```bash
# whole machine, default ~/.claude/projects, all four axes, table + JSON:
python3 telemetry/aggregate.py

# this build only, since a date, feature + model + agent, JSON only:
python3 telemetry/aggregate.py \
  --project-dir ~/.claude/projects \
  --since 2026-06-01 \
  --by feature,model,agent \
  --branch-prefix feat/ \
  --format json

# precise feature attribution via a sidecar timestamp→contract map:
python3 telemetry/aggregate.py --sidecar-map telemetry/sidecar.local.json --by feature
```

Key flags: `--project-dir` (glob root for `**/*.jsonl`), `--since YYYY-MM-DD`
(UTC), `--pricing PATH` (default `./pricing.json`), `--by` (axes),
`--branch-prefix`, `--default-bucket` (default `unattributed`), `--sidecar-map`,
`--manifest` (CHILD only — reads `telemetry.*` defaults; CLI flags win),
`--format table|json|both`.

## Locality note

Transcripts live under `~/.claude/projects/<encoded-cwd>/…`, so this tool reads
**local** transcripts only. A fork built on another machine writes under that
machine's encoded path; aggregating across machines requires first collecting
the JSONL into one `--project-dir`. There is no network/collection step here by
design — this stays a fully offline, single-machine tool unless you stage files.

## Budgets

`pricing.json` produces actuals. **Budgets** (advisory USD caps) live in the
CHILD manifest under `telemetry.budgets[]` (scope `project|feature|contract|agent`).
The aggregator's per-bucket totals are what you compare against those caps; caps
are advisory — they FLAG overage, they do not enforce or block anything live.
