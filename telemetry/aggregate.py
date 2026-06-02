#!/usr/bin/env python3
# =============================================================================
# aggregate.py -- ai-core-kit OFFLINE cost & token aggregator  (META layer)
# =============================================================================
# WHAT THIS IS
#   A stdlib-only, post-run analysis tool. It reads Claude Code transcript JSONL
#   (~/.claude/projects/**/*.jsonl), multiplies each assistant turn's
#   `message.usage` token counts by a versioned pricing map (pricing.json), and
#   buckets the resulting USD cost by model / feature / agent / session.
#
# WHY OFFLINE (the issue-11008 constraint)
#   Claude Code hooks (PreToolUse/PostToolUse/...) receive ONLY session_id,
#   transcript_path, cwd, permission_mode, hook_event_name -- NO token or cost
#   fields (https://github.com/anthropics/claude-code/issues/11008, open). So
#   live, hook-emitted cost is impossible. ALL cost is therefore computed HERE,
#   after the fact, from the transcript usage lines. Text-only assistant turns
#   (no tool call) still carry a `message.usage` line, so counting from usage --
#   not from PostToolUse activity -- captures 100% of spend, not just tool turns.
#
# DETERMINISTIC, FAIL-LOUD CONTRACT
#   * Every assistant usage line is attributed to exactly one bucket per axis;
#     turns that match no feature/agent rule land in an EXPLICIT default bucket
#     (default name: "unattributed") -- never silently dropped.
#   * A `message.model` that is absent from pricing.json is a HARD ERROR that
#     names the offending model id and exits non-zero (unknown_model_policy).
#   * The human table prints a RECONCILIATION line proving
#     sum(bucket costs) == grand total (within float epsilon); a mismatch exits
#     non-zero. The JSON output carries the same `reconciled` boolean.
#
# TOKEN USAGE, NOT JUST COST
#   Every bucket carries token counts (input / output / cache_read /
#   cache_write_5m / cache_write_1h) ALONGSIDE its USD cost, so this is true
#   "token usage" accounting, not only a dollar figure. `--by day` (UTC) and
#   `--daily` add a per-day time series of tokens + cost; `--daily-by AXIS`
#   splits each day by model/feature/agent/session for stacked-area dashboards.
#
# BUDGETS (advisory, fail-loud only when asked)
#   `--budget USD` compares the grand total to a ceiling and reports headroom /
#   overage; `--budget-axis AXIS` + repeated `--bucket-budget NAME=USD` set
#   per-bucket ceilings (e.g. per session or per feature). Budget overage is
#   REPORTED by default; `--budget-strict` makes any overage exit non-zero
#   (reconciliation failure ALWAYS exits non-zero, independent of budgets).
#
# USAGE
#   python3 aggregate.py [--project-dir DIR] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
#                        [--pricing PATH] [--by feature,model,agent,session,day]
#                        [--branch-prefix feat/] [--default-bucket unattributed]
#                        [--daily] [--daily-by model|feature|agent|session]
#                        [--budget USD] [--budget-axis AXIS]
#                        [--bucket-budget NAME=USD ...] [--budget-strict]
#                        [--format table|json|both|md|html] [--manifest PATH]
#   See README.md for the full attribution model and worked examples.
# =============================================================================

import argparse
import datetime as _dt
import glob
import json
import os
import re
import sys
from pathlib import Path

# --- the cost axes we know how to bucket by ---------------------------------
# `day` is a TIME axis: each turn buckets to its UTC calendar day (YYYY-MM-DD).
# It reconciles like any other axis (every priced turn lands in exactly one day,
# timestamp-less turns in an explicit "undated" bucket) and powers the per-day
# token + cost time series alongside the cross-sectional model/feature/agent/
# session axes.
VALID_AXES = ("model", "feature", "agent", "session", "day")
DEFAULT_AXES = ("feature", "model", "agent", "session")

# The reserved day-bucket for turns whose transcript line carries no parseable
# timestamp. Distinct from `default_bucket` (the no-attribution catch-all) so a
# missing TIMESTAMP is never confused with a missing feature/agent attribution.
UNDATED_BUCKET = "undated"

# Token kinds carried on every bucket (the order is the human-table column order
# and the JSON key order). cache_write_5m / _1h are the ephemeral cache-write
# tiers; cache_read is the (much cheaper) cache hit.
TOKEN_KINDS = ("input", "output", "cache_read", "cache_write_5m", "cache_write_1h")

# --- accepted manifest MAJOR (lockstep with the frozen contract) -------------
# The CHILD manifest schema_version this aggregator understands. A mismatched
# MAJOR means the manifest shape may have moved; we IGNORE its telemetry.*
# defaults (with a stderr notice) rather than read keys that may have shifted.
# CLI flags still work, so aggregation never wedges. Bump in lockstep with
# templates/manifest/project.manifest.schema.{yaml,json}.
ACCEPTED_MANIFEST_MAJOR = 3

# --- token field -> pricing key map (the materially-correct cost model) -----
# message.usage carries: input_tokens, output_tokens, cache_read_input_tokens,
# cache_creation_input_tokens, and (when present) a cache_creation object that
# splits the cache write into ephemeral_5m_input_tokens / ephemeral_1h_input_tokens.
# We price the 5m/1h split when available; otherwise the whole
# cache_creation_input_tokens is priced at the 5m (default ephemeral) rate so
# nothing is dropped or mispriced upward.


class CostError(Exception):
    """Fatal, fail-loud aggregation error (unknown model, bad pricing, etc.)."""


# A trailing -YYYYMMDD release-date suffix on a model id (e.g.
# claude-haiku-4-5-20251001) is normalized to its base id (claude-haiku-4-5)
# for pricing, so the map keys on stable base ids and dated releases still price.
_DATE_SUFFIX = re.compile(r"-\d{8}$")


def resolve_model_key(model, pricing_doc):
    """Map a transcript message.model to a pricing key, or None if truly unknown.

    Resolution order (all data-driven, never a silent fallback to a wrong price):
      1. exact id match in `models`;
      2. explicit `aliases` map (e.g. bare "sonnet" -> "claude-sonnet-4-6");
      3. strip a trailing -YYYYMMDD release-date suffix and retry (1)+(2).
    Returns the resolved key present in `models`, else None (caller fails loud).
    """
    models = pricing_doc["models"]
    aliases = pricing_doc.get("aliases") or {}
    for cand in (model, aliases.get(model)):
        if cand and cand in models:
            return cand
    base = _DATE_SUFFIX.sub("", model)
    if base != model:
        for cand in (base, aliases.get(base)):
            if cand and cand in models:
                return cand
    return None


# ---------------------------------------------------------------------------
# pricing
# ---------------------------------------------------------------------------
def load_pricing(path):
    p = Path(path)
    if not p.is_file():
        raise CostError(f"pricing file not found: {path}")
    try:
        doc = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise CostError(f"pricing file is not valid JSON: {path}: {e}")
    models = doc.get("models")
    if not isinstance(models, dict) or not models:
        raise CostError(f"pricing file has no non-empty `models` map: {path}")
    required_keys = {"input", "output", "cache_write_5m", "cache_write_1h", "cache_read"}
    for mid, row in models.items():
        missing = required_keys - set(row)
        if missing:
            raise CostError(
                f"pricing model {mid!r} missing price keys: {sorted(missing)} (in {path})"
            )
    return doc


def price_usage(usage, model, pricing_doc, pricing_path):
    """Return USD cost for one assistant turn's usage. FAIL LOUD on unknown model."""
    models = pricing_doc["models"]
    key = resolve_model_key(model, pricing_doc)
    if key is None:
        raise CostError(
            f"unknown model {model!r} not in pricing map {pricing_path} "
            f"(as_of {pricing_doc.get('as_of', '?')}). "
            f"Known: {sorted(models)}. Add it (or an alias / base id) to "
            f"pricing.json and re-run (unknown_model_policy=error)."
        )
    rate = models[key]  # USD per MTok

    inp = int(usage.get("input_tokens", 0) or 0)
    out = int(usage.get("output_tokens", 0) or 0)
    cache_read = int(usage.get("cache_read_input_tokens", 0) or 0)
    cache_create_total = int(usage.get("cache_creation_input_tokens", 0) or 0)

    cc = usage.get("cache_creation") or {}
    eph_5m = int(cc.get("ephemeral_5m_input_tokens", 0) or 0)
    eph_1h = int(cc.get("ephemeral_1h_input_tokens", 0) or 0)
    if eph_5m or eph_1h:
        # granular split present -> price each tier at its own rate
        write_5m, write_1h = eph_5m, eph_1h
        # any remainder (older transcripts) defaults to 5m so nothing is lost
        remainder = cache_create_total - (eph_5m + eph_1h)
        if remainder > 0:
            write_5m += remainder
    else:
        # no split -> price the whole cache-write at the default (5m) ephemeral rate
        write_5m, write_1h = cache_create_total, 0

    cost = (
        inp * rate["input"]
        + out * rate["output"]
        + cache_read * rate["cache_read"]
        + write_5m * rate["cache_write_5m"]
        + write_1h * rate["cache_write_1h"]
    ) / 1_000_000.0

    tokens = {
        "input": inp,
        "output": out,
        "cache_read": cache_read,
        "cache_write_5m": write_5m,
        "cache_write_1h": write_1h,
    }
    return cost, tokens


# ---------------------------------------------------------------------------
# transcript discovery
# ---------------------------------------------------------------------------
def default_project_root():
    return os.path.join(os.path.expanduser("~"), ".claude", "projects")


def discover_jsonl(project_dir):
    root = Path(project_dir)
    if not root.exists():
        raise CostError(f"transcript dir does not exist: {project_dir}")
    files = sorted(glob.glob(os.path.join(str(root), "**", "*.jsonl"), recursive=True))
    return files


def parse_since(s):
    if not s:
        return None
    try:
        return _dt.datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=_dt.timezone.utc)
    except ValueError:
        raise CostError(f"--since must be YYYY-MM-DD, got {s!r}")


def line_timestamp(rec):
    ts = rec.get("timestamp")
    if not ts:
        return None
    try:
        return _dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


# ---------------------------------------------------------------------------
# attribution
# ---------------------------------------------------------------------------
def feature_from_branch(branch, branch_prefix, default_bucket):
    """branch_prefix mode: feat/<feature>-* on the branch name -> bucket=<feature>.

    A branch like `feat/order-intake-fix-3` with prefix `feat/` buckets to
    `order-intake-fix-3`. A branch that does not start with the prefix (e.g.
    HEAD, main, detached) buckets to the explicit default.
    """
    if not branch or branch in ("HEAD", "main", "master", "develop"):
        return default_bucket
    if branch_prefix and branch.startswith(branch_prefix):
        tail = branch[len(branch_prefix):].strip("/")
        return tail or default_bucket
    return default_bucket


def feature_from_sidecar(rec, sidecar, default_bucket):
    """sidecar_map mode: nearest timestamp -> contract_id from a sidecar map.

    Sidecar shape (JSON): {"entries": [{"from": ISO8601, "to": ISO8601|null,
    "bucket": "C-001-order-intake"}, ...]}. A turn whose timestamp falls in
    [from, to) buckets to that entry; turns outside every window -> default.
    Built by a session-start/-stop hook (the only thing a hook CAN record:
    a timestamp -> contract id mapping, not cost). See README §sidecar_map.
    """
    ts = line_timestamp(rec)
    if ts is None or not sidecar:
        return default_bucket
    for e in sidecar.get("entries", []):
        try:
            frm = _dt.datetime.fromisoformat(str(e["from"]).replace("Z", "+00:00"))
        except (KeyError, ValueError):
            continue
        to_raw = e.get("to")
        if to_raw in (None, ""):
            to = None
        else:
            try:
                to = _dt.datetime.fromisoformat(str(to_raw).replace("Z", "+00:00"))
            except ValueError:
                to = None
        if ts >= frm and (to is None or ts < to):
            return e.get("bucket") or default_bucket
    return default_bucket


def agent_bucket(rec, default_bucket):
    """Attribute a turn to an agent.

    Transcripts carry no agent NAME. The only agent-adjacent signal is
    `isSidechain`: a sidechain turn ran inside a spawned subagent/Task, a
    non-sidechain turn ran in the main session. We bucket by that, keyed by the
    requestId family when present so distinct sidechains separate. Main-session
    turns bucket to "main"; sidechain turns to "subagent:<requestId-or-uuid>".
    """
    if rec.get("isSidechain"):
        rid = rec.get("requestId") or rec.get("uuid") or default_bucket
        return f"subagent:{rid}"
    return "main"


def day_bucket(rec):
    """Attribute a turn to its UTC calendar day (YYYY-MM-DD).

    The timestamp is normalized to UTC before taking the date so a single day
    bucket is stable regardless of the recorder's local offset. Turns with no
    parseable timestamp land in the reserved UNDATED_BUCKET (never dropped, so
    the day axis still reconciles to the grand total).
    """
    ts = line_timestamp(rec)
    if ts is None:
        return UNDATED_BUCKET
    if ts.tzinfo is not None:
        ts = ts.astimezone(_dt.timezone.utc)
    return ts.date().isoformat()


# ---------------------------------------------------------------------------
# core aggregation
# ---------------------------------------------------------------------------
def _new_acc():
    """A fresh cost+turns+token accumulator (one per bucket / day / day-split)."""
    return {"cost": 0.0, "turns": 0, "tokens": dict.fromkeys(TOKEN_KINDS, 0)}


def _accumulate(acc, cost, tokens):
    acc["cost"] += cost
    acc["turns"] += 1
    for k in TOKEN_KINDS:
        acc["tokens"][k] += tokens[k]


def aggregate(
    files,
    pricing_doc,
    pricing_path,
    axes,
    branch_prefix,
    default_bucket,
    since,
    sidecar,
    until=None,
    daily=False,
    daily_by=None,
):
    skip_set = set(pricing_doc.get("skip_models") or [])
    grand_total = 0.0
    grand_tokens = dict.fromkeys(TOKEN_KINDS, 0)
    n_turns = 0
    buckets = {ax: {} for ax in axes}
    # Optional per-day time series. `daily_series[day]` is an accumulator; when a
    # `daily_by` axis is given each day also carries a `split` sub-map so a panel
    # can stack one day's tokens/cost by model/feature/agent/session.
    daily_series = {} if (daily or daily_by) else None

    for fpath in files:
        try:
            with open(fpath, "r", encoding="utf-8") as fh:
                for raw in fh:
                    raw = raw.strip()
                    if not raw:
                        continue
                    try:
                        rec = json.loads(raw)
                    except json.JSONDecodeError:
                        continue  # skip malformed line (do NOT crash the whole run)
                    if rec.get("type") != "assistant":
                        continue
                    msg = rec.get("message") or {}
                    usage = msg.get("usage")
                    model = msg.get("model")
                    if not isinstance(usage, dict) or not model:
                        continue
                    if model in skip_set:
                        continue  # non-billable pseudo-model (e.g. "<synthetic>")
                    ts = line_timestamp(rec)
                    if since and ts is not None and ts < since:
                        continue
                    if until and ts is not None and ts >= until:
                        continue

                    cost, tokens = price_usage(usage, model, pricing_doc, pricing_path)
                    n_turns += 1
                    grand_total += cost
                    for k in grand_tokens:
                        grand_tokens[k] += tokens[k]

                    keys = {
                        "model": model,
                        "session": rec.get("sessionId") or default_bucket,
                        "agent": agent_bucket(rec, default_bucket),
                        "day": day_bucket(rec),
                    }
                    if sidecar:
                        keys["feature"] = feature_from_sidecar(rec, sidecar, default_bucket)
                    else:
                        keys["feature"] = feature_from_branch(
                            rec.get("gitBranch"), branch_prefix, default_bucket
                        )

                    for ax in axes:
                        _accumulate(buckets[ax].setdefault(keys[ax], _new_acc()), cost, tokens)

                    if daily_series is not None:
                        d = keys["day"]
                        day_acc = daily_series.setdefault(d, _new_acc())
                        _accumulate(day_acc, cost, tokens)
                        if daily_by:
                            split = day_acc.setdefault("split", {})
                            _accumulate(split.setdefault(keys[daily_by], _new_acc()), cost, tokens)
        except OSError as e:
            raise CostError(f"cannot read transcript {fpath}: {e}")

    # reconciliation: every axis's bucket sum must equal the grand total
    eps = 1e-6
    recon = {}
    reconciled = True
    for ax in axes:
        s = sum(b["cost"] for b in buckets[ax].values())
        ok = abs(s - grand_total) < max(eps, abs(grand_total) * 1e-9)
        recon[ax] = {"bucket_sum": round(s, 6), "ok": ok}
        reconciled = reconciled and ok

    result = {
        "files_scanned": len(files),
        "assistant_turns": n_turns,
        "total_cost_usd": round(grand_total, 6),
        "total_tokens": grand_tokens,
        "axes": list(axes),
        "buckets": {
            ax: {
                k: {"cost_usd": round(v["cost"], 6), "turns": v["turns"], "tokens": v["tokens"]}
                for k, v in sorted(buckets[ax].items(), key=lambda kv: -kv[1]["cost"])
            }
            for ax in axes
        },
        "reconciliation": recon,
        "reconciled": reconciled,
        "default_bucket": default_bucket,
        "pricing_as_of": pricing_doc.get("as_of"),
    }

    if daily_series is not None:
        # Emit the per-day time series in CHRONOLOGICAL order (the natural order
        # for a time chart), with the optional per-day split nested under "split".
        result["daily"] = {
            "by": daily_by,
            "days": [
                _emit_daily_day(day, acc)
                for day, acc in sorted(daily_series.items(), key=lambda kv: kv[0])
            ],
        }
    return result


def _emit_daily_day(day, acc):
    out = {
        "day": day,
        "cost_usd": round(acc["cost"], 6),
        "turns": acc["turns"],
        "tokens": acc["tokens"],
    }
    if "split" in acc:
        out["split"] = {
            k: {"cost_usd": round(v["cost"], 6), "turns": v["turns"], "tokens": v["tokens"]}
            for k, v in sorted(acc["split"].items(), key=lambda kv: -kv[1]["cost"])
        }
    return out


# ---------------------------------------------------------------------------
# budgets (advisory; the only hard exit is reconciliation, unless --budget-strict)
# ---------------------------------------------------------------------------
def evaluate_budgets(result, total_budget, budget_axis, bucket_budgets):
    """Compare totals / per-bucket spend to advisory ceilings.

    Returns a `budget` dict added to the result, or None when no budget was
    requested. `over_budget` is True if ANY ceiling (total or per-bucket) is
    exceeded. This is REPORTING only; the caller decides whether an overage is
    fatal (--budget-strict) -- reconciliation remains the unconditional gate.
    """
    if total_budget is None and not bucket_budgets:
        return None
    out = {"over_budget": False, "axis": budget_axis}
    if total_budget is not None:
        spent = result["total_cost_usd"]
        over = spent > total_budget + 1e-9
        out["total"] = {
            "cap_usd": round(total_budget, 6),
            "spent_usd": round(spent, 6),
            "remaining_usd": round(total_budget - spent, 6),
            "utilization": round(spent / total_budget, 6) if total_budget else None,
            "over": over,
        }
        out["over_budget"] = out["over_budget"] or over
    if bucket_budgets:
        ax_buckets = result["buckets"].get(budget_axis, {})
        rows = {}
        for name, cap in bucket_budgets.items():
            spent = ax_buckets.get(name, {}).get("cost_usd", 0.0)
            over = spent > cap + 1e-9
            rows[name] = {
                "cap_usd": round(cap, 6),
                "spent_usd": round(spent, 6),
                "remaining_usd": round(cap - spent, 6),
                "utilization": round(spent / cap, 6) if cap else None,
                "over": over,
            }
            out["over_budget"] = out["over_budget"] or over
        out["buckets"] = rows
    return out


# ---------------------------------------------------------------------------
# rendering
# ---------------------------------------------------------------------------
def _fmt_tokens(tk):
    """Compact one-line token summary (in/out/read/5m/1h), thousands-separated."""
    return (
        f"in={tk['input']:,} out={tk['output']:,} "
        f"read={tk['cache_read']:,} w5m={tk['cache_write_5m']:,} w1h={tk['cache_write_1h']:,}"
    )


def render_table(result):
    out = []
    out.append("=" * 78)
    out.append("ai-core-kit AI usage report  (OFFLINE, from transcript usage x pricing)")
    out.append(
        f"pricing as_of {result['pricing_as_of']}  |  "
        f"files={result['files_scanned']}  turns={result['assistant_turns']}"
    )
    out.append("=" * 78)
    for ax in result["axes"]:
        out.append("")
        out.append(f"## by {ax}")
        out.append(f"{'bucket':<34}{'turns':>7}{'cost USD':>12}{'in+out tok':>14}{'cache tok':>14}")
        out.append("-" * 81)
        for name, v in result["buckets"][ax].items():
            label = name if len(name) <= 33 else name[:30] + "..."
            tk = v["tokens"]
            io_tok = tk["input"] + tk["output"]
            cache_tok = tk["cache_read"] + tk["cache_write_5m"] + tk["cache_write_1h"]
            out.append(
                f"{label:<34}{v['turns']:>7}{v['cost_usd']:>12.4f}"
                f"{io_tok:>14,}{cache_tok:>14,}"
            )
        rc = result["reconciliation"][ax]
        flag = "OK" if rc["ok"] else "MISMATCH"
        out.append("-" * 81)
        out.append(
            f"{'sum(buckets)':<34}{'':>7}{rc['bucket_sum']:>12.4f}   "
            f"[reconcile vs total {result['total_cost_usd']:.4f}: {flag}]"
        )

    # per-day time series (only when --daily / --daily-by was requested)
    daily = result.get("daily")
    if daily:
        out.append("")
        by = daily.get("by")
        out.append(f"## daily time series" + (f" (split by {by})" if by else ""))
        out.append(f"{'day':<12}{'turns':>7}{'cost USD':>12}{'in+out tok':>14}{'cache tok':>14}")
        out.append("-" * 59)
        for d in daily["days"]:
            tk = d["tokens"]
            io_tok = tk["input"] + tk["output"]
            cache_tok = tk["cache_read"] + tk["cache_write_5m"] + tk["cache_write_1h"]
            out.append(
                f"{d['day']:<12}{d['turns']:>7}{d['cost_usd']:>12.4f}"
                f"{io_tok:>14,}{cache_tok:>14,}"
            )
            for name, sv in (d.get("split") or {}).items():
                label = name if len(name) <= 28 else name[:25] + "..."
                out.append(f"   - {label:<28}{sv['turns']:>5}{sv['cost_usd']:>11.4f}")

    # budget section (advisory unless --budget-strict)
    budget = result.get("budget")
    if budget:
        out.append("")
        out.append("## budget")
        tot = budget.get("total")
        if tot:
            util = f"{tot['utilization'] * 100:.1f}%" if tot["utilization"] is not None else "n/a"
            mark = "OVER" if tot["over"] else "ok"
            out.append(
                f"total: spent ${tot['spent_usd']:.4f} / cap ${tot['cap_usd']:.4f} "
                f"= {util}  (remaining ${tot['remaining_usd']:.4f})  [{mark}]"
            )
        if budget.get("buckets"):
            out.append(f"per-{budget.get('axis')} ceilings:")
            for name, row in budget["buckets"].items():
                util = f"{row['utilization'] * 100:.1f}%" if row["utilization"] is not None else "n/a"
                mark = "OVER" if row["over"] else "ok"
                label = name if len(name) <= 30 else name[:27] + "..."
                out.append(
                    f"  {label:<30} ${row['spent_usd']:>10.4f} / ${row['cap_usd']:>10.4f} "
                    f"= {util:>7}  [{mark}]"
                )
        out.append(
            f"over budget: {'YES -- exceeds a ceiling' if budget['over_budget'] else 'no'}"
        )

    out.append("")
    out.append("=" * 78)
    out.append(f"GRAND TOTAL: ${result['total_cost_usd']:.4f} USD")
    out.append("tokens: " + _fmt_tokens(result["total_tokens"]))
    out.append(
        f"reconciled across all axes: {'YES' if result['reconciled'] else 'NO -- INVESTIGATE'}"
    )
    out.append("=" * 78)
    return "\n".join(out)


# ---------------------------------------------------------------------------
# Markdown rendering  (a drop-in for a PR comment / GitHub job-summary)
# ---------------------------------------------------------------------------
# The Markdown report is built from the SAME `result` dict that table/json use
# (no recomputation): GitHub-flavored tables per axis, an optional daily series,
# a budget block, and a totals/reconciliation footer. It is plain GFM with no
# HTML, so it pastes cleanly into a PR comment or `$GITHUB_STEP_SUMMARY`.
def _md_num(n):
    """Thousands-separated integer for a Markdown cell."""
    return f"{int(n):,}"


def render_md(result):
    out = []
    out.append("# AI usage report")
    out.append("")
    out.append(
        f"_OFFLINE estimate: transcript `message.usage` x `pricing.json` "
        f"(as_of {result['pricing_as_of']})._"
    )
    out.append("")
    out.append(f"- **Grand total:** ${result['total_cost_usd']:.4f} USD")
    out.append(f"- **Assistant turns:** {result['assistant_turns']:,}  "
               f"(files scanned: {result['files_scanned']:,})")
    tk = result["total_tokens"]
    out.append(
        f"- **Tokens:** in {_md_num(tk['input'])} / out {_md_num(tk['output'])} / "
        f"cache-read {_md_num(tk['cache_read'])} / "
        f"cache-write {_md_num(tk['cache_write_5m'] + tk['cache_write_1h'])}"
    )
    out.append(
        f"- **Reconciled across all axes:** "
        f"{'yes' if result['reconciled'] else '**NO -- INVESTIGATE**'}"
    )
    out.append("")

    for ax in result["axes"]:
        out.append(f"## by {ax}")
        out.append("")
        out.append("| bucket | turns | cost USD | in+out tok | cache tok |")
        out.append("|---|---:|---:|---:|---:|")
        for name, v in result["buckets"][ax].items():
            t = v["tokens"]
            io_tok = t["input"] + t["output"]
            cache_tok = t["cache_read"] + t["cache_write_5m"] + t["cache_write_1h"]
            out.append(
                f"| {_md_cell(name)} | {v['turns']:,} | {v['cost_usd']:.4f} | "
                f"{_md_num(io_tok)} | {_md_num(cache_tok)} |"
            )
        rc = result["reconciliation"][ax]
        flag = "OK" if rc["ok"] else "**MISMATCH**"
        out.append(
            f"| **sum(buckets)** | | **{rc['bucket_sum']:.4f}** | | "
            f"_reconcile vs {result['total_cost_usd']:.4f}: {flag}_ |"
        )
        out.append("")

    daily = result.get("daily")
    if daily:
        by = daily.get("by")
        out.append("## daily time series" + (f" (split by {by})" if by else ""))
        out.append("")
        out.append("| day | turns | cost USD | in+out tok | cache tok |")
        out.append("|---|---:|---:|---:|---:|")
        for d in daily["days"]:
            t = d["tokens"]
            io_tok = t["input"] + t["output"]
            cache_tok = t["cache_read"] + t["cache_write_5m"] + t["cache_write_1h"]
            out.append(
                f"| {d['day']} | {d['turns']:,} | {d['cost_usd']:.4f} | "
                f"{_md_num(io_tok)} | {_md_num(cache_tok)} |"
            )
            for name, sv in (d.get("split") or {}).items():
                out.append(
                    f"| &nbsp;&nbsp;&bull; {_md_cell(name)} | {sv['turns']:,} | "
                    f"{sv['cost_usd']:.4f} | | |"
                )
        out.append("")

    budget = result.get("budget")
    if budget:
        out.append("## budget")
        out.append("")
        tot = budget.get("total")
        if tot:
            util = (f"{tot['utilization'] * 100:.1f}%"
                    if tot["utilization"] is not None else "n/a")
            mark = "OVER" if tot["over"] else "ok"
            out.append(
                f"- **total:** spent ${tot['spent_usd']:.4f} / cap "
                f"${tot['cap_usd']:.4f} = {util} "
                f"(remaining ${tot['remaining_usd']:.4f}) -- **{mark}**"
            )
        if budget.get("buckets"):
            out.append("")
            out.append(f"per-{budget.get('axis')} ceilings:")
            out.append("")
            out.append("| bucket | spent USD | cap USD | utilization | status |")
            out.append("|---|---:|---:|---:|---|")
            for name, row in budget["buckets"].items():
                util = (f"{row['utilization'] * 100:.1f}%"
                        if row["utilization"] is not None else "n/a")
                mark = "OVER" if row["over"] else "ok"
                out.append(
                    f"| {_md_cell(name)} | {row['spent_usd']:.4f} | "
                    f"{row['cap_usd']:.4f} | {util} | {mark} |"
                )
        out.append("")
        out.append(
            f"**Over budget:** {'YES -- exceeds a ceiling' if budget['over_budget'] else 'no'}"
        )
        out.append("")

    return "\n".join(out).rstrip() + "\n"


def _md_cell(s):
    """Escape a string so it is safe inside a single Markdown table cell."""
    return str(s).replace("|", "\\|").replace("\n", " ")


# ---------------------------------------------------------------------------
# HTML rendering  (a SINGLE self-contained file: inline CSS + inline SVG bars,
# NO external CSS/JS/CDN, NO deps -- opens standalone in any browser)
# ---------------------------------------------------------------------------
def _esc(s):
    """Minimal HTML-escape for text and attribute content."""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _svg_bar(value, vmax, width=180, height=14, fill="#4c78a8"):
    """A single inline horizontal SVG bar, proportional to value/vmax."""
    vmax = vmax if vmax > 0 else 1.0
    w = max(0.0, min(1.0, value / vmax)) * width
    return (
        f'<svg class="bar" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-label="{_esc(value)}">'
        f'<rect width="{width}" height="{height}" fill="#eee"/>'
        f'<rect width="{w:.2f}" height="{height}" fill="{fill}"/>'
        f'</svg>'
    )


def _svg_sparkline(values, width=260, height=40, stroke="#4c78a8"):
    """An inline SVG sparkline for a small numeric series (daily cost/tokens)."""
    if not values:
        return ""
    vmax = max(values) or 1.0
    n = len(values)
    if n == 1:
        pts = [(width / 2.0, height - (values[0] / vmax) * (height - 2) - 1)]
    else:
        step = width / (n - 1)
        pts = [(i * step, height - (v / vmax) * (height - 2) - 1)
               for i, v in enumerate(values)]
    path = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    dots = "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.6" fill="{stroke}"/>'
                   for x, y in pts)
    return (
        f'<svg class="spark" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}" role="img" aria-label="sparkline">'
        f'<polyline fill="none" stroke="{stroke}" stroke-width="1.5" points="{path}"/>'
        f'{dots}</svg>'
    )


_HTML_STYLE = """
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
body { font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
       margin: 0; padding: 2rem; max-width: 1000px; margin-inline: auto; color: #1b1b1b; background: #fff; }
h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
h2 { font-size: 1.15rem; margin: 1.6rem 0 .5rem; border-bottom: 1px solid #e3e3e3; padding-bottom: .25rem; }
.sub { color: #666; margin: 0 0 1rem; }
.cards { display: flex; flex-wrap: wrap; gap: .75rem; margin: 1rem 0; }
.card { flex: 1 1 160px; border: 1px solid #e3e3e3; border-radius: 8px; padding: .6rem .8rem; background: #fafafa; }
.card .k { color: #666; font-size: .75rem; text-transform: uppercase; letter-spacing: .03em; }
.card .v { font-size: 1.25rem; font-weight: 600; }
table { border-collapse: collapse; width: 100%; margin: .25rem 0 1rem; font-variant-numeric: tabular-nums; }
th, td { padding: .35rem .55rem; border-bottom: 1px solid #ededed; text-align: left; }
th { font-size: .75rem; text-transform: uppercase; letter-spacing: .03em; color: #555; }
td.num, th.num { text-align: right; }
tr.sum td { border-top: 2px solid #ccc; font-weight: 600; }
.bar { vertical-align: middle; border-radius: 2px; }
.ok { color: #1a7f37; font-weight: 600; }
.bad { color: #b3261e; font-weight: 700; }
.badge { display: inline-block; padding: .05rem .45rem; border-radius: 999px; font-size: .72rem; font-weight: 600; }
.badge.ok { background: #dafbe1; color: #1a7f37; }
.badge.bad { background: #ffe3e0; color: #b3261e; }
footer { margin-top: 2rem; color: #777; font-size: .8rem; border-top: 1px solid #e3e3e3; padding-top: .75rem; }
@media (prefers-color-scheme: dark) {
  body { color: #e6e6e6; background: #161616; }
  .card { background: #1f1f1f; border-color: #333; }
  h2 { border-color: #333; } th, td { border-color: #2a2a2a; }
  .sub, .card .k, th, footer { color: #9a9a9a; }
}
"""


def render_html(result):
    tk = result["total_tokens"]
    cache_w = tk["cache_write_5m"] + tk["cache_write_1h"]
    recon_badge = ('<span class="badge ok">reconciled</span>'
                   if result["reconciled"]
                   else '<span class="badge bad">NOT reconciled</span>')
    h = []
    h.append("<!doctype html>")
    h.append('<html lang="en"><head><meta charset="utf-8">')
    h.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    h.append("<title>AI usage report</title>")
    h.append(f"<style>{_HTML_STYLE}</style></head><body>")
    h.append("<h1>AI usage report</h1>")
    h.append(
        f'<p class="sub">OFFLINE estimate: transcript <code>message.usage</code> '
        f'&times; <code>pricing.json</code> (as_of {_esc(result["pricing_as_of"])}). '
        f'{recon_badge}</p>'
    )
    h.append('<div class="cards">')
    h.append(f'<div class="card"><div class="k">Grand total</div>'
             f'<div class="v">${result["total_cost_usd"]:.4f}</div></div>')
    h.append(f'<div class="card"><div class="k">Assistant turns</div>'
             f'<div class="v">{result["assistant_turns"]:,}</div></div>')
    h.append(f'<div class="card"><div class="k">Input + output tok</div>'
             f'<div class="v">{tk["input"] + tk["output"]:,}</div></div>')
    h.append(f'<div class="card"><div class="k">Cache tok (read/write)</div>'
             f'<div class="v">{tk["cache_read"]:,} / {cache_w:,}</div></div>')
    h.append("</div>")

    for ax in result["axes"]:
        buckets = result["buckets"][ax]
        vmax = max((v["cost_usd"] for v in buckets.values()), default=0.0)
        h.append(f"<h2>by {_esc(ax)}</h2>")
        h.append("<table><thead><tr>"
                 "<th>bucket</th><th class='num'>turns</th>"
                 "<th class='num'>cost USD</th><th>cost</th>"
                 "<th class='num'>in+out tok</th><th class='num'>cache tok</th>"
                 "</tr></thead><tbody>")
        for name, v in buckets.items():
            t = v["tokens"]
            io_tok = t["input"] + t["output"]
            cache_tok = t["cache_read"] + t["cache_write_5m"] + t["cache_write_1h"]
            h.append(
                f"<tr><td>{_esc(name)}</td>"
                f"<td class='num'>{v['turns']:,}</td>"
                f"<td class='num'>{v['cost_usd']:.4f}</td>"
                f"<td>{_svg_bar(v['cost_usd'], vmax)}</td>"
                f"<td class='num'>{io_tok:,}</td>"
                f"<td class='num'>{cache_tok:,}</td></tr>"
            )
        rc = result["reconciliation"][ax]
        flag = ('<span class="ok">OK</span>' if rc["ok"]
                else '<span class="bad">MISMATCH</span>')
        h.append(
            f"<tr class='sum'><td>sum(buckets)</td><td></td>"
            f"<td class='num'>{rc['bucket_sum']:.4f}</td>"
            f"<td colspan='3'>reconcile vs {result['total_cost_usd']:.4f}: {flag}</td></tr>"
        )
        h.append("</tbody></table>")

    daily = result.get("daily")
    if daily and daily["days"]:
        by = daily.get("by")
        costs = [d["cost_usd"] for d in daily["days"]]
        h.append("<h2>daily time series" + (f" (split by {_esc(by)})" if by else "") + "</h2>")
        h.append(f'<p>{_svg_sparkline(costs)} <small>daily cost USD '
                 f'(max ${max(costs):.4f})</small></p>')
        h.append("<table><thead><tr><th>day</th>"
                 "<th class='num'>turns</th><th class='num'>cost USD</th>"
                 "<th class='num'>in+out tok</th><th class='num'>cache tok</th>"
                 "</tr></thead><tbody>")
        for d in daily["days"]:
            t = d["tokens"]
            io_tok = t["input"] + t["output"]
            cache_tok = t["cache_read"] + t["cache_write_5m"] + t["cache_write_1h"]
            h.append(
                f"<tr><td>{_esc(d['day'])}</td>"
                f"<td class='num'>{d['turns']:,}</td>"
                f"<td class='num'>{d['cost_usd']:.4f}</td>"
                f"<td class='num'>{io_tok:,}</td>"
                f"<td class='num'>{cache_tok:,}</td></tr>"
            )
            for name, sv in (d.get("split") or {}).items():
                h.append(
                    f"<tr><td>&nbsp;&nbsp;&bull; {_esc(name)}</td>"
                    f"<td class='num'>{sv['turns']:,}</td>"
                    f"<td class='num'>{sv['cost_usd']:.4f}</td>"
                    f"<td></td><td></td></tr>"
                )
        h.append("</tbody></table>")

    budget = result.get("budget")
    if budget:
        h.append("<h2>budget</h2>")
        tot = budget.get("total")
        if tot:
            util = (f"{tot['utilization'] * 100:.1f}%"
                    if tot["utilization"] is not None else "n/a")
            badge = ('<span class="badge bad">OVER</span>' if tot["over"]
                     else '<span class="badge ok">ok</span>')
            h.append(
                f"<p>total: spent ${tot['spent_usd']:.4f} / cap "
                f"${tot['cap_usd']:.4f} = {util} "
                f"(remaining ${tot['remaining_usd']:.4f}) {badge}</p>"
            )
        if budget.get("buckets"):
            h.append(f"<p>per-{_esc(budget.get('axis'))} ceilings:</p>")
            h.append("<table><thead><tr><th>bucket</th>"
                     "<th class='num'>spent USD</th><th class='num'>cap USD</th>"
                     "<th class='num'>utilization</th><th>status</th>"
                     "</tr></thead><tbody>")
            for name, row in budget["buckets"].items():
                util = (f"{row['utilization'] * 100:.1f}%"
                        if row["utilization"] is not None else "n/a")
                badge = ('<span class="badge bad">OVER</span>' if row["over"]
                         else '<span class="badge ok">ok</span>')
                h.append(
                    f"<tr><td>{_esc(name)}</td>"
                    f"<td class='num'>{row['spent_usd']:.4f}</td>"
                    f"<td class='num'>{row['cap_usd']:.4f}</td>"
                    f"<td class='num'>{util}</td><td>{badge}</td></tr>"
                )
            h.append("</tbody></table>")
        over = budget["over_budget"]
        h.append(f'<p><strong>Over budget:</strong> '
                 f'{"YES -- exceeds a ceiling" if over else "no"}</p>')

    h.append(
        f'<footer>ai-core-kit offline cost aggregator &middot; '
        f'pricing as_of {_esc(result["pricing_as_of"])} &middot; '
        f'files scanned {result["files_scanned"]:,} &middot; '
        f'reconciled: {"yes" if result["reconciled"] else "NO"}</footer>'
    )
    h.append("</body></html>")
    return "\n".join(h) + "\n"


# ---------------------------------------------------------------------------
# manifest-driven defaults (CHILD layer reads telemetry.* from the manifest)
# ---------------------------------------------------------------------------
def manifest_defaults(manifest_path):
    """Read telemetry.attribution defaults from a CHILD project.manifest.yaml.

    Stdlib-only minimal scan: we do NOT depend on PyYAML (children may not have
    it). We pull `mode`, `branch_prefix`, `default_bucket`, `enabled`, and
    `pricing_ref` from the `telemetry:` block with a tolerant line reader. CLI
    flags always WIN over manifest values; this only supplies defaults.
    """
    p = Path(manifest_path)
    if not p.is_file():
        return {}
    vals, in_tel, in_attr = {}, False, False
    manifest_major = None
    for line in p.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        # Capture the top-level schema_version (a MAJOR-version guard). A manifest
        # whose MAJOR != ACCEPTED_MANIFEST_MAJOR may have a shifted shape, so we
        # refuse to read its telemetry.* defaults (see the post-scan check).
        if indent == 0 and stripped.startswith("schema_version:"):
            sv = stripped.split(":", 1)[1].split("#", 1)[0].strip()
            try:
                manifest_major = int(sv)
            except ValueError:
                manifest_major = None
        if stripped.startswith("telemetry:"):
            in_tel, in_attr = True, False
            continue
        if in_tel and indent == 0 and stripped.endswith(":"):
            in_tel = False  # left the telemetry block
        if not in_tel:
            continue
        if stripped.startswith("attribution:"):
            in_attr = True
            continue
        kv = stripped.split(":", 1)
        if len(kv) != 2:
            continue
        key, val = kv[0].strip(), kv[1].strip().strip('"').strip("'")
        val = val.split("#", 1)[0].strip()
        if key == "enabled":
            vals["enabled"] = val.lower() == "true"
        elif key == "pricing_ref":
            vals["pricing_ref"] = val
        elif in_attr and key == "mode":
            vals["mode"] = val
        elif in_attr and key == "branch_prefix":
            vals["branch_prefix"] = val
        elif in_attr and key == "default_bucket":
            vals["default_bucket"] = val
    # MAJOR-version guard: a recognized-but-mismatched major => ignore the
    # manifest's defaults (stderr notice). CLI flags still apply, so aggregation
    # never wedges. An ABSENT schema_version is tolerated (pre-version manifests).
    if manifest_major is not None and manifest_major != ACCEPTED_MANIFEST_MAJOR:
        print(
            f"manifest schema_version {manifest_major} != accepted major "
            f"{ACCEPTED_MANIFEST_MAJOR}; ignoring its telemetry.* defaults "
            f"(re-run /ack-init --migrate to upgrade the manifest).",
            file=sys.stderr,
        )
        return {}
    return vals


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(
        prog="aggregate.py",
        description="Offline Claude Code cost aggregator (transcript usage x pricing.json).",
    )
    ap.add_argument("--project-dir", default=default_project_root(),
                    help="dir to glob for **/*.jsonl (default: ~/.claude/projects)")
    ap.add_argument("--since", default=None, help="only count turns on/after YYYY-MM-DD (UTC)")
    ap.add_argument("--until", default=None, help="only count turns BEFORE YYYY-MM-DD (UTC, exclusive)")
    ap.add_argument("--pricing", default=os.path.join(here, "pricing.json"),
                    help="pricing map JSON (default: ./pricing.json next to this script)")
    ap.add_argument("--by", default=",".join(DEFAULT_AXES),
                    help="comma-separated axes from: " + ",".join(VALID_AXES) +
                         " ('day' = per-UTC-day time series axis)")
    ap.add_argument("--branch-prefix", default="feat/",
                    help="branch_prefix attribution: feature = branch after this prefix")
    ap.add_argument("--default-bucket", default="unattributed",
                    help="explicit bucket for turns matching no feature/agent rule")
    ap.add_argument("--sidecar-map", default=None,
                    help="sidecar_map JSON (timestamp->bucket). Overrides branch_prefix.")
    ap.add_argument("--daily", action="store_true",
                    help="add a per-UTC-day time series of tokens + cost (result.daily)")
    ap.add_argument("--daily-by", default=None, choices=("model", "feature", "agent", "session"),
                    help="split each day in the time series by this axis (implies --daily)")
    ap.add_argument("--budget", type=float, default=None,
                    help="advisory total USD ceiling; reports headroom/overage (see --budget-strict)")
    ap.add_argument("--budget-axis", default="session", choices=("model", "feature", "agent", "session", "day"),
                    help="axis that --bucket-budget ceilings apply to (default: session)")
    ap.add_argument("--bucket-budget", action="append", default=None, metavar="NAME=USD",
                    help="per-bucket USD ceiling on --budget-axis, e.g. --bucket-budget feat-x=12.50 "
                         "(repeatable)")
    ap.add_argument("--budget-strict", action="store_true",
                    help="exit non-zero if ANY budget ceiling is exceeded (default: report only)")
    ap.add_argument("--manifest", default=None,
                    help="CHILD project.manifest.yaml; supplies telemetry.* defaults (CLI wins)")
    ap.add_argument("--format", choices=("table", "json", "both", "md", "html"), default="both",
                    help="output format: table|json|both (default), or md / html "
                         "(self-contained Markdown / single-file HTML report)")
    return ap


def parse_bucket_budgets(items):
    """Parse repeated NAME=USD --bucket-budget flags into {name: float}."""
    out = {}
    for raw in items or []:
        if "=" not in raw:
            raise CostError(f"--bucket-budget must be NAME=USD, got {raw!r}")
        name, val = raw.rsplit("=", 1)
        name = name.strip()
        try:
            cap = float(val.strip())
        except ValueError:
            raise CostError(f"--bucket-budget USD must be a number, got {val!r} in {raw!r}")
        if not name:
            raise CostError(f"--bucket-budget needs a non-empty NAME, got {raw!r}")
        out[name] = cap
    return out


def main(argv=None):
    ap = build_parser()
    args = ap.parse_args(argv)

    # manifest supplies DEFAULTS; explicit CLI flags WIN.
    if args.manifest:
        md = manifest_defaults(args.manifest)
        if md.get("enabled") is False:
            print("telemetry.enabled is false in manifest; nothing to aggregate.", file=sys.stderr)
            return 0
        if md.get("pricing_ref") and args.pricing == ap.get_default("pricing"):
            ref = md["pricing_ref"]
            if not os.path.isabs(ref):
                ref = os.path.join(os.path.dirname(os.path.abspath(args.manifest)), ref)
            args.pricing = ref
        if md.get("branch_prefix") and "--branch-prefix" not in (argv or sys.argv):
            args.branch_prefix = md["branch_prefix"]
        if md.get("default_bucket") and "--default-bucket" not in (argv or sys.argv):
            args.default_bucket = md["default_bucket"]
        if md.get("mode") == "sidecar_map" and not args.sidecar_map:
            print("manifest attribution.mode=sidecar_map but no --sidecar-map given; "
                  "falling back to branch_prefix.", file=sys.stderr)

    axes = [a.strip() for a in args.by.split(",") if a.strip()]
    bad = [a for a in axes if a not in VALID_AXES]
    if bad:
        print(f"error: unknown axis/axes {bad}; valid: {list(VALID_AXES)}", file=sys.stderr)
        return 2
    if not axes:
        axes = list(DEFAULT_AXES)

    sidecar = None
    if args.sidecar_map:
        sp = Path(args.sidecar_map)
        if not sp.is_file():
            print(f"error: sidecar map not found: {args.sidecar_map}", file=sys.stderr)
            return 2
        try:
            sidecar = json.loads(sp.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"error: sidecar map is not valid JSON: {e}", file=sys.stderr)
            return 2

    daily = args.daily or bool(args.daily_by)

    try:
        bucket_budgets = parse_bucket_budgets(args.bucket_budget)
        pricing_doc = load_pricing(args.pricing)
        since = parse_since(args.since)
        until = parse_since(args.until)
        files = discover_jsonl(args.project_dir)
        result = aggregate(
            files, pricing_doc, args.pricing, axes,
            args.branch_prefix, args.default_bucket, since, sidecar,
            until=until, daily=daily, daily_by=args.daily_by,
        )
    except CostError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 1

    # Per-bucket budgets need their axis present in the result; add it on demand
    # so `--bucket-budget` works without the user also having to pass `--by`.
    if bucket_budgets and args.budget_axis not in result["buckets"]:
        print(
            f"error: --bucket-budget targets axis {args.budget_axis!r} which is not in "
            f"--by ({','.join(axes)}); add it, e.g. --by {','.join(axes)},{args.budget_axis}",
            file=sys.stderr,
        )
        return 2
    budget = evaluate_budgets(result, args.budget, args.budget_axis, bucket_budgets)
    if budget is not None:
        result["budget"] = budget

    if args.format in ("table", "both"):
        print(render_table(result))
    if args.format in ("json", "both"):
        if args.format == "both":
            print()  # separate table from JSON on stdout
        print(json.dumps(result, indent=2, sort_keys=False))
    if args.format == "md":
        print(render_md(result), end="")
    if args.format == "html":
        print(render_html(result), end="")

    if not result["reconciled"]:
        print("FATAL: bucket sums do not reconcile to grand total.", file=sys.stderr)
        return 1
    if args.budget_strict and budget is not None and budget["over_budget"]:
        print("FATAL: over budget (--budget-strict).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
