#!/usr/bin/env python3
# =============================================================================
# ack_cost_exporter.py -- Prometheus exporter for ai-core-kit OFFLINE cost
# =============================================================================
# WHAT THIS IS
#   A thin Prometheus wrapper around telemetry/aggregate.py. It does NOT
#   re-implement any pricing or attribution logic: it imports load_pricing(),
#   discover_jsonl(), and aggregate() from the sibling aggregate.py and exposes
#   the resulting buckets as Prometheus gauges on /metrics.
#
# NEAR-REAL-TIME, NOT A LIVE METER  (the issue-11008 constraint)
#   Claude Code hooks carry NO token/cost fields, so there is no live per-token
#   stream to scrape. Cost is OFFLINE-derived: on each Prometheus scrape (subject
#   to an ACK_SCRAPE_TTL cache) the exporter RE-PARSES the transcript JSONL under
#   ACK_PROJECT_DIR and re-aggregates. Freshness is therefore "as of the last
#   recompute" (default <=30s old), never a true real-time token meter. Be honest
#   about this in any dashboard you build on top of it.
#
# WHY A TTL CACHE
#   Prometheus scrapes every ~30s; re-reading every transcript on every scrape
#   would hammer disk I/O. Within ACK_SCRAPE_TTL seconds the cached aggregation
#   is reused; after that the next scrape triggers a fresh re-read + re-aggregate.
#
# FAIL-SOFT AT SCRAPE TIME
#   aggregate.py is fail-LOUD (unknown model / unreconciled => exception). A
#   crashing exporter would take the whole metrics endpoint down, so here we
#   CATCH at scrape time: on any error we keep the last good gauge values, set
#   ack_scrape_error=1, and log to stderr. An empty / missing transcript dir is
#   NOT an error -- it emits clean zeros (ack_scrape_error=0). Build a Grafana
#   alert on ack_scrape_error to know when a scrape is stale/untrustworthy.
#
# METRICS EXPOSED
#   ack_total_cost_usd                          grand total across all turns
#   ack_assistant_turns_total                   number of assistant turns priced
#   ack_files_scanned                           transcript files discovered
#   ack_cost_usd{model,feature,agent}           cost per axis bucket (1-D, the
#                                               non-active axes are pinned to "*")
#   ack_tokens_total{kind,feature,agent}        tokens per kind per axis bucket
#   ack_budget_usd{feature}                     advisory budget ceilings from the
#                                               manifest (scope=project => feature
#                                               label "__project__")
#   ack_reconciled                              1 if all axes reconcile, else 0
#   ack_pricing_as_of{as_of,reconciled}         pricing-doc metadata (Info)
#   ack_scrape_duration_seconds                 wall time of the last recompute
#   ack_scrape_error                            1 if last scrape errored, else 0
#   ack_last_scrape_unixtime                    unix ts of the last recompute
#
# CONFIG (environment)
#   ACK_PROJECT_DIR    transcript root           (default ~/.claude/projects)
#   ACK_PRICING        pricing.json path         (default ./pricing.json by script)
#   ACK_MANIFEST       project.manifest.yaml     (optional; supplies budgets)
#   ACK_BRANCH_PREFIX  feature attribution prefix(default feat/)
#   ACK_DEFAULT_BUCKET catch-all bucket name     (default unattributed)
#   ACK_SINCE          only count >= YYYY-MM-DD  (optional)
#   ACK_PORT           HTTP listen port          (default 9418)
#   ACK_SCRAPE_TTL     cache freshness seconds   (default 30)
# =============================================================================

import os
import sys
import time
import threading
from pathlib import Path

# --- locate the sibling aggregate.py and put its dir on sys.path -------------
# Two supported layouts, tried in order:
#   1. CONTAINER: Dockerfile copies aggregate.py + pricing.json NEXT TO this file
#      (build context = telemetry/), so the script's own dir works.
#   2. REPO/CHILD: this file lives at
#        <telemetry>/observability/exporter/ack_cost_exporter.py
#      so the real aggregate.py is two dirs up at <telemetry>/aggregate.py.
# Both candidates are prepended; `import aggregate` then resolves to whichever
# actually contains aggregate.py. This works identically in META and CHILD: the
# "two dirs up" hop always lands on the telemetry/ that ships the aggregator.
_HERE = os.path.dirname(os.path.abspath(__file__))
_TELEMETRY_DIR = os.path.dirname(os.path.dirname(_HERE))  # exporter/ -> observability/ -> telemetry/
for _cand in (_HERE, _TELEMETRY_DIR):
    if _cand not in sys.path:
        sys.path.insert(0, _cand)

try:
    from aggregate import (  # noqa: E402  (path is set up just above)
        load_pricing,
        discover_jsonl,
        aggregate,
        parse_since,
        CostError,
    )
except ImportError as exc:  # pragma: no cover - environment/path misconfig
    sys.stderr.write(
        "FATAL: cannot import aggregate.py (the OFFLINE cost engine). Looked in:\n"
        f"  {_HERE}\n  {_TELEMETRY_DIR}\n"
        "In a container the Dockerfile must COPY aggregate.py next to this file "
        "(build context = telemetry/). In the repo this file must live at "
        "telemetry/observability/exporter/.\n"
        f"Underlying error: {exc}\n"
    )
    raise

from prometheus_client import (  # noqa: E402
    Gauge,
    Info,
    REGISTRY,
    start_http_server,
)

# -----------------------------------------------------------------------------
# Prometheus metrics  (recomputed/reset on each fresh scrape)
# -----------------------------------------------------------------------------
TOTAL_COST_USD = Gauge(
    "ack_total_cost_usd",
    "Grand total OFFLINE-derived cost in USD across all assistant turns.",
)
ASSISTANT_TURNS_TOTAL = Gauge(
    "ack_assistant_turns_total",
    "Number of assistant turns priced in the last aggregation.",
)
FILES_SCANNED = Gauge(
    "ack_files_scanned",
    "Number of transcript JSONL files discovered in the last aggregation.",
)
COST_USD = Gauge(
    "ack_cost_usd",
    "OFFLINE cost in USD per axis bucket. Each series fixes ONE axis to its "
    "bucket value and pins the other two axis labels to '*' (1-D per axis).",
    labelnames=("model", "feature", "agent"),
)
TOKENS_TOTAL = Gauge(
    "ack_tokens_total",
    "Token counts by kind (input/output/cache_read/cache_write_5m/cache_write_1h) "
    "per feature and per agent. Non-active axis label pinned to '*'.",
    labelnames=("kind", "feature", "agent"),
)
BUDGET_USD = Gauge(
    "ack_budget_usd",
    "Advisory budget ceiling in USD from the manifest. Feature-scoped budgets "
    "use their id; project-scoped budget uses the reserved feature '__project__'.",
    labelnames=("feature",),
)
RECONCILED = Gauge(
    "ack_reconciled",
    "1 if every axis bucket-sum reconciles to the grand total, else 0.",
)
SCRAPE_DURATION_SECONDS = Gauge(
    "ack_scrape_duration_seconds",
    "Wall-clock duration of the last cost aggregation (recompute) in seconds.",
)
SCRAPE_ERROR = Gauge(
    "ack_scrape_error",
    "1 if the last scrape errored (stale metrics, do not trust), else 0.",
)
LAST_SCRAPE_UNIXTIME = Gauge(
    "ack_last_scrape_unixtime",
    "Unix timestamp (seconds) of the last successful recompute.",
)
PRICING_INFO = Info(
    "ack_pricing_as_of",
    "Pricing document metadata for the last aggregation.",
)


# -----------------------------------------------------------------------------
# configuration
# -----------------------------------------------------------------------------
def load_config():
    here_pricing = os.path.join(_TELEMETRY_DIR, "pricing.json")
    # In a container, pricing.json sits next to the script (build context).
    if not os.path.isfile(here_pricing) and os.path.isfile(os.path.join(_HERE, "pricing.json")):
        here_pricing = os.path.join(_HERE, "pricing.json")
    return {
        "project_dir": os.getenv("ACK_PROJECT_DIR", os.path.expanduser("~/.claude/projects")),
        "pricing_path": os.getenv("ACK_PRICING", here_pricing),
        "manifest_path": os.getenv("ACK_MANIFEST"),
        "branch_prefix": os.getenv("ACK_BRANCH_PREFIX", "feat/"),
        "default_bucket": os.getenv("ACK_DEFAULT_BUCKET", "unattributed"),
        "since": os.getenv("ACK_SINCE"),
        "port": int(os.getenv("ACK_PORT", "9418")),
        "scrape_ttl_seconds": int(os.getenv("ACK_SCRAPE_TTL", "30")),
    }


# -----------------------------------------------------------------------------
# manifest budgets  (stdlib-only; NO PyYAML dependency, like aggregate.py)
# -----------------------------------------------------------------------------
def load_manifest_budgets(manifest_path):
    """Read managed.telemetry.budgets[] from a project.manifest.yaml.

    Returns {feature_label: usd_cap}. A scope==feature budget keys on its `id`;
    a scope==project budget keys on the reserved label "__project__" (consumed
    by the dashboard's project-level budget gauge). Other scopes (contract,
    agent) are ignored here because ack_budget_usd is feature-labelled.

    Stdlib-only tolerant scanner: children are not guaranteed to have PyYAML, and
    aggregate.py is deliberately stdlib-only, so this exporter stays dependency-
    light too (its ONLY pip dependency is prometheus_client). The manifest
    budgets block is a simple, flat list of `- scope: ... id: ... usd_cap: ...`
    items, which this line reader handles without a full YAML parser. On any
    parse problem it returns whatever it has parsed so far (never raises).
    """
    budgets = {}
    if not manifest_path:
        return budgets
    p = Path(manifest_path)
    if not p.is_file():
        return budgets
    try:
        lines = p.read_text(encoding="utf-8").splitlines()
    except OSError:
        return budgets

    in_budgets = False
    budgets_indent = None
    cur_scope = None
    cur_id = None
    cur_cap = None

    def _flush():
        if cur_scope == "feature" and cur_id is not None and cur_cap is not None:
            budgets[cur_id] = cur_cap
        elif cur_scope == "project" and cur_cap is not None:
            budgets["__project__"] = cur_cap

    for line in lines:
        # strip trailing inline comments outside of quotes (best-effort)
        raw = line.rstrip("\n")
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())

        if not in_budgets:
            if stripped.startswith("budgets:"):
                in_budgets = True
                budgets_indent = indent
            continue

        # Inside the budgets block. We leave it when we hit a line at an indent
        # <= the `budgets:` key indent that is NOT a list item under it.
        if indent <= budgets_indent and not stripped.startswith("-"):
            _flush()
            cur_scope = cur_id = cur_cap = None
            in_budgets = False
            # this line might start ANOTHER budgets: (unlikely) -- re-check
            if stripped.startswith("budgets:"):
                in_budgets = True
                budgets_indent = indent
            continue

        # A new list item starts a new budget record.
        if stripped.startswith("-"):
            _flush()
            cur_scope = cur_id = cur_cap = None
            stripped = stripped[1:].strip()  # may carry the first key inline
            if not stripped:
                continue

        if ":" not in stripped:
            continue
        key, val = stripped.split(":", 1)
        key = key.strip()
        val = val.split("#", 1)[0].strip().strip('"').strip("'")
        if not val:
            continue
        if key == "scope":
            cur_scope = val
        elif key == "id":
            cur_id = val
        elif key == "usd_cap":
            try:
                cur_cap = float(val)
            except ValueError:
                cur_cap = None

    _flush()  # flush a trailing record at EOF
    return budgets


# -----------------------------------------------------------------------------
# the recompute  (called at most once per TTL window)
# -----------------------------------------------------------------------------
def recompute(cfg):
    """Run the OFFLINE aggregation and repopulate all gauges.

    Fail-soft: a missing/empty transcript dir yields clean zeros; a genuine
    aggregation error sets ack_scrape_error=1 and re-raises so the caller can
    keep the previous good values (gauges are NOT cleared on error).
    """
    start = time.monotonic()

    # Empty / missing transcript dir => clean zeros, NOT an error.
    project_dir = cfg["project_dir"]
    if not project_dir or not Path(project_dir).exists():
        sys.stderr.write(
            f"WARN: transcript dir not found ({project_dir!r}); emitting zeros.\n"
        )
        _emit_zeros(cfg)
        SCRAPE_DURATION_SECONDS.set(time.monotonic() - start)
        SCRAPE_ERROR.set(0)
        LAST_SCRAPE_UNIXTIME.set(time.time())
        return

    pricing_doc = load_pricing(cfg["pricing_path"])
    files = discover_jsonl(project_dir)
    since = parse_since(cfg["since"])
    result = aggregate(
        files,
        pricing_doc,
        cfg["pricing_path"],
        axes=("model", "feature", "agent", "session"),
        branch_prefix=cfg["branch_prefix"],
        default_bucket=cfg["default_bucket"],
        since=since,
        sidecar=None,
    )

    # Reset the dynamically-labelled gauges so stale buckets disappear.
    COST_USD.clear()
    TOKENS_TOTAL.clear()
    BUDGET_USD.clear()

    buckets = result.get("buckets", {})
    model_buckets = buckets.get("model", {})
    feature_buckets = buckets.get("feature", {})
    agent_buckets = buckets.get("agent", {})

    # ack_cost_usd: one series per axis, the two inactive axes pinned to "*".
    # (aggregate.py emits 1-D buckets per axis; cross-axis stitching, if needed,
    #  is done in PromQL/Grafana -- the exporter never invents joint cells.)
    for model, data in model_buckets.items():
        COST_USD.labels(model=model, feature="*", agent="*").set(data["cost_usd"])
    for feature, data in feature_buckets.items():
        COST_USD.labels(model="*", feature=feature, agent="*").set(data["cost_usd"])
    for agent, data in agent_buckets.items():
        COST_USD.labels(model="*", feature="*", agent=agent).set(data["cost_usd"])

    # ack_tokens_total: per kind, by feature and by agent.
    for feature, data in feature_buckets.items():
        for kind, val in (data.get("tokens") or {}).items():
            TOKENS_TOTAL.labels(kind=kind, feature=feature, agent="*").set(val)
    for agent, data in agent_buckets.items():
        for kind, val in (data.get("tokens") or {}).items():
            TOKENS_TOTAL.labels(kind=kind, feature="*", agent=agent).set(val)

    TOTAL_COST_USD.set(result.get("total_cost_usd", 0.0))
    ASSISTANT_TURNS_TOTAL.set(result.get("assistant_turns", 0))
    FILES_SCANNED.set(result.get("files_scanned", 0))
    RECONCILED.set(1 if result.get("reconciled") else 0)

    PRICING_INFO.info({
        "as_of": str(result.get("pricing_as_of") or "unknown"),
        "reconciled": "true" if result.get("reconciled") else "false",
    })

    for feature, cap in load_manifest_budgets(cfg["manifest_path"]).items():
        BUDGET_USD.labels(feature=feature).set(cap)

    SCRAPE_DURATION_SECONDS.set(time.monotonic() - start)
    SCRAPE_ERROR.set(0)
    LAST_SCRAPE_UNIXTIME.set(time.time())


def _emit_zeros(cfg):
    """Populate clean-zero gauges for the no-transcripts case (never crash)."""
    COST_USD.clear()
    TOKENS_TOTAL.clear()
    BUDGET_USD.clear()
    TOTAL_COST_USD.set(0.0)
    ASSISTANT_TURNS_TOTAL.set(0)
    FILES_SCANNED.set(0)
    RECONCILED.set(1)  # vacuously reconciled: 0 == 0
    PRICING_INFO.info({"as_of": "unknown", "reconciled": "true"})
    # Budgets are independent of transcripts -- still publish them if present.
    for feature, cap in load_manifest_budgets(cfg["manifest_path"]).items():
        BUDGET_USD.labels(feature=feature).set(cap)


# -----------------------------------------------------------------------------
# TTL cache + custom collector
# -----------------------------------------------------------------------------
class TTLRecomputer:
    """Recompute at most once per ttl_seconds; thread-safe across scrapes."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.ttl = cfg["scrape_ttl_seconds"]
        self._last_run = 0.0
        self._lock = threading.Lock()
        self._primed = False

    def maybe_recompute(self):
        now = time.monotonic()
        with self._lock:
            if self._primed and (now - self._last_run) < self.ttl:
                return  # cached values are still fresh; reuse them
            try:
                recompute(self.cfg)
            except CostError as exc:
                sys.stderr.write(f"ERROR (cost): {exc}\n")
                SCRAPE_ERROR.set(1)
            except Exception as exc:  # never let a scrape take the endpoint down
                sys.stderr.write(f"ERROR (scrape): {exc}\n")
                SCRAPE_ERROR.set(1)
            finally:
                # Always advance the clock so a hard-failing recompute is not
                # retried on every single scrape (it would hammer disk/log).
                self._last_run = time.monotonic()
                self._primed = True


class CostCollector:
    """Trigger a (TTL-gated) recompute whenever Prometheus scrapes /metrics."""

    def __init__(self, recomputer):
        self._recomputer = recomputer

    def collect(self):
        self._recomputer.maybe_recompute()
        # The actual gauge samples are collected by the default REGISTRY; this
        # collector only drives the recompute side effect, so it yields nothing.
        return iter(())


def main():
    cfg = load_config()
    recomputer = TTLRecomputer(cfg)

    # Prime once at startup so the very first scrape already has data (and so a
    # bad pricing.json path surfaces immediately in the logs, not only on scrape).
    recomputer.maybe_recompute()

    REGISTRY.register(CostCollector(recomputer))

    sys.stderr.write(
        f"ai-core-kit cost exporter listening on :{cfg['port']} "
        f"(project_dir={cfg['project_dir']!r}, ttl={cfg['scrape_ttl_seconds']}s). "
        "OFFLINE/near-real-time -- recomputed per scrape, not a live token meter.\n"
    )
    start_http_server(cfg["port"], registry=REGISTRY)

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        sys.stderr.write("exporter stopped.\n")


if __name__ == "__main__":
    main()
