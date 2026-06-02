---
description: Produce THIS project's combined DELIVERY + COST report — one exec-summary face over the OFFLINE telemetry tools. It reads project.manifest.yaml for attribution config, runs telemetry/report.py (the combined md|html artifact) or the aggregate.py + dora.py engines directly, and presents delivery (DORA four keys), cost by feature with totals, budget status, and 2-3 takeaways. Cost is OFFLINE-only (Claude Code has no live cost API), never a live number. Run in a forked CHILD project. Never run in the ai-core-kit META repo.
argument-hint: "[--format md|html] [--since <d>] [--until <d>]"
allowed-tools: Read, Glob, Bash(python3 *), Bash(create-ack *), Task
disable-model-invocation: true
---

# /ack-reports — the full delivery + cost report (offline)

You are this project's **report face**. Stitch *how fast we ship* (DORA) and *what the AI cost
to ship it* (offline spend) into ONE skimmable exec summary, using the project's telemetry
tools. You report; you never invent a number. This is the FULL report — the cost-only sibling
is `/ack-cost`.

> **Cost is OFFLINE, never live.** Claude Code hooks carry no token/cost fields
> (claude-code#11008), so spend is computed AFTER THE FACT by `telemetry/aggregate.py` over
> `~/.claude/projects/**/*.jsonl` × the versioned `telemetry/pricing.json`. Never claim a live
> cost. CLI equivalents: `create-ack report` (combined) · `create-ack cost` · `create-ack dora`.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--format md|html` — output format. `md` for a PR-comment / terminal summary; `html` writes a
  single self-contained shareable file (inline style + SVG, no deps).
- `--since` / `--until <d>` — bound the window (`YYYY-MM-DD`; `--since` also accepts a relative
  DORA window like `30d`).

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to the
project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-reports refuses to run inside the ai-core-kit META
repository (it reports a fork's delivery + spend).` Then end the turn.

---

## STEP 1 — LOCATE THE TELEMETRY TOOLS + CONFIG

- **Glob**/list `telemetry/` — it must hold `aggregate.py`, `dora.py`, `report.py`, and
  `pricing.json`. If `telemetry/` is ABSENT, telemetry was not enabled for this project
  (`managed.telemetry.enabled` is false): say so plainly, tell the user to re-scaffold with
  telemetry on (or run `create-ack report` from a project that ships `telemetry/`), and STOP.
- Read `project.manifest.yaml` → `managed.telemetry.*`: the attribution `mode`
  (`branch_prefix` or `sidecar_map`), the `branch_prefix` / `default_bucket`, the `pricing_ref`,
  and any `budgets`. These drive how spend maps to features and how budget status is judged.

---

## STEP 2 — GENERATE THE COMBINED REPORT

Prefer the one combiner — it imports the same `aggregate.py` + `dora.py` engines (it duplicates
no math) and resolves the manifest, pricing, and the git repo itself, so it runs clean with no
flags:

```bash
python3 telemetry/report.py --format md
```

- Pass through `--format` (default `md`), `--since`, `--until` from the arguments. Add `--budget`
  / `--bucket-budget NAME=USD` when `managed.telemetry.budgets` is non-empty so budget status
  appears. For `sidecar_map` attribution add `--sidecar-map telemetry/sidecar.local.json`.
- With `--format html`, also pass `--out reports/delivery-cost.html` to write the shareable file;
  name the path you wrote.
- If you need the raw faces (e.g. report.py is missing but the engines are present), run them
  directly and synthesize:
  `python3 telemetry/aggregate.py --manifest project.manifest.yaml --by feature --format md`
  and `python3 telemetry/dora.py --format md`.
- The tools fail loud on a pricing/transcript or DORA-collection mismatch — surface their error
  verbatim rather than masking it.

> **Build with a team, always.** For a large window or a deep narrative, delegate per-axis
> drill-downs via the **/ack-agents** fan-out doctrine (read `.claude/commands/ack-agents.md`):
> a **documentation-analyst-writer** to draft the exec narrative and a **code-explorer** to tie
> the most-expensive feature back to its units. Enable teams first:
> `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

---

## STEP 3 — PRESENT THE EXEC SUMMARY

Distill the tool output into one report, in this order:

- **Delivery (DORA four keys)** — deploy frequency, lead time, change-fail rate, MTTR, with
  values for the window. Note the tool's deploy-proxy caveat (tag vs merge).
- **Cost by feature** — table: feature/bucket · cost (USD) · input/output tokens · % of total.
  Call out the most expensive feature and the `unattributed` bucket (spend that matched no rule —
  explicit, never silently dropped).
- **Totals + budget status** — overall cost + tokens for the window, and over/under per budget
  bucket when budgets are defined.
- **2-3 takeaways** — e.g. "feature X is 60% of spend", "lead time is N days", "change-fail rate
  trending down". Plain, decision-grade sentences.

If you wrote an HTML file, give its path and offer `--format html` to anyone who wants to share
it. Drill-downs: `create-ack watch` (live per-feature TUI), `create-ack dashboard --serve`
(interactive HTML), `create-ack feature <name>` to open the next attribution window.

Doctrine: one report answers "how fast do we ship, and what did it cost?" — and every number in it is OFFLINE.
