#!/usr/bin/env python3
"""Live terminal monitor — tokens & cost per feature (or model/agent/session),
re-aggregated every few seconds, drawn in place like `top`.

This is the Tier-1 LOCAL monitor: token transcripts live on your machine
(~/.claude/projects), so a terminal session you keep open is the most honest
"live" view there can be (the offline cost is recomputed each tick — see
claude-code#11008). It re-runs the cost engine and reuses its exact pricing +
attribution by shelling out to `aggregate.py --format json`; it re-implements
nothing.

    python3 telemetry/watch.py                  # per-feature, refresh 5s, by cost
    python3 telemetry/watch.py --by model       # or model | agent | session
    python3 telemetry/watch.py --sort tokens    # rank by tokens instead of $
    python3 telemetry/watch.py --budget 250     # show a budget bar + over-budget flag
    python3 telemetry/watch.py --once            # render one frame and exit (CI/tests)

Ctrl-C to quit.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
AGGREGATE = os.path.join(HERE, "aggregate.py")
TOKEN_KINDS = ("input", "output", "cache_read", "cache_write_5m", "cache_write_1h")

C = {
    "reset": "\x1b[0m", "dim": "\x1b[2m", "bold": "\x1b[1m", "cyan": "\x1b[36m",
    "green": "\x1b[32m", "yellow": "\x1b[33m", "red": "\x1b[31m", "mag": "\x1b[35m",
}
CLEAR_HOME = "\x1b[2J\x1b[H"


def human_tokens(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n / 1_000:.1f}k"
    return str(int(n))


def fetch(args):
    """Run the cost engine once and return (result_dict, error_str)."""
    axis = args.by.split(",")[0]
    cmd = [sys.executable, AGGREGATE, "--by", args.by, "--format", "json"]
    if args.since:
        cmd += ["--since", args.since]
    if args.until:
        cmd += ["--until", args.until]
    if args.pricing:
        cmd += ["--pricing", args.pricing]
    if args.budget is not None:
        cmd += ["--budget", str(args.budget), "--budget-axis", axis]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True)
    except Exception as e:  # pragma: no cover
        return None, f"failed to launch aggregate.py: {e}"
    if p.returncode != 0:
        return None, (p.stderr or p.stdout or f"aggregate.py exited {p.returncode}").strip()
    try:
        return json.loads(p.stdout), None
    except json.JSONDecodeError as e:
        return None, f"aggregate.py did not emit valid JSON: {e}"


def render(result, args, width):
    axis = args.by.split(",")[0]
    buckets = result.get("buckets", {}).get(axis, {})

    def tok_total(b):
        return sum(b.get("tokens", {}).get(k, 0) for k in TOKEN_KINDS)

    key = (lambda kv: kv[1].get("cost_usd", 0.0)) if args.sort == "cost" else (lambda kv: tok_total(kv[1]))
    rows = sorted(buckets.items(), key=key, reverse=True)
    rows = rows[: args.top]

    total_cost = result.get("total_cost_usd", 0.0)
    total_tok = sum((result.get("total_tokens") or {}).get(k, 0) for k in TOKEN_KINDS)
    turns = result.get("assistant_turns", 0)
    maxv = max((key(r) for r in rows), default=0) or 1

    name_w = min(28, max(10, max((len(k) for k, _ in rows), default=10)))
    bar_w = max(8, min(28, width - name_w - 40))
    ts = time.strftime("%H:%M:%S")

    out = []
    out.append(f"{C['bold']}{C['cyan']}ai-core-kit · live token monitor{C['reset']}"
               f"  {C['dim']}by {axis} · sort {args.sort} · ↻ {args.interval:g}s · {ts}{C['reset']}")
    out.append(f"{C['dim']}{'─' * min(width, name_w + bar_w + 40)}{C['reset']}")
    out.append(f"{C['dim']}{'':<{name_w}}  {'tokens':>8}  {'cost($)':>9}  {'turns':>5}{C['reset']}")
    for name, b in rows:
        cost = b.get("cost_usd", 0.0)
        tks = tok_total(b)
        v = key((name, b))
        fill = int(round(bar_w * (v / maxv)))
        bar = C["green"] + "█" * fill + C["dim"] + "·" * (bar_w - fill) + C["reset"]
        nm = name if len(name) <= name_w else name[: name_w - 1] + "…"
        out.append(f"{C['cyan']}{nm:<{name_w}}{C['reset']}  {human_tokens(tks):>8}  "
                   f"{cost:>9.4f}  {b.get('turns', 0):>5}  {bar}")
    if not rows:
        out.append(f"{C['dim']}(no usage yet — transcripts accrue as you work){C['reset']}")
    out.append(f"{C['dim']}{'─' * min(width, name_w + bar_w + 40)}{C['reset']}")
    out.append(f"{C['bold']}TOTAL{C['reset']}{'':<{max(0, name_w - 5)}}  "
               f"{human_tokens(total_tok):>8}  {total_cost:>9.4f}  {turns:>5}"
               f"   {C['dim']}reconciled: {'yes' if result.get('reconciled') else 'NO'}{C['reset']}")

    budget = result.get("budget")
    if budget and budget.get("total"):
        t = budget["total"]
        util = t.get("utilization", 0.0)
        col = C["red"] if t.get("over") else (C["yellow"] if util > 0.8 else C["green"])
        bw = max(10, min(30, width - 30))
        fill = int(round(bw * min(util, 1.0)))
        bar = col + "█" * fill + C["dim"] + "·" * (bw - fill) + C["reset"]
        flag = f" {C['red']}⚠ OVER BUDGET{C['reset']}" if t.get("over") else ""
        out.append(f"{C['bold']}budget{C['reset']} {bar} {col}{util * 100:5.1f}%{C['reset']}"
                   f" {C['dim']}${t.get('spent_usd', 0):.2f}/${t.get('cap_usd', 0):.2f}{C['reset']}{flag}")

    out.append(f"{C['dim']}offline · recomputed each tick (claude-code#11008) · Ctrl-C to quit{C['reset']}")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description="Live terminal monitor — tokens & cost per axis, refreshed in place.")
    ap.add_argument("--by", default="feature", help="axis to rank: feature|model|agent|session (default feature)")
    ap.add_argument("--interval", type=float, default=5.0, help="refresh seconds (default 5)")
    ap.add_argument("--sort", choices=["cost", "tokens"], default="cost", help="rank by cost or tokens (default cost)")
    ap.add_argument("--top", type=int, default=15, help="rows to show (default 15)")
    ap.add_argument("--budget", type=float, help="advisory budget ceiling (USD) → adds a budget bar")
    ap.add_argument("--since", help="only count turns at/after this UTC date/duration (e.g. 7d, 2026-06-01)")
    ap.add_argument("--until", help="only count turns before this UTC date (exclusive)")
    ap.add_argument("--pricing", help="path to pricing.json (defaults to the one beside aggregate.py)")
    ap.add_argument("--once", action="store_true", help="render a single frame and exit (CI/testing)")
    args = ap.parse_args()

    try:
        while True:
            result, err = fetch(args)
            width = shutil.get_terminal_size((100, 30)).columns
            frame = render(result, args, width) if err is None else (
                f"{C['red']}monitor: cost engine error{C['reset']}\n{err}")
            sys.stdout.write(CLEAR_HOME + frame + "\n")
            sys.stdout.flush()
            if args.once:
                return 0 if err is None else 1
            time.sleep(args.interval)
    except KeyboardInterrupt:
        sys.stdout.write("\n")
        return 0


if __name__ == "__main__":
    sys.exit(main())
