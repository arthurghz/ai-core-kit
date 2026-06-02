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
# USAGE
#   python3 aggregate.py [--project-dir DIR] [--since YYYY-MM-DD]
#                        [--pricing PATH] [--by feature,model,agent,session]
#                        [--branch-prefix feat/] [--default-bucket unattributed]
#                        [--format table|json|both] [--manifest PATH]
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
VALID_AXES = ("model", "feature", "agent", "session")
DEFAULT_AXES = ("feature", "model", "agent", "session")

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


# ---------------------------------------------------------------------------
# core aggregation
# ---------------------------------------------------------------------------
def aggregate(
    files,
    pricing_doc,
    pricing_path,
    axes,
    branch_prefix,
    default_bucket,
    since,
    sidecar,
):
    skip_set = set(pricing_doc.get("skip_models") or [])
    grand_total = 0.0
    grand_tokens = {"input": 0, "output": 0, "cache_read": 0, "cache_write_5m": 0, "cache_write_1h": 0}
    n_turns = 0
    buckets = {ax: {} for ax in axes}

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

                    cost, tokens = price_usage(usage, model, pricing_doc, pricing_path)
                    n_turns += 1
                    grand_total += cost
                    for k in grand_tokens:
                        grand_tokens[k] += tokens[k]

                    keys = {
                        "model": model,
                        "session": rec.get("sessionId") or default_bucket,
                        "agent": agent_bucket(rec, default_bucket),
                    }
                    if sidecar:
                        keys["feature"] = feature_from_sidecar(rec, sidecar, default_bucket)
                    else:
                        keys["feature"] = feature_from_branch(
                            rec.get("gitBranch"), branch_prefix, default_bucket
                        )

                    for ax in axes:
                        b = buckets[ax].setdefault(
                            keys[ax], {"cost": 0.0, "turns": 0, "tokens": dict.fromkeys(grand_tokens, 0)}
                        )
                        b["cost"] += cost
                        b["turns"] += 1
                        for k in grand_tokens:
                            b["tokens"][k] += tokens[k]
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

    return {
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


# ---------------------------------------------------------------------------
# rendering
# ---------------------------------------------------------------------------
def render_table(result):
    out = []
    out.append("=" * 72)
    out.append("ai-core-kit cost report  (OFFLINE, from transcript usage x pricing)")
    out.append(
        f"pricing as_of {result['pricing_as_of']}  |  "
        f"files={result['files_scanned']}  turns={result['assistant_turns']}"
    )
    out.append("=" * 72)
    for ax in result["axes"]:
        out.append("")
        out.append(f"## by {ax}")
        out.append(f"{'bucket':<40}{'turns':>8}{'cost USD':>14}")
        out.append("-" * 62)
        for name, v in result["buckets"][ax].items():
            label = name if len(name) <= 39 else name[:36] + "..."
            out.append(f"{label:<40}{v['turns']:>8}{v['cost_usd']:>14.4f}")
        rc = result["reconciliation"][ax]
        flag = "OK" if rc["ok"] else "MISMATCH"
        out.append("-" * 62)
        out.append(
            f"{'sum(buckets)':<40}{'':>8}{rc['bucket_sum']:>14.4f}   "
            f"[reconcile vs total {result['total_cost_usd']:.4f}: {flag}]"
        )
    out.append("")
    out.append("=" * 72)
    out.append(f"GRAND TOTAL: ${result['total_cost_usd']:.4f} USD")
    tk = result["total_tokens"]
    out.append(
        "tokens: "
        f"in={tk['input']:,} out={tk['output']:,} "
        f"cache_read={tk['cache_read']:,} "
        f"cache_write_5m={tk['cache_write_5m']:,} cache_write_1h={tk['cache_write_1h']:,}"
    )
    out.append(
        f"reconciled across all axes: {'YES' if result['reconciled'] else 'NO -- INVESTIGATE'}"
    )
    out.append("=" * 72)
    return "\n".join(out)


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
    for line in p.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
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
    ap.add_argument("--pricing", default=os.path.join(here, "pricing.json"),
                    help="pricing map JSON (default: ./pricing.json next to this script)")
    ap.add_argument("--by", default=",".join(DEFAULT_AXES),
                    help="comma-separated axes from: " + ",".join(VALID_AXES))
    ap.add_argument("--branch-prefix", default="feat/",
                    help="branch_prefix attribution: feature = branch after this prefix")
    ap.add_argument("--default-bucket", default="unattributed",
                    help="explicit bucket for turns matching no feature/agent rule")
    ap.add_argument("--sidecar-map", default=None,
                    help="sidecar_map JSON (timestamp->bucket). Overrides branch_prefix.")
    ap.add_argument("--manifest", default=None,
                    help="CHILD project.manifest.yaml; supplies telemetry.* defaults (CLI wins)")
    ap.add_argument("--format", choices=("table", "json", "both"), default="both",
                    help="output format (default: both)")
    return ap


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

    try:
        pricing_doc = load_pricing(args.pricing)
        since = parse_since(args.since)
        files = discover_jsonl(args.project_dir)
        result = aggregate(
            files, pricing_doc, args.pricing, axes,
            args.branch_prefix, args.default_bucket, since, sidecar,
        )
    except CostError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 1

    if args.format in ("table", "both"):
        print(render_table(result))
    if args.format in ("json", "both"):
        if args.format == "both":
            print()  # separate table from JSON on stdout
        print(json.dumps(result, indent=2, sort_keys=False))

    if not result["reconciled"]:
        print("FATAL: bucket sums do not reconcile to grand total.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
