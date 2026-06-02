---
description: Report THIS project's AI spend — cost + tokens per FEATURE and overall, plus delivery (DORA) metrics — from the OFFLINE telemetry tools. It reads the manifest's attribution config, runs telemetry/aggregate.py (cost/tokens by feature, budgets) and telemetry/dora.py (four keys) over local Claude Code transcripts × the versioned pricing.json, and presents one clear report. Cost is OFFLINE-only (there is no live cost API in Claude Code), never a live number. Run in a forked CHILD project. Never run in the ai-core-kit META repo.
argument-hint: "[--by feature|model|day] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--budget]"
allowed-tools: Read, Glob, Bash(python3 *), Bash(ls:*)
disable-model-invocation: true
---

# /ack-cost — what did this project cost? (offline, per-feature + overall)

You are this project's **cost reporter**. Surface the AI spend — money and tokens — broken down
**per feature** and in total, plus the delivery (DORA) metrics, using the project's OFFLINE
telemetry tools. You report; you never invent numbers.

> **Cost is OFFLINE, never live.** Claude Code has no live token/cost API in hooks
> (claude-code#11008). Spend is computed AFTER THE FACT by `telemetry/aggregate.py` over
> `~/.claude/projects/**/*.jsonl` × a versioned `telemetry/pricing.json`. Never claim a live
> cost; if a tool is missing, say so and report what you can. The CLI equivalents are
> `create-ack cost` / `create-ack dora` / `create-ack report`.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--by feature|model|day` — attribution axis for the cost breakdown (default: `feature`).
- `--since` / `--until <YYYY-MM-DD>` — bound the reporting window.
- `--budget` — also show budget status (over/under) when budgets are defined in the manifest.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to
the project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-cost refuses to run inside the ai-core-kit META
repository (it reports a fork's AI spend).` Then end the turn.

---

## STEP 1 — LOCATE THE TELEMETRY TOOLS + CONFIG

- **Glob**/`ls` `telemetry/` — it must hold `aggregate.py`, `dora.py`, and `pricing.json`. If
  `telemetry/` is ABSENT, telemetry was not enabled for this project (`managed.telemetry.enabled`
  is false): tell the user to re-scaffold with telemetry on (or run `create-ack cost` from a
  project that ships `telemetry/`), and STOP.
- Read `project.manifest.yaml` → `managed.telemetry.*`: the attribution `mode`
  (`branch_prefix` or `sidecar_map`), the `branch_prefix` / `default_bucket`, the `pricing_ref`,
  and any `budgets`. These drive how spend maps to features.

---

## STEP 2 — RUN THE COST AGGREGATOR (cost + tokens, by feature)

Run `telemetry/aggregate.py` with the **Bash** tool, passing the manifest so attribution matches
the project's config (do not hardcode the axis — honor `--by` / the manifest):

```bash
python3 telemetry/aggregate.py --manifest project.manifest.yaml --by feature --format md
```

- For `sidecar_map` attribution, add `--sidecar-map telemetry/sidecar.local.json` (the file
  `create-ack feature <name>` maintains). For `branch_prefix`, the manifest's prefix is used.
- Pass through `--since` / `--until` when given. Add `--budget` when the user asked for budgets
  (or when `managed.telemetry.budgets` is non-empty) to show over/under per bucket.
- The tool fails loud on a pricing/transcript mismatch — surface its error rather than masking it.

---

## STEP 3 — RUN DELIVERY (DORA) METRICS

```bash
python3 telemetry/dora.py --format md
```

This computes the four keys (deploy frequency, lead time, change-fail rate, MTTR) from local
git history. Note any caveats the tool prints (e.g. deploy-tag glob assumptions).

---

## STEP 4 — PRESENT ONE CLEAR REPORT

Synthesize the tool outputs into a single, skimmable report:

- **Cost by feature** — a table: feature/bucket · cost (USD) · input/output tokens · % of total.
  Call out the most expensive feature and the `unattributed` bucket (spend that matched no rule —
  it is explicit, never silently dropped).
- **Totals** — overall cost + tokens for the window, and budget status if `--budget`.
- **Delivery (DORA)** — the four keys with their values.
- **One-line takeaways** — e.g. "feature X is 60% of spend", "lead time is N days".

Close with the always-available drill-downs: `create-ack watch` (live per-feature TUI),
`create-ack dashboard --serve` (interactive HTML), and `create-ack feature <name>` to open a
branch-free cost window for the next feature. Reminder: every number here is OFFLINE.
