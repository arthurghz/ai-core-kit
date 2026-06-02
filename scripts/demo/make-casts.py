#!/usr/bin/env python3
"""Generate clean, hand-authored asciinema v2 casts for the site.

Deterministic (no live capture): fixed 92-col terminal, every printable line kept
<= ~84 chars, clean `npx create-ack` commands, a tasteful typing rhythm, and a hold
before the loop. Each cast tells a fuller story — bootstrap, `cd` into the repo,
`tree` the structure, `cat CLAUDE.md`, `/ack-spec`, `git commit` — plus one per
archetype and an install walkthrough. Output goes to BOTH docs/demo/ (committable
source) and site/public/demo/ (served by Next).

Run:  python3 scripts/demo/make-casts.py
"""
import json, os, re

WIDTH, HEIGHT = 92, 32
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIRS = [os.path.join(ROOT, "docs", "demo"), os.path.join(ROOT, "site", "public", "demo")]

RESET = "\x1b[0m"
def c(s, code): return f"\x1b[{code}m{s}{RESET}"
def dim(s):     return c(s, "2")
def green(s):   return c(s, "32")
def cyan(s):    return c(s, "36")
def yellow(s):  return c(s, "33")
def mag(s):     return c(s, "35")
def bold(s):    return c(s, "1")
def prompt():   return c("$", "38;5;111") + " "
def cprompt():  return c("›", "38;5;141") + " "   # Claude Code slash-command prompt

_ANSI = re.compile(r"\x1b\[[0-9;]*m")
def _strip(s): return _ANSI.sub("", s).replace("\r", "").replace("\n", "")


def build(script):
    """steps: ("type", cmd[, prompt]) | ("out", [lines], gap) | ("wait", secs)."""
    events, t = [], 0.4
    def emit(text):
        nonlocal t
        events.append([round(t, 3), "o", text])
    for step in script:
        kind = step[0]
        if kind == "type":
            emit(step[2] if len(step) > 2 else prompt())
            for ch in step[1]:
                t += 0.033
                emit(ch)
            t += 0.35
            emit("\r\n")
        elif kind == "out":
            for ln in step[1]:
                t += step[2]
                emit(ln + "\r\n")
        elif kind == "wait":
            t += step[1]
    t += 2.4
    return events


def write_cast(name, title, script):
    events = build(script)
    header = {"version": 2, "width": WIDTH, "height": HEIGHT,
              "title": title, "env": {"TERM": "xterm-256color"}}
    body = "\n".join([json.dumps(header)] + [json.dumps(e) for e in events]) + "\n"
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, name), "w").write(body)
    widest = max((len(_strip(e[2])) for e in events if e[2].strip()), default=0)
    flag = "  !! TOO WIDE" if widest > WIDTH else ""
    print(f"  {name:22} {len(events):4} events  widest={widest:3} cols{flag}")


# ── Cast 1 — HERO: fork-free bootstrap → enter the repo → spec-first → commit ──
BOOTSTRAP = [
    ("type", "npx create-ack acme --archetype fullstack"),
    ("out", [dim("◐ validating answers → frozen manifest → deterministic render…")], 0.5),
    ("wait", 0.4),
    ("out", [green("✓") + " scaffolded " + bold("acme") + dim("  (fullstack · zero-LLM render · 32 files)")], 0.2),
    ("wait", 0.45),
    ("type", "cd acme && tree -L 1"),
    ("out", [
        bold("acme"),
        "├── " + cyan("CLAUDE.md") + dim("        spec-first pointer"),
        "├── " + cyan("specs/") + dim("           PRD · ARCHITECTURE · DOMAIN · REQUIREMENTS · …"),
        "├── " + cyan(".claude/") + dim("         skills · agents · commands · contract-gate"),
        "├── " + cyan("design-system/") + dim("   shadcn · brand tokens · component MCP"),
        "└── app/  api/  docs/  " + cyan("telemetry/"),
    ], 0.16),
    ("wait", 0.55),
    ("type", "cat CLAUDE.md"),
    ("out", [
        bold("# acme — house rules (spec-first)"),
        dim("# Lean pointer. The truth lives in the specs — read them first."),
        "",
        cyan("@specs/PRD.md") + "  " + cyan("@specs/REQUIREMENTS.md") + "  " + cyan("@specs/DESIGN.md"),
        cyan("@specs/PLAN.md") + dim("   ← design + requirements front-and-center"),
    ], 0.15),
    ("wait", 0.55),
    ("type", "ls specs/"),
    ("out", [
        cyan("PRD.md") + "  " + cyan("ARCHITECTURE.md") + "  " + cyan("DOMAIN.md") + "  " + cyan("REQUIREMENTS.md"),
        cyan("DESIGN.md") + "  " + cyan("PLAN.md") + "  " + cyan("ROADMAP.md") + "  " + cyan("NON-GOALS.md"),
    ], 0.15),
    ("wait", 0.5),
    ("type", "/ack-spec", cprompt()),
    ("out", [
        dim("interviewing intent → authoring the spec set (prose, not code)…"),
        green("✓") + " PRD · DOMAIN · REQUIREMENTS · ARCHITECTURE · DESIGN · PLAN",
        green("✓") + " CLAUDE.md refreshed   " + mag("●") + " brand " + bold("#4f46e5") + dim(" → theme materialized"),
    ], 0.2),
    ("wait", 0.5),
    ("type", "git init -q && git add -A && git commit -qm \"spec-first scaffold\""),
    ("out", [
        dim("[main (root-commit)] spec-first scaffold"),
        green("✓") + " specs first, code follows — ready to build",
    ], 0.2),
    ("wait", 1.1),
]

# ── Cast 2 — /ack-spec authoring (quickstart / concepts) ──
ACK_SPEC = [
    ("type", "/ack-spec", cprompt()),
    ("out", [
        dim("interviewing intent → authoring the spec set (prose, not code)…"), "",
        green("✓") + " PRD.md          " + dim("problem · personas · north-star metric"),
        green("✓") + " DOMAIN.md       " + dim("ubiquitous language · INV-NN invariants"),
        green("✓") + " REQUIREMENTS.md " + dim("FR-NN / NFR-NN · given/when/then"),
        green("✓") + " ARCHITECTURE.md " + dim("decisions · trade-offs · ADRs"),
        green("✓") + " DESIGN.md       " + dim("brand · screens · DA-NN acceptance"),
        green("✓") + " PLAN.md         " + dim("first slice · build order · gates"),
        green("✓") + " ROADMAP.md  " + green("✓") + " NON-GOALS.md", "",
        green("✓") + " CLAUDE.md refreshed " + dim("— design + requirements front-and-center"),
        mag("●") + " brand " + bold("#4f46e5") + dim(" confirmed → re-render materializes the theme"),
    ], 0.16),
    ("wait", 0.8),
]

# ── Cast 3 — backend-api archetype ──
BACKEND = [
    ("type", "npx create-ack orders-api --archetype backend-api --yes"),
    ("out", [green("✓") + " scaffolded " + bold("orders-api") + dim("  (backend-api · deep · 21 files)")], 0.3),
    ("wait", 0.4),
    ("type", "tree -L 1 orders-api"),
    ("out", [
        bold("orders-api"),
        "├── " + cyan("CLAUDE.md") + "   " + cyan("project.manifest.yaml"),
        "├── " + cyan("api/") + dim("        OpenAPI seed + typed handlers"),
        "├── " + cyan("specs/") + dim("      PRD · ARCHITECTURE · DOMAIN · REQUIREMENTS · PLAN · …"),
        "├── " + cyan(".claude/") + dim("    settings · hooks/contract-gate · commands"),
        "└── docs/" + dim("  (contracts/)") + "   " + cyan("telemetry/"),
    ], 0.17),
    ("wait", 0.9),
]

# ── Cast 4 — fullstack archetype ──
FULLSTACK = [
    ("type", "npx create-ack acme --archetype fullstack --yes"),
    ("out", [green("✓") + " scaffolded " + bold("acme") + dim("  (fullstack · deep · 46 files)")], 0.3),
    ("wait", 0.4),
    ("type", "tree -L 1 acme"),
    ("out", [
        bold("acme"),
        "├── " + cyan("app/") + dim("  frontend") + "    " + cyan("api/") + dim("  backend"),
        "├── " + cyan("design-system/") + dim("   shadcn · brand tokens · component MCP"),
        "├── " + cyan("specs/") + dim("  8 docs") + "    " + cyan("CLAUDE.md") + dim("  spec-first pointer"),
        "├── " + cyan(".claude/") + dim("   skills · agents · commands · contract-gate"),
        "└── docs/   " + cyan("telemetry/"),
    ], 0.17),
    ("wait", 0.9),
]

# ── Cast 5 — saas archetype ──
SAAS = [
    ("type", "npx create-ack orbit --archetype saas --yes"),
    ("out", [
        green("✓") + " scaffolded " + bold("orbit") + dim("  (saas · deep)"),
        "  " + cyan("Next.js") + " · " + cyan("React") + " · " + cyan("shadcn") + " · " + cyan("Clerk") + " · " + cyan("Supabase") + " · " + cyan("Drizzle") + " · " + cyan("Stripe") + " · " + cyan("Vercel"),
    ], 0.25),
    ("wait", 0.4),
    ("type", "tree -L 2 orbit"),
    ("out", [
        bold("orbit"),
        "├── app/",
        "│   ├── (dashboard)/" + dim("     protected app") + "   page.tsx" + dim("  marketing"),
        "│   └── api/billing/" + dim("     checkout · webhook (Stripe)"),
        "├── middleware.ts" + dim("        Clerk auth"),
        "├── lib/" + dim("                  auth · db (Drizzle+Supabase) · stripe"),
        "├── " + cyan("design-system/") + "   " + cyan("specs/") + dim(" (8 docs)") + "   " + cyan(".claude/"),
    ], 0.17),
    ("wait", 0.9),
]

# ── Cast 6 — minimal-core (monorepo / library-sdk / infra-iac) ──
MINIMAL = [
    ("type", "npx create-ack toolkit --archetype library-sdk --yes"),
    ("out", [green("✓") + " scaffolded " + bold("toolkit") + dim("  (minimal-core — the always-on safe core)")], 0.3),
    ("wait", 0.4),
    ("type", "tree toolkit"),
    ("out", [
        bold("toolkit"),
        "├── " + cyan("CLAUDE.md") + dim("              spec-first pointer"),
        "├── " + cyan("project.manifest.yaml") + dim("  the single source of truth"),
        "└── " + cyan("specs/") + dim("                 PRD · ARCHITECTURE · DOMAIN · … skeletons"),
        "",
        dim("monorepo · library-sdk · infra-iac render this safe core today;"),
        dim("backend-api · fullstack · saas are the deep archetypes."),
    ], 0.17),
    ("wait", 0.9),
]

# ── Cast 7 — installation walkthrough ──
INSTALL = [
    ("type", "node -v"),
    ("out", [dim("v20.11.0") + dim("   # Node >= 18 — that's the only prerequisite")], 0.25),
    ("wait", 0.35),
    ("type", "npx create-ack --help"),
    ("out", [
        bold("create-ack") + dim(" — scaffold a spec-first Claude Code project (zero-LLM)"), "",
        "  " + green("npx create-ack") + " <name> --archetype <type>", "",
        "  archetypes  backend-api · fullstack · saas · monorepo · library-sdk · infra-iac",
        "  flags       --yes  --lang  --framework  --here  --no-docs", "",
        dim("  or, inside Claude Code:  ") + cyan("/ack-init") + dim("   (the interactive interview)"),
    ], 0.16),
    ("wait", 0.9),
]

CASTS = {
    "ack-usage.cast": ("create-ack — bootstrap a spec-first repo", BOOTSTRAP),
    "ack-spec.cast": ("/ack-spec — author the specs", ACK_SPEC),
    "ack-backend-api.cast": ("create-ack --archetype backend-api", BACKEND),
    "ack-fullstack.cast": ("create-ack --archetype fullstack", FULLSTACK),
    "ack-saas.cast": ("create-ack --archetype saas", SAAS),
    "ack-minimal.cast": ("create-ack — minimal-core archetypes", MINIMAL),
    "ack-install.cast": ("install & run create-ack", INSTALL),
}

if __name__ == "__main__":
    print("generating casts (92 cols):")
    for name, (title, script) in CASTS.items():
        write_cast(name, title, script)
    print("done.")
