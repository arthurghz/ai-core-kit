#!/usr/bin/env python3
"""Generate clean, hand-authored asciinema v2 casts for the site.

The previous recording (docs/demo/ack-usage.cast, an 80-col live capture) carried
100-col lines + an absolute dev path, so asciinema-player clipped them on the hero.
These casts are authored deterministically: a fixed 92-col terminal, every printable
line kept <= ~84 chars, clean `npx create-ack` commands, a tasteful typing rhythm,
and a final hold before the loop restarts. Output goes to BOTH docs/demo/ (the
committable source) and site/public/demo/ (served by Next).

Run:  python3 scripts/demo/make-casts.py
"""
import json, os

WIDTH, HEIGHT = 92, 30
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIRS = [os.path.join(ROOT, "docs", "demo"), os.path.join(ROOT, "site", "public", "demo")]

# --- ANSI helpers ---------------------------------------------------------
RESET = "\x1b[0m"
def c(s, code): return f"\x1b[{code}m{s}{RESET}"
def dim(s):     return c(s, "2")
def green(s):   return c(s, "32")
def cyan(s):    return c(s, "36")
def yellow(s):  return c(s, "33")
def mag(s):     return c(s, "35")
def bold(s):    return c(s, "1")
def prompt():   return c("$", "38;5;111") + " "


def build(script):
    """script: list of steps. Each step is one of:
       ("type", "command")            -> render prompt, type the command, newline
       ("out",  ["line", ...], gap)   -> print each line with `gap` seconds between
       ("wait", seconds)              -> idle hold
    Returns (events, ) where events are [t, "o", text]."""
    events = []
    t = 0.4

    def emit(text):
        nonlocal t
        events.append([round(t, 3), "o", text])

    for step in script:
        kind = step[0]
        if kind == "type":
            cmd = step[1]
            emit(prompt())
            for ch in cmd:
                t += 0.035
                emit(ch)
            t += 0.35
            emit("\r\n")
        elif kind == "out":
            lines, gap = step[1], step[2]
            for ln in lines:
                t += gap
                emit(ln + "\r\n")
        elif kind == "wait":
            t += step[1]
    # final hold so the loop doesn't snap
    t += 2.6
    return events


def write_cast(name, title, script):
    events = build(script)
    header = {"version": 2, "width": WIDTH, "height": HEIGHT,
              "title": title, "env": {"TERM": "xterm-256color"}}
    out = [json.dumps(header)] + [json.dumps(e) for e in events]
    body = "\n".join(out) + "\n"
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, name), "w") as f:
            f.write(body)
    cols = max((len(_strip(e[2])) for e in events), default=0)
    print(f"wrote {name}: {len(events)} events, widest printable line = {cols} cols")


import re
_ANSI = re.compile(r"\x1b\[[0-9;]*m")
def _strip(s): return _ANSI.sub("", s).replace("\r", "").replace("\n", "")


# ---------------------------------------------------------------------------
# Cast 1 — the hero: fork-free bootstrap into a spec-first repo.
# ---------------------------------------------------------------------------
BOOTSTRAP = [
    ("type", "npx create-ack acme --archetype fullstack"),
    ("out", [dim("◐ validating answers → frozen manifest → deterministic render…")], 0.5),
    ("wait", 0.4),
    ("out", [
        "",
        green("✓") + " scaffolded " + bold("acme") + dim("  (fullstack · zero-LLM render)"),
        "",
        "  " + cyan("specs/") + "         PRD · ARCHITECTURE · DOMAIN · REQUIREMENTS",
        "                 DESIGN · PLAN · ROADMAP · NON-GOALS   " + dim("← spec-first"),
        "  " + cyan("CLAUDE.md") + "      best-in-class, spec-first pointer",
        "  " + cyan(".claude/") + "       skills · agents · commands · contract-gate",
        "  " + cyan("design-system/") + " shadcn tokens (brand materialized)",
        "  " + cyan("telemetry/") + "     offline cost aggregator",
        dim("  32 files written"),
    ], 0.18),
    ("wait", 0.7),
    ("out", [
        "",
        yellow("▶ REQUIRED NEXT STEP"),
        "  " + bold("/ack-spec") + dim("  → author your complete specs + PLAN before code"),
        "",
    ], 0.22),
    ("type", "ls specs/"),
    ("out", [
        cyan("ARCHITECTURE.md") + "  " + cyan("DESIGN.md") + "  " + cyan("DOMAIN.md") + "  " + cyan("NON-GOALS.md"),
        cyan("PLAN.md") + "  " + cyan("PRD.md") + "  " + cyan("REQUIREMENTS.md") + "  " + cyan("ROADMAP.md"),
    ], 0.16),
    ("wait", 0.5),
]

# ---------------------------------------------------------------------------
# Cast 2 — /ack-spec authoring the specs (docs: getting-started / concepts).
# ---------------------------------------------------------------------------
ACK_SPEC = [
    ("type", "/ack-spec"),
    ("out", [
        dim("interviewing intent → authoring the spec set (prose, not code)…"),
        "",
        green("✓") + " PRD.md          " + dim("problem · personas · north-star metric"),
        green("✓") + " DOMAIN.md       " + dim("ubiquitous language · INV-NN invariants"),
        green("✓") + " REQUIREMENTS.md " + dim("FR-NN / NFR-NN · given/when/then"),
        green("✓") + " ARCHITECTURE.md " + dim("decisions · trade-offs · ADRs"),
        green("✓") + " DESIGN.md       " + dim("brand · screens · DA-NN acceptance"),
        green("✓") + " PLAN.md         " + dim("first slice · build order · gates"),
        green("✓") + " ROADMAP.md  " + green("✓") + " NON-GOALS.md",
        "",
        green("✓") + " CLAUDE.md refreshed " + dim("— design + requirements front-and-center"),
        "",
        mag("●") + " brand color confirmed " + bold("#4f46e5") + dim(" → re-render materializes theme"),
        dim("  next: review C-001 contract, then implement against the spec"),
    ], 0.18),
    ("wait", 0.6),
]

# ---------------------------------------------------------------------------
# Cast 3 — the SaaS archetype (docs: archetypes / SaaS).
# ---------------------------------------------------------------------------
SAAS = [
    ("type", "npx create-ack orbit --archetype saas"),
    ("out", [
        dim("◐ rendering the SaaS stack…"),
        "",
        green("✓") + " scaffolded " + bold("orbit"),
        "",
        "  " + cyan("Next.js") + " App Router  ·  " + cyan("React") + "  ·  " + cyan("shadcn/ui"),
        "  " + cyan("Clerk") + " auth  ·  " + cyan("Supabase") + " Postgres  ·  " + cyan("Drizzle") + " ORM",
        "  " + cyan("Stripe") + " billing  ·  deploy → " + cyan("Vercel"),
        "",
        "  app/(dashboard)  ·  app/api/billing/{checkout,webhook}",
        "  middleware.ts (Clerk)  ·  lib/db (Drizzle+Supabase)",
        dim("  + the full spec-first doc set, like every archetype"),
    ], 0.18),
    ("wait", 0.6),
]

if __name__ == "__main__":
    write_cast("ack-usage.cast", "create-ack — bootstrap a spec-first repo", BOOTSTRAP)
    write_cast("ack-spec.cast", "/ack-spec — author the specs", ACK_SPEC)
    write_cast("ack-saas.cast", "create-ack --archetype saas", SAAS)
    print("done.")
