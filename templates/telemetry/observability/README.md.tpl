# Observability — three tiers for `${project_name}`

> Observability for a `${project_name}` build is **OFFLINE-first** and **tiered**.
> You do not need Grafana — you do not need any infra at all — to get the full
> cost, token, and DORA picture. Pick the tier that matches how you work; every
> tier reads the same two engines (`telemetry/aggregate.py` for cost+tokens,
> `telemetry/dora.py` for the four DORA keys) and **re-implements no pricing or
> DORA math**.

`ai-core-kit` installed this because the project manifest has
`telemetry.enabled: true`. It is the same tiered model the kit uses to watch the
cost of building itself.

## The honest constraint (read this first)

AI **cost is offline**. Claude Code hooks receive no token or cost fields
([anthropics/claude-code#11008](https://github.com/anthropics/claude-code/issues/11008),
open), so there is **no live per-token meter** and there never can be one. Every
dollar figure here is reconstructed *after the fact* from the transcript JSONL
(`message.usage` × `pricing.json`) — accurate, reconciled, fail-loud, but **never
streamed live**. DORA, by contrast, is **exact**: `dora.py` derives the four keys
from your local git history (and `gh` when present), not from any estimate.

One more locality fact that drives the tiers: **transcripts are machine-local**
(`~/.claude/projects/<encoded-cwd>/…`, see the [telemetry README](../README.md)),
whereas **git history travels with the repo**. That split is why cost monitoring
stays on the developer's box while DORA monitoring can run in CI.

## The three tiers at a glance

| Tier | Infra | What you get | When to use |
|---|---|---|---|
| **Tier 0** — CLI + report (default) | **none** | `aggregate.py` / `dora.py` on the CLI, plus a self-contained HTML/Markdown **report** you can open or attach to a PR | always; the baseline you already have |
| **Tier 1** — scheduled monitor | none new | DORA tracked by a **GitHub Action** (git history is in the runner); cost/budget watched **locally** by `monitor.sh` | you want a recurring check without standing up servers |
| **Tier 2** — Grafana stack | Docker (Prometheus + Grafana) | live-ish dashboards over the same gauges | **opt-in**, for teams already running Grafana |

The tiers are additive, not exclusive — Tier 1 builds on the Tier 0 engines, and
Tier 2 charts the same numbers. Start at Tier 0; reach for Tier 2 only if a
dashboard earns its keep.

---

## Tier 0 — CLI + self-contained report (the default, zero infra)

No containers, no daemons, no pip. Two stdlib scripts and an HTML/Markdown report
generator — what `/ack-init` rendered into this project and what most teams will
ever need.

### The report — one self-contained file

`report.py` renders a single, standalone artifact (no external CSS/JS, no network)
that combines the cost+token breakdown and the DORA four keys into one document
you can open in a browser or paste into a PR:

```bash
# self-contained HTML you can open or attach to a PR
python3 ../report.py --format html --out report.html

# or Markdown, for a comment / commit body / README badge block
python3 ../report.py --format md --out report.md
```

The report imports the same `aggregate.py` and `dora.py` engines — it is a
*view*, not a second source of truth.

### The CLI — the exact, reconciled numbers

```bash
# Per-session token + cost ledger (sorted by spend), reconciled, fail-loud.
python3 ../aggregate.py --by session

# Per-UTC-day time series of tokens + cost, each day split by model
# (also accepts --daily-by feature|agent|session).
python3 ../aggregate.py --by day --daily --daily-by model

# The four DORA keys, exact, from local git (+ gh when present).
python3 ../dora.py                       # tag mode (release tags = deploys)
python3 ../dora.py --deploy-mode merge   # trunk/CD repos (first-parent = deploy)

# Window a billing period with --since / --until (UTC, --until exclusive).
python3 ../aggregate.py --by day --since 2026-06-01 --until 2026-07-01
```

Every bucket — on every axis, in both the table and the JSON — carries token
counts (`input` / `output` / `cache_read` / `cache_write_5m` / `cache_write_1h`)
next to its USD cost, so this is true token-usage accounting, not just a dollar
total. The `day` axis and `--daily` series reconcile to the grand total exactly
like the other axes (turns with no parseable timestamp fall into an explicit
`undated` bucket). Reconciliation failure is the only *unconditional* non-zero
exit; budget overage is reported and only fatal under `--budget-strict`.

---

## Tier 1 — scheduled monitor (zero NEW infra)

Same engines, now running **on a schedule** so a regression or an overage finds
*you*. The split is deliberate and follows the locality fact above:

- **DORA → GitHub Action.** Git history is already checked out in the runner, so
  a scheduled workflow runs `python3 telemetry/dora.py` (`--prom` / `--json`),
  writes the four keys to the **job summary**, and opens an **issue on a
  regression** (a key dropping a rating band). Nothing leaves CI; no transcripts
  are needed. (The workflow lives under `.github/`.)
- **Cost/budget → local monitor.** `monitor.sh` runs `aggregate.py` against your
  **local** transcripts with the manifest's advisory budgets and **flags an
  overage as an ALERT**. This stays on the developer's machine **on purpose**:
  token transcripts are machine-local (claude-code#11008 + the locality note) and
  are **not** present in CI, so a CI job could not price them even if it wanted
  to. Run it from cron, a `SessionStart`/`Stop` hook, or by hand:

```bash
# local cost/budget monitor — reads the manifest budgets, ALERTs on overage
telemetry/monitor.sh
```

- **Live terminal monitor (`watch.py`).** A `top`-style session you keep open — it re-aggregates every few seconds and draws **tokens + cost per feature** (or model/agent/session) in place, with a budget bar. The honest "live" view, since the transcripts are already local:

```bash
# in-place, refresh 5s; also --sort tokens | --budget N | --once
python3 telemetry/watch.py --by feature
```

> **Why the split, restated:** DORA travels with the repo (CI can see it); AI
> cost is reconstructed from machine-local transcripts (CI cannot). Tier 1 puts
> each metric where its data already lives — no new infra, no shipping
> transcripts off the box.

---

## Tier 2 — Prometheus + Grafana stack (opt-in)

**Optional.** Only worth it for teams **already running Grafana** who want the
cost/token/DORA series on a shared dashboard. It stands up a Prometheus + Grafana
+ exporter docker-compose stack and charts the *same* offline numbers — it adds
visualization, not accuracy, and not a live meter.

### Near-real-time, NOT a live meter (the #11008 caveat, again)

The exporter **re-parses the transcript JSONL on each Prometheus scrape**
(TTL-cached) and multiplies usage by `pricing.json`. The dashboard is therefore
**near-real-time** — refreshed every scrape interval (30s by default, bounded by
`ACK_SCRAPE_TTL`) — not a live billing feed. Numbers move as you work and
transcripts grow, with a delay of at most one scrape + one TTL window. This is
the same offline, reconciled, fail-loud cost that `aggregate.py` prints; the
stack just charts it.

### What it reads

| Source | Mounted as | Mode |
|---|---|---|
| `~/.claude/projects` (transcripts) | `/projects` in the exporter | **read-only** |
| `${CLAUDE_PROJECT_DIR}/telemetry/aggregate.py` (cost engine) | `/app/aggregate.py` | read-only |
| `${CLAUDE_PROJECT_DIR}/telemetry/pricing.json` (price map) | `/app/pricing.json` | read-only |
| `${CLAUDE_PROJECT_DIR}/project.manifest.yaml` (`managed.telemetry.budgets[]`) | `/manifest/project.manifest.yaml` | read-only |

The exporter **imports** `load_pricing`, `discover_jsonl`, and `aggregate` from
`aggregate.py` — it never re-implements pricing. Cost logic lives in exactly one
place: this project's `telemetry/aggregate.py`.

### Services & ports

| Service | Image (pinned) | Host port | Purpose |
|---|---|---|---|
| `exporter` | built from `exporter/Dockerfile` (context `telemetry/`) | (internal `9418`) | recompute cost, expose Prometheus gauges |
| `prometheus` | `prom/prometheus:v3.5.3` | `9090` | scrape + store the series (30d retention) |
| `grafana` | `grafana/grafana:12.4.3` | **`3001`** | dashboards (3000 is the docs/app site) |

The exporter is not published to the host by default (Prometheus reaches it on
the internal network). To curl `/metrics` directly, add a `ports: ["9418:9418"]`
mapping to the `exporter` service.

### Quick start

```bash
# from telemetry/observability/ inside ${project_name}
cp .env.example .env          # optional — edit ports / project dir / creds
docker compose up -d          # build the exporter, start all three services
open http://localhost:3001    # Grafana → folder "${project_name}" → cost dashboard
```

Grafana opens read-only as an anonymous **Viewer** — no login needed to read the
dashboard. To edit, log in with `GF_SECURITY_ADMIN_USER` / `GF_SECURITY_ADMIN_PASSWORD`
(default `admin` / `admin`; **change the password before exposing the stack**).

Other endpoints:

- Prometheus UI / target health: <http://localhost:9090>
- Exporter metrics (if you publish `9418`): <http://localhost:9418/metrics>

```bash
docker compose ps             # service + healthcheck status
docker compose logs -f exporter
docker compose down           # stop (keeps stored series)
docker compose down -v        # stop AND wipe prometheus_data + grafana_data
```

### Dashboards

Three dashboards ship in the `${project_name}` Grafana folder; all are auto-loaded
by the folder provisioner (`grafana/provisioning/dashboards/ack.yml` loads
**every** `*.json` under `grafana/dashboards/`) and all read the same
`ack-prometheus` datasource.

- **`ack-cost.json`** — dollar cost (detailed below).
- **`ack-ai-usage.json`** — token usage + cost over time, by model / feature / agent / session, with budget gauges.
- **`ack-dora.json`** — the four DORA delivery metrics (deployment frequency, lead time, change-failure rate, MTTR); panels read `ack_dora_*` from `telemetry/dora.py --prom` (live-exporter wiring is a follow-up — run `python3 telemetry/dora.py` directly, or use the Tier 1 GitHub Action, for now).

#### Cost Observability (`ack-cost.json`) — dollars

| Panel | PromQL |
|---|---|
| Total Cost (USD) | `ack_total_cost_usd` |
| Assistant Turns | `ack_assistant_turns_total` |
| Exporter Health (0=OK,1=Error) | `ack_scrape_error` |
| Last Scrape Duration | `ack_scrape_duration_seconds` |
| Cost by Feature (time series) | `ack_cost_usd{feature!="*", agent="*", model="*"}` |
| Cost by Model (time series) | `ack_cost_usd{model!="*", agent="*", feature="*"}` |
| Cost by Agent (time series) | `ack_cost_usd{agent!="*", model="*", feature="*"}` |
| Cost Share by Feature (top 10 pie) | `topk(10, ack_cost_usd{feature!="*", agent="*", model="*"})` |
| Top Sessions / Agents by Cost | `topk(20, ack_cost_usd{agent!="*", model="*", feature="*"})` |
| Budget vs Actual (project gauge) | `ack_total_cost_usd / clamp_min(ack_budget_usd{feature="__project__"}, 1)` |
| Per-Feature Budget Utilization | `sum by (feature) (ack_cost_usd{feature!="*"}) / clamp_min(ack_budget_usd{feature!="__project__"}, 1)` |

#### AI / Token Usage (`ack-ai-usage.json`) — tokens + budgets

The token-usage companion: it charts **tokens** (input / output / cache_read /
cache_write_5m / cache_write_1h) alongside USD, broken out by model, feature,
agent and session, plus advisory budget thresholds. Same `ack-prometheus`
datasource, same offline/near-real-time caveat as above.

| Panel | PromQL |
|---|---|
| Total Tokens (all kinds) | `sum(ack_tokens_total{feature!="*", agent="*"})` |
| Cache-Read Share of Tokens | `sum(ack_tokens_total{kind="cache_read", feature!="*", agent="*"}) / clamp_min(sum(ack_tokens_total{feature!="*", agent="*"}), 1)` |
| Total Cost (USD) | `ack_total_cost_usd` |
| Assistant Turns | `ack_assistant_turns_total` |
| Exporter Health (0=OK,1=Error) | `ack_scrape_error` |
| Tokens Over Time by Kind | `sum by (kind) (ack_tokens_total{feature!="*", agent="*"})` |
| Cost Over Time by Model | `ack_cost_usd{model!="*", agent="*", feature="*"}` |
| Tokens by Feature (top 10 donut) | `topk(10, sum by (feature) (ack_tokens_total{feature!="*", agent="*"}))` |
| Tokens by Agent (top 15 bars) | `topk(15, sum by (agent) (ack_tokens_total{agent!="*", feature="*"}))` |
| Token Ledger by Feature × Kind (table) | `ack_tokens_total{feature!="*", agent="*"}` (pivoted kind→columns) |
| Output Tokens per Turn | `sum(ack_tokens_total{kind="output", feature!="*", agent="*"}) / clamp_min(ack_assistant_turns_total, 1)` |
| Spend by Session / Agent (table) | `topk(20, ack_cost_usd{agent!="*", model="*", feature="*"})` |
| Project Budget Utilization (gauge) | `ack_total_cost_usd / clamp_min(ack_budget_usd{feature="__project__"}, 1)` |
| Per-Feature Budget Utilization (threshold=100%) | `sum by (feature) (ack_cost_usd{feature!="*", agent="*", model="*"}) / clamp_min(ack_budget_usd{feature!="__project__"}, 1) and on (feature) ack_budget_usd{feature!="__project__"}` |
| Data Freshness (recompute age) | `time() - ack_last_scrape_unixtime` |

The exporter emits `ack_cost_usd` / `ack_tokens_total` one axis at a time — the
active axis carries its label and the other axes are the literal `*`. The
per-axis panels select a single axis by filtering the others to `="*"`. The
budget panels read `ack_budget_usd`, populated from `telemetry.budgets[]` in this
project's `project.manifest.yaml` (project-scope cap → `feature="__project__"`;
feature-scope caps → `feature=<id>`).

> **Honest about offline.** Both dashboards are near-real-time recomputes, not a
> live token meter. The *Data Freshness* panel shows seconds since the last
> recompute precisely so a stale read is visible: cost and tokens are derived
> after the fact from transcript usage (claude-code#11008), never streamed live.

### Pointing at a different project dir

The exporter aggregates whatever is mounted at `/projects`. To chart transcripts
collected from another machine (transcripts are local — see the
[telemetry README](../README.md)):

```bash
# in .env
ACK_PROJECT_DIR=/abs/path/to/collected/jsonl/root
```

then `docker compose up -d` to re-create the exporter with the new mount. The
path is mounted **read-only**; the exporter never writes to your transcripts.

### Configuration reference

All knobs live in `.env` (see `.env.example`); each has a default baked into
`docker-compose.yml`.

| Variable | Default | Purpose |
|---|---|---|
| `ACK_PROJECT_DIR` | `~/.claude/projects` | transcript root mounted read-only at `/projects` |
| `ACK_BRANCH_PREFIX` | `${branch_prefix}` | feature = branch name after this prefix |
| `ACK_SCRAPE_TTL` | `30` | recompute cache window (s); keep ≤ scrape interval |
| `ACK_GRAFANA_PORT` | `3001` | Grafana host port (3000 = docs/app site) |
| `ACK_PROMETHEUS_PORT` | `9090` | Prometheus host port |
| `GF_SECURITY_ADMIN_USER` / `_PASSWORD` | `admin` / `admin` | Grafana editor login |

The manifest path is fixed to `${CLAUDE_PROJECT_DIR}/project.manifest.yaml`
(bind-mounted read-only), so budgets are read automatically.

---

## Files

```
telemetry/
├── aggregate.py                              # Tier 0 cost+token engine (CLI)
├── dora.py                                   # Tier 0 DORA four-keys engine (CLI)
├── report.py                                 # Tier 0 self-contained HTML/MD report
├── monitor.sh                                # Tier 1 LOCAL cost/budget monitor (ALERTs)
├── pricing.json                              # versioned price map
└── observability/                            # Tier 2 (opt-in) Grafana stack
    ├── docker-compose.yml                    #   3 services, pinned images, RO mounts
    ├── .env.example                          #   copy to .env to override defaults
    ├── README.md                             #   this file
    ├── exporter/                             #   exporter image
    │   ├── ack_cost_exporter.py              #     thin Prometheus wrapper around aggregate.py
    │   ├── requirements.txt                  #     prometheus_client
    │   └── Dockerfile                        #     python:3.12-slim (context = telemetry/)
    ├── prometheus/
    │   └── prometheus.yml                    #   scrape exporter:9418 every 30s
    └── grafana/
        ├── provisioning/
        │   ├── datasources/prometheus.yml    #   auto-wire the Prometheus datasource
        │   └── dashboards/ack.yml            #   dashboard provider
        └── dashboards/
            ├── ack-cost.json                 #   the cost (USD) dashboard
            ├── ack-ai-usage.json             #   the AI/token-usage + budget dashboard
            └── ack-dora.json                 #   the DORA four-keys dashboard
```

The DORA GitHub Action (Tier 1) lives under `.github/` at the repo root, not in
this directory.
