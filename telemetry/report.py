#!/usr/bin/env python3
# =============================================================================
# report.py -- ai-core-kit Tier-0 "Delivery & AI-cost" report  (META layer)
# =============================================================================
# WHAT THIS IS
#   The zero-infra (Tier 0) report generator. It runs the two stdlib engines
#   that already live next to it -- aggregate.py (offline cost & token usage
#   from Claude Code transcripts) and dora.py (the four DORA keys from local
#   git history) -- and stitches their results into ONE self-contained artifact:
#
#     --format md    a single Markdown document (clean GFM tables + summaries),
#                    a drop-in for a PR comment or `$GITHUB_STEP_SUMMARY`.
#     --format html  a SINGLE self-contained .html file: inline <style> + inline
#                    SVG bars/sparklines, NO external CSS/JS/CDN and NO deps, so
#                    it opens standalone in any browser.
#
#   It is a VIEW, not a second source of truth: it imports and calls the same
#   functions aggregate.py / dora.py expose, so the numbers (and their fail-loud
#   + reconciliation guarantees) come straight from those engines -- this file
#   duplicates none of their logic.
#
# WHY ONE COMBINED REPORT
#   "How fast do we ship, and what did the AI cost to ship it?" is one question.
#   Tier 0 answers it with no Prometheus/Grafana: cost+tokens (always machine-
#   local; see the issue-11008 locality note in aggregate.py) on top, delivery
#   (DORA, from git) below, in a single file you can attach to a release or PR.
#
# USAGE
#   python3 report.py [--format md|html] [--out FILE]
#                     [--since 30d|YYYY-MM-DD] [--until YYYY-MM-DD]
#                     [--budget USD] [--budget-axis AXIS] [--bucket-budget N=USD]
#                     [--by AXES] [--project-dir DIR] [--pricing PATH]
#                     [--repo DIR] [--deploy-mode tag|merge] [--use-gh] ...
#
#   --since is shared: the cost side reads it as a UTC calendar date (it must be
#   YYYY-MM-DD for cost) and the DORA side accepts the same value OR a relative
#   window (30d|12w|6m|1y). Pass an absolute date to drive BOTH from one flag, or
#   set --dora-since / a relative --since for DORA only (see --help).
#
# EXIT CODES (inherit the engines' fail-loud contract)
#   0  ok.   1  a cost reconciliation failure, an unknown-model/pricing error,
#   a DORA collection error, or (with --budget-strict) a budget overage. The
#   report is only written when both engines succeed.
# =============================================================================

import argparse
import datetime as _dt
import os
import sys

# Import the sibling engines. They live next to this file; make that importable
# regardless of the cwd this script is invoked from (e.g. observability/ runs it
# as `../report.py`). We import the MODULES (not symbols) so it is obvious every
# number comes from them and none is recomputed here.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import aggregate  # noqa: E402
import dora        # noqa: E402


class ReportError(Exception):
    """Fatal report error (delegates the engines' own fail-loud errors)."""


# ---------------------------------------------------------------------------
# run the two engines  (no logic duplicated -- we call their public functions)
# ---------------------------------------------------------------------------
def build_cost_result(args):
    """Run aggregate.py's pipeline and return its result dict (or raise)."""
    bucket_budgets = aggregate.parse_bucket_budgets(args.bucket_budget)
    pricing_doc = aggregate.load_pricing(args.pricing)
    since = aggregate.parse_since(args.since)
    until = aggregate.parse_since(args.until)
    files = aggregate.discover_jsonl(args.project_dir)

    axes = [a.strip() for a in args.by.split(",") if a.strip()]
    bad = [a for a in axes if a not in aggregate.VALID_AXES]
    if bad:
        raise ReportError(f"unknown cost axis/axes {bad}; valid: {list(aggregate.VALID_AXES)}")
    if not axes:
        axes = list(aggregate.DEFAULT_AXES)
    # A per-bucket budget needs its axis present in the result; add it on demand
    # so --bucket-budget works without the caller also passing --by (mirrors the
    # convenience aggregate.py's own CLI offers).
    if bucket_budgets and args.budget_axis not in axes:
        axes.append(args.budget_axis)

    result = aggregate.aggregate(
        files, pricing_doc, args.pricing, axes,
        args.branch_prefix, args.default_bucket, since, args.sidecar,
        until=until, daily=args.daily, daily_by=args.daily_by,
    )
    budget = aggregate.evaluate_budgets(result, args.budget, args.budget_axis, bucket_budgets)
    if budget is not None:
        result["budget"] = budget
    return result


def build_dora_result(args):
    """Run dora.py's collect_and_compute and return its result dict (or raise)."""
    return dora.collect_and_compute(
        repo=args.repo,
        deploy_mode=args.deploy_mode,
        tag_glob=args.deploy_tag_glob,
        branch=args.branch,
        hotfix_glob=args.hotfix_glob,
        since=args.dora_since,
        use_gh=args.use_gh,
    )


# ---------------------------------------------------------------------------
# combine  (delegate body rendering to the engines; only the wrapper is here)
# ---------------------------------------------------------------------------
def combine_md(cost, dora_res, generated):
    """One Markdown document = cost section + DORA section + a shared footer."""
    parts = []
    parts.append("# Delivery & AI-cost report")
    parts.append("")
    parts.append(f"_Generated {generated} -- ai-core-kit Tier-0 (offline, zero infra)._")
    parts.append("")
    parts.append(f"- **AI spend (grand total):** ${cost['total_cost_usd']:.4f} USD "
                 f"across {cost['assistant_turns']:,} assistant turns")
    df = dora_res["deployment_frequency"]
    lt = dora_res["lead_time_for_changes"]
    parts.append(f"- **Delivery:** {df['deploys']} deploys "
                 f"({df['rating']}), lead time {lt['median_human'] or 'n/a'} ({lt['rating']})")
    recon = "reconciled" if cost["reconciled"] else "**NOT reconciled -- INVESTIGATE**"
    parts.append(f"- **Cost integrity:** {recon}")
    parts.append("")
    parts.append("---")
    parts.append("")
    # Reuse each engine's own Markdown body (demoting their H1 to H2 so this
    # combined doc keeps a single top-level title).
    parts.append(_demote_md_heading(aggregate.render_md(cost)))
    parts.append("")
    parts.append("---")
    parts.append("")
    parts.append(_demote_md_heading(dora.render_md(dora_res)))
    return "\n".join(parts).rstrip() + "\n"


def _demote_md_heading(md):
    """Turn a sub-report's leading `# Title` into `## Title` so the combined
    document keeps exactly one H1. Only the first line is touched."""
    lines = md.split("\n")
    if lines and lines[0].startswith("# "):
        lines[0] = "#" + lines[0]
    return "\n".join(lines)


def combine_html(cost, dora_res, generated):
    """One self-contained HTML file. We render each engine's HTML body and lift
    just the inner <body> content + <style> into a single document, so the result
    is ONE file with NO external CSS/JS/CDN (the engines already guarantee that
    for their own fragments; we only concatenate)."""
    cost_style, cost_body = _split_html(aggregate.render_html(cost))
    dora_style, dora_body = _split_html(dora.render_html(dora_res))

    df = dora_res["deployment_frequency"]
    lt = dora_res["lead_time_for_changes"]
    recon_badge = ('<span class="rbadge ok">reconciled</span>' if cost["reconciled"]
                   else '<span class="rbadge bad">NOT reconciled</span>')

    h = []
    h.append("<!doctype html>")
    h.append('<html lang="en"><head><meta charset="utf-8">')
    h.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    h.append("<title>Delivery &amp; AI-cost report</title>")
    h.append("<style>" + _COMBINED_STYLE + cost_style + dora_style + "</style>")
    h.append("</head><body>")
    h.append('<header class="ack-report-head">')
    h.append("<h1>Delivery &amp; AI-cost report</h1>")
    h.append(f'<p class="sub">Generated {aggregate._esc(generated)} '
             f'&middot; ai-core-kit Tier-0 (offline, zero infra)</p>')
    h.append('<div class="cards">')
    h.append(f'<div class="card"><div class="k">AI spend</div>'
             f'<div class="v">${cost["total_cost_usd"]:.4f}</div>'
             f'<div class="s">{cost["assistant_turns"]:,} turns &middot; {recon_badge}</div></div>')
    h.append(f'<div class="card"><div class="k">Deploys</div>'
             f'<div class="v">{df["deploys"]}</div>'
             f'<div class="s">{aggregate._esc(df["rating"])}</div></div>')
    h.append(f'<div class="card"><div class="k">Lead time</div>'
             f'<div class="v">{aggregate._esc(lt["median_human"] or "n/a")}</div>'
             f'<div class="s">{aggregate._esc(lt["rating"])}</div></div>')
    h.append("</div></header>")
    h.append('<section class="ack-section">' + cost_body + "</section>")
    h.append('<section class="ack-section">' + dora_body + "</section>")
    h.append("</body></html>")
    return "\n".join(h) + "\n"


# A thin wrapper style; the engines' own <style> blocks are concatenated after
# it. Scoped-ish class names (ack-*) avoid clobbering the engine rules.
_COMBINED_STYLE = """
.ack-report-head { margin-bottom: 1.5rem; }
.ack-section { border-top: 3px solid #d0d0d0; margin-top: 2rem; padding-top: .5rem; }
.ack-section h1 { font-size: 1.35rem; }
.rbadge { display: inline-block; padding: .05rem .45rem; border-radius: 999px; font-size: .72rem; font-weight: 600; }
.rbadge.ok { background: #dafbe1; color: #1a7f37; }
.rbadge.bad { background: #ffe3e0; color: #b3261e; }
@media (prefers-color-scheme: dark) { .ack-section { border-color: #333; } }
"""


def _split_html(doc):
    """Pull (inline <style> contents, inner <body> contents) out of a full HTML
    document produced by an engine's render_html. Stdlib-only string slicing --
    the engines emit a known, simple shape (one <style>...</style>, one
    <body>...</body>), so a parser is overkill. Raises if the shape is unexpected
    (fail-loud rather than emit a broken combined file)."""
    s_open = doc.find("<style>")
    s_close = doc.find("</style>")
    b_open = doc.find("<body>")
    b_close = doc.rfind("</body>")
    if -1 in (s_open, s_close, b_open, b_close):
        raise ReportError("engine HTML did not match the expected <style>/<body> shape")
    style = doc[s_open + len("<style>"):s_close]
    body = doc[b_open + len("<body>"):b_close]
    return style, body


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(
        prog="report.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=(
            "Tier-0 Delivery & AI-cost report: combines aggregate.py (offline "
            "cost/tokens) + dora.py (DORA four keys from git) into ONE self-"
            "contained Markdown or HTML file. A view over the engines -- it "
            "duplicates none of their math and inherits their fail-loud contract."
        ),
    )
    ap.add_argument("--format", choices=("md", "html"), default="html",
                    help="report format: html (single self-contained file, default) or md")
    ap.add_argument("--out", default=None,
                    help="write the report to FILE (default: stdout)")
    # shared / cost (aggregate.py) options ----------------------------------
    ap.add_argument("--since", default=None,
                    help="cost lower bound YYYY-MM-DD (UTC). Also feeds DORA unless "
                         "--dora-since is given (DORA also accepts 30d|12w|6m|1y).")
    ap.add_argument("--until", default=None,
                    help="cost upper bound YYYY-MM-DD (UTC, exclusive)")
    ap.add_argument("--project-dir", default=aggregate.default_project_root(),
                    help="transcript dir to glob for **/*.jsonl (default ~/.claude/projects)")
    ap.add_argument("--pricing", default=os.path.join(here, "pricing.json"),
                    help="pricing map JSON (default: ./pricing.json next to this script)")
    ap.add_argument("--by", default=",".join(aggregate.DEFAULT_AXES),
                    help="cost axes: " + ",".join(aggregate.VALID_AXES))
    ap.add_argument("--branch-prefix", default="feat/",
                    help="branch_prefix attribution: feature = branch after this prefix")
    ap.add_argument("--default-bucket", default="unattributed",
                    help="explicit bucket for turns matching no feature/agent rule")
    ap.add_argument("--sidecar-map", default=None,
                    help="sidecar_map JSON (timestamp->bucket); overrides branch_prefix")
    ap.add_argument("--daily", action="store_true",
                    help="add a per-UTC-day cost/token time series (sparkline in HTML)")
    ap.add_argument("--daily-by", default=None,
                    choices=("model", "feature", "agent", "session"),
                    help="split each day in the time series by this axis (implies --daily)")
    ap.add_argument("--budget", type=float, default=None,
                    help="advisory total USD ceiling; reports headroom/overage")
    ap.add_argument("--budget-axis", default="session",
                    choices=("model", "feature", "agent", "session", "day"),
                    help="axis that --bucket-budget ceilings apply to (default session)")
    ap.add_argument("--bucket-budget", action="append", default=None, metavar="NAME=USD",
                    help="per-bucket USD ceiling on --budget-axis (repeatable)")
    ap.add_argument("--budget-strict", action="store_true",
                    help="exit non-zero if ANY budget ceiling is exceeded")
    # DORA (dora.py) options ------------------------------------------------
    ap.add_argument("--repo", default=".",
                    help="git work tree for the DORA side (default: .)")
    ap.add_argument("--dora-since", default=None,
                    help="DORA window (30d|12w|6m|1y|YYYY-MM-DD); defaults to --since or 30d")
    ap.add_argument("--deploy-mode", choices=("tag", "merge"), default="tag",
                    help="DORA deploy proxy: release tag (default) or first-parent commit")
    ap.add_argument("--deploy-tag-glob", default="v*",
                    help="tag glob that marks a release/deploy (tag mode; default v*)")
    ap.add_argument("--branch", default=None,
                    help="default branch for DORA merge mode (default: auto-detect)")
    ap.add_argument("--hotfix-glob", default="*hotfix*",
                    help="glob marking a commit subject/ref as a hotfix")
    ap.add_argument("--use-gh", action="store_true",
                    help="enrich DORA change-failure with `gh` CI conclusions (best-effort)")
    return ap


def _resolve_sidecar(path):
    if not path:
        return None
    import json
    from pathlib import Path
    p = Path(path)
    if not p.is_file():
        raise ReportError(f"sidecar map not found: {path}")
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except ValueError as e:
        raise ReportError(f"sidecar map is not valid JSON: {e}")


def main(argv=None):
    ap = build_parser()
    args = ap.parse_args(argv)
    args.daily = args.daily or bool(args.daily_by)
    # DORA window: explicit --dora-since wins; else reuse --since (an absolute
    # YYYY-MM-DD is valid for both engines); else dora.py's own 30d default.
    args.dora_since = args.dora_since or args.since or "30d"

    try:
        args.sidecar = _resolve_sidecar(args.sidecar_map)
        cost = build_cost_result(args)
        dora_res = build_dora_result(args)
    except (ReportError, aggregate.CostError, dora.DoraError) as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 1

    generated = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    if args.format == "md":
        doc = combine_md(cost, dora_res, generated)
    else:
        doc = combine_html(cost, dora_res, generated)

    if args.out:
        try:
            with open(args.out, "w", encoding="utf-8") as fh:
                fh.write(doc)
        except OSError as e:
            print(f"FATAL: cannot write --out {args.out}: {e}", file=sys.stderr)
            return 1
        print(f"wrote {args.format} report to {args.out} "
              f"({len(doc):,} bytes)", file=sys.stderr)
    else:
        sys.stdout.write(doc)

    # Inherit the engines' fail-loud contract: a cost reconciliation failure is
    # always fatal; a budget overage is fatal only under --budget-strict.
    if not cost["reconciled"]:
        print("FATAL: cost bucket sums do not reconcile to grand total.", file=sys.stderr)
        return 1
    budget = cost.get("budget")
    if args.budget_strict and budget is not None and budget["over_budget"]:
        print("FATAL: over budget (--budget-strict).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
