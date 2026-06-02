# Cost observability — Prometheus + Grafana (META layer)

> A Prometheus + Grafana stack that visualizes the **OFFLINE** cost of building
> `ai-core-kit` itself. It puts a live dashboard on top of the same
> `telemetry/aggregate.py` engine the kit already uses — **without
> re-implementing any pricing logic.**

This is the META-layer stack (it watches the cost of building the kit). The
identical stack ships to forked CHILD projects under
`templates/telemetry/observability/` and is wired by `/ack-init` when
`telemetry.enabled: true` in the child manifest.

## Near-real-time, NOT a live meter (the #11008 caveat)

Claude Code hooks receive no token or cost fields
([anthropics/claude-code#11008](https://github.com/anthropics/claude-code/issues/11008),
open), so there is no live per-token meter to scrape. Instead, the exporter
**re-parses the transcript JSONL on each Prometheus scrape** (TTL-cached) and
multiplies usage by `pricing.json`. The dashboard is therefore **near-real-time**
— refreshed every scrape interval (30s by default, bounded by `ACK_SCRAPE_TTL`)
— not a live billing feed. Numbers move as you work and transcripts grow, with a
delay of at most one scrape + one TTL window. This is the same offline,
reconciled, fail-loud cost that `aggregate.py` prints; the stack just charts it.

## What it reads

| Source | Mounted as | Mode |
|---|---|---|
| `~/.claude/projects` (transcripts) | `/projects` in the exporter | **read-only** |
| `../aggregate.py` (this repo's cost engine) | `/app/aggregate.py` | read-only |
| `../pricing.json` (this repo's price map) | `/app/pricing.json` | read-only |
| `../../project.manifest.yaml` (optional, for budgets) | `/manifest/project.manifest.yaml` | read-only |

The exporter **imports** `load_pricing`, `discover_jsonl`, and `aggregate` from
`aggregate.py` — it never re-implements pricing. Cost logic lives in exactly one
place.

## Services & ports

| Service | Image (pinned) | Host port | Purpose |
|---|---|---|---|
| `exporter` | built from `exporter/Dockerfile` (context `telemetry/`) | (internal `9418`) | recompute cost, expose Prometheus gauges |
| `prometheus` | `prom/prometheus:v3.5.3` | `9090` | scrape + store the series (30d retention) |
| `grafana` | `grafana/grafana:12.4.3` | **`3001`** | dashboards (3000 is the docs site) |

The exporter is not published to the host by default (Prometheus reaches it on
the internal `ack-observability` network). To curl `/metrics` directly, add a
`ports: ["9418:9418"]` mapping to the `exporter` service.

## Quick start

```bash
# from telemetry/observability/
cp .env.example .env          # optional — edit ports / project dir / creds
docker compose up -d          # build the exporter, start all three services
open http://localhost:3001    # Grafana → folder "ai-core-kit" → "Cost Observability"
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

## Dashboard panels

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

The exporter emits `ack_cost_usd` one axis at a time — the active axis carries
its label and the other two are the literal `*`. The per-axis panels select a
single axis by filtering the other two to `="*"` (e.g. cost-by-feature keeps
`agent="*", model="*"`). The budget gauge needs a manifest: set `ACK_MANIFEST=/manifest/project.manifest.yaml`
and uncomment the matching read-only mount in `docker-compose.yml` (otherwise
`ack_budget_usd` is empty and the gauge reads 0).

## Pointing at a different project dir

The exporter aggregates whatever is mounted at `/projects`. To chart a fork's
spend, or transcripts collected from another machine (transcripts are local —
see the [telemetry README](../README.md#locality-note)):

```bash
# in .env
ACK_PROJECT_DIR=/abs/path/to/collected/jsonl/root
```

then `docker compose up -d` to re-create the exporter with the new mount. The
path is mounted **read-only**; the exporter never writes to your transcripts.

## Configuration reference

All knobs live in `.env` (see `.env.example`); each has a default baked into
`docker-compose.yml`.

| Variable | Default | Purpose |
|---|---|---|
| `ACK_PROJECT_DIR` | `~/.claude/projects` | transcript root mounted read-only at `/projects` |
| `ACK_BRANCH_PREFIX` | `feat/` | feature = branch name after this prefix |
| `ACK_MANIFEST` | (unset) | manifest path for `telemetry.budgets[]` → `ack_budget_usd` |
| `ACK_SCRAPE_TTL` | `30` | recompute cache window (s); keep ≤ scrape interval |
| `ACK_GRAFANA_PORT` | `3001` | Grafana host port (3000 = docs site) |
| `ACK_PROMETHEUS_PORT` | `9090` | Prometheus host port |
| `GF_SECURITY_ADMIN_USER` / `_PASSWORD` | `admin` / `admin` | Grafana editor login |

## Files

```
telemetry/observability/
├── docker-compose.yml                         # 3 services, pinned images, RO mounts
├── .env.example                               # copy to .env to override defaults
├── README.md                                  # this file
├── exporter/                                  # exporter image (authored alongside)
│   ├── ack_cost_exporter.py                   #   thin Prometheus wrapper around aggregate.py
│   ├── requirements.txt                       #   prometheus_client
│   └── Dockerfile                             #   python:3.12-slim (context = telemetry/)
├── prometheus/
│   └── prometheus.yml                         # scrape exporter:9418 every 30s
└── grafana/
    ├── provisioning/
    │   ├── datasources/prometheus.yml         # auto-wire the Prometheus datasource
    │   └── dashboards/ack.yml                 # dashboard provider
    └── dashboards/
        └── ack-cost.json                      # the cost dashboard
```
