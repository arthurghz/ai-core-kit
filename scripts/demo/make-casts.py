#!/usr/bin/env python3
"""Generate clean, hand-authored asciinema v2 casts for the site.

Deterministic (no live capture): fixed 92-col terminal, every printable line kept
<= ~84 chars, clean `npx @arthurghz/create-ack` commands, a tasteful typing rhythm, and a hold
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


# pacing — tuned so each clip lands in the ~10-15s readable window when played
# at speed 1 with NO idleTimeLimit cap (see components/TerminalCast.jsx). The
# trailing HOLD keeps the final result on screen long enough to read before loop.
TYPE_CPS, TYPE_TAIL = 0.04, 0.25
HOLD = 5.0

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
                t += TYPE_CPS
                emit(ch)
            t += TYPE_TAIL
            emit("\r\n")
        elif kind == "out":
            for ln in step[1]:
                t += step[2]
                emit(ln + "\r\n")
        elif kind == "wait":
            t += step[1]
    t += HOLD
    emit("")   # trailing no-op holds the final frame HOLD seconds before the loop
    return events


def write_cast(name, title, script):
    events = build(script)
    header = {"version": 2, "width": WIDTH, "height": HEIGHT,
              "title": title, "env": {"TERM": "xterm-256color"}}
    body = "\n".join([json.dumps(header)] + [json.dumps(e) for e in events]) + "\n"
    for d in OUT_DIRS:
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, name), "w").write(body)
    dur = events[-1][0] if events else 0
    widest = max((len(_strip(e[2])) for e in events if e[2].strip()), default=0)
    flag = ("  !! WIDE" if widest > WIDTH else "") + ("  !! LONG" if dur > 16 else "") + ("  !! SHORT" if dur < 9 else "")
    print(f"  {name:24} {dur:5.1f}s  widest={widest:3}{flag}")


# ── Cast 1 — HERO: fork-free bootstrap → enter the repo → spec-first → commit ──
BOOTSTRAP = [
    ("type", "npx @arthurghz/create-ack acme --archetype fullstack"),
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
    ("type", "/ack-spec", cprompt()),
    ("out", [
        dim("interviewing intent → authoring the spec set (prose, not code)…"),
        green("✓") + " PRD · DOMAIN · REQUIREMENTS · ARCHITECTURE · DESIGN · PLAN",
        green("✓") + " CLAUDE.md refreshed   " + mag("●") + " brand " + bold("#4f46e5") + dim(" → theme materialized"),
    ], 0.2),
    ("wait", 0.4),
    ("out", [
        "",
        green("✓") + " specs first, code follows — read the spec, then build",
    ], 0.25),
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
    ], 0.35),
    ("wait", 0.8),
]

# ── Cast 3 — backend-api archetype ──
BACKEND = [
    ("type", "npx @arthurghz/create-ack orders-api --archetype backend-api --yes"),
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
    ("type", "npx @arthurghz/create-ack acme --archetype fullstack --yes"),
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
    ("type", "npx @arthurghz/create-ack orbit --archetype saas --yes"),
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
    ("type", "npx @arthurghz/create-ack toolkit --archetype library-sdk --yes"),
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
    ("type", "npx @arthurghz/create-ack --help"),
    ("out", [
        bold("create-ack") + dim(" — scaffold a spec-first Claude Code project (zero-LLM)"), "",
        "  " + green("npx @arthurghz/create-ack") + " <name> --archetype <type>", "",
        "  archetypes  backend-api · fullstack · saas · monorepo · library-sdk · infra-iac",
        "  flags       --yes  --lang  --framework  --here  --no-docs", "",
        dim("  or, inside Claude Code:  ") + cyan("/ack-init") + dim("   (the interactive interview)"),
    ], 0.16),
    ("wait", 0.9),
]

# ─────────────────────────────────────────────────────────────────────────────
#  TOPIC CASTS — one tailored walkthrough per docs area. Slightly longer + more
#  explanatory than the bootstrap set: a couple of related commands plus readable,
#  accurate output that teaches the concept. Every printable line kept <= 84 cols.
# ─────────────────────────────────────────────────────────────────────────────

# ── concepts/two-layer-model — META .claude/ is NEVER copied into a child ──
TWO_LAYER = [
    ("type", "ls .claude/"),
    ("out", [
        cyan("agents/") + dim("   contract · design-system · infra · qa · research · template"),
        cyan("skills/") + dim("   skill-creator · skill-validator · mcp-builder · cost-telemetry"),
        cyan("commands/") + dim(" ack-build · ack-init · ack-spec") + "   settings.json",
        dim("# this is the META tree — the machinery that BUILDS the kit"),
    ], 0.16),
    ("wait", 0.5),
    ("type", "create-ack acme --archetype fullstack --yes && grep -rl skill-creator acme/"),
    ("out", [
        green("✓") + " rendered " + bold("acme") + dim("  (render only FROM templates/ — invariant I7)"),
        yellow("(no matches)") + dim("   ← META .claude/ skills NEVER land in a child"),
    ], 0.2),
    ("wait", 0.5),
    ("type", "grep -rn 'CLAUDE_PROJECT_DIR\\|project.name' acme/.claude/settings.json"),
    ("out", [
        dim("command  python3 ") + bold("${CLAUDE_PROJECT_DIR}") + dim("/.claude/hooks/contract-gate"),
        dim("# UPPER-CASE shell var survives — the renderer matches lower-case only"),
        "",
        mag("rule") + "  child vars are " + bold("${dotted.path}") + dim(" (snake_case, from managed:)"),
        mag("rule") + "  literal " + bold("${CLAUDE_PROJECT_DIR}") + dim(" is passed through verbatim"),
    ], 0.16),
    ("wait", 0.3),
]

# ── concepts/manifest-and-interview — archetype-first → manifest → validate ──
MANIFEST = [
    ("type", "/ack-init", cprompt()),
    ("out", [
        dim("walking templates/interview/questions.yaml in order — no LLM in the loop"),
        bold("?") + " archetype " + dim("(the branch axis, asked first — invariant I3)") + "  " + green("fullstack"),
        bold("?") + " language " + green("typescript") + "   framework " + green("next") + dim("   (gated by archetype)"),
        bold("?") + " persistence " + green("postgres") + " · " + green("prisma") + dim("   sdd_gate ") + green("on"),
    ], 0.16),
    ("wait", 0.5),
    ("type", "cat project.manifest.yaml"),
    ("out", [
        dim("schema_version: 3"),
        "managed:" + dim("            # MACHINE-OWNED — regenerated wholesale every run"),
        "  archetype: " + cyan("fullstack"),
        "  project: { name: acme, language: typescript, framework: next }",
        "  contract_gate: { mode: " + cyan("block") + ", protected_paths: [app/**, api/**] }",
        "  manifest_hash: " + dim("sha256:…   # written LAST, over the managed: subtree"),
        "user: { notes: \"\", overrides: {} }" + dim("   # seeded once, never overwritten"),
    ], 0.15),
    ("wait", 0.5),
    ("type", "ack validate project.manifest.yaml"),
    ("out", [
        dim("→ JSON-Schema draft 2020-12 · additionalProperties:false everywhere"),
        green("✓") + " VALID " + dim("— validate gates the render; an invalid manifest aborts,"),
        dim("  writes nothing (fail-closed at author-time, invariant I6)"),
    ], 0.18),
    ("wait", 1.0),
]

# ── concepts/render-engine — determinism: render twice, diff identical ──
RENDER = [
    ("type", "ack render --out /tmp/r1 && ack render --out /tmp/r2"),
    ("out", [
        dim("◐ select files (_when.* guards + render.map.yaml) → substitute ${VAR} → merge"),
        green("✓") + " /tmp/r1   " + green("✓") + " /tmp/r2   " + dim("(same manifest, same templates)"),
    ], 0.2),
    ("wait", 0.45),
    ("type", "diff -r /tmp/r1 /tmp/r2 && echo IDENTICAL"),
    ("out", [
        bold("IDENTICAL") + dim("   ← byte-for-byte; the renderer emits no timestamps of its own"),
    ], 0.2),
    ("wait", 0.5),
    ("type", "tree -a /tmp/r1/.claude /tmp/r1/design-system"),
    ("out", [
        dim(".claude/  → settings.json  hooks/contract-gate  ") + green("(sdd_gate=true)"),
        dim("design-system/  → globals.css  theme.tokens.json  ") + green("(design_system.install)"),
        "",
        mag("_when.design_system.install/") + dim("  segment STRIPPED when the bool is true,"),
        dim("  the whole subtree OMITTED when it is false (short-circuit)"),
        cyan("CLAUDE.md.tpl") + dim(" → ") + cyan("CLAUDE.md") + dim("   (.tpl suffix stripped on output)"),
        yellow("unbound ${typo}") + dim("  → RenderError, fail-closed — never a blank"),
    ], 0.15),
    ("wait", 1.0),
]

# ── features/contract-gate — block → approve contract → allow ──
GATE = [
    ("type", "grep mode project.manifest.yaml"),
    ("out", [dim("  contract_gate: { mode: ") + cyan("block") + dim(", protected_paths: [src/**] }")], 0.25),
    ("wait", 0.35),
    ("type", "edit src/orders/intake.ts", cprompt()),
    ("out", [
        dim("PreToolUse(Edit) → hook reads tool_input.file_path → scopes in-script"),
        c("✗ DENY", "31") + dim("  src/orders/** is protected and no APPROVED contract covers it"),
        dim("  exit 2 + hookSpecificOutput.permissionDecision: \"deny\"  → tool blocked"),
    ], 0.18),
    ("wait", 0.5),
    ("type", "ack contract approve C-001-order-intake"),
    ("out", [
        dim("  contracts[]: C-001-order-intake  scope: [src/orders/**]  status: ") + green("approved"),
    ], 0.2),
    ("wait", 0.4),
    ("type", "edit src/orders/intake.ts", cprompt()),
    ("out", [
        green("✓ ALLOW") + dim("  an approved contract now covers src/orders/** → edit proceeds"),
        "",
        dim("modes  ") + cyan("block") + dim(" exit 2+deny  ·  ") + cyan("warn") + dim(" exit 0+stderr  ·  ") + cyan("off") + dim(" no-op"),
        dim("exempt wins over scope/protected_paths · missing manifest fails OPEN as off"),
    ], 0.16),
    ("wait", 1.0),
]

# ── features/cost-telemetry — offline aggregate.py → per-model/-feature USD ──
TELEMETRY = [
    ("type", "python3 telemetry/aggregate.py --by model,feature --since 2026-06-01"),
    ("out", [
        dim("reading ~/.claude/projects/**/*.jsonl × telemetry/pricing.json  (OFFLINE)"),
        dim("pricing as_of 2026-06-01  |  files=435  turns=12671"),
    ], 0.18),
    ("wait", 0.4),
    ("out", [
        "",
        bold("## by model") + dim("                          turns      cost USD"),
        "claude-opus-4-8                       9528     " + green("1046.6390"),
        "claude-opus-4-7                        491      " + green(" 108.5071"),
        "claude-haiku-4-5                      2652      " + green("  19.2080"),
        "",
        bold("## by feature") + dim("                        turns      cost USD"),
        "m0-m1-contract-first-scaffold         1181      " + green(" 191.2487"),
        "unattributed                         11490      " + green(" 983.1053"),
    ], 0.13),
    ("wait", 0.4),
    ("out", [
        dim("────────────────────────────────────────────────────────"),
        bold("GRAND TOTAL: ") + green("$1174.3541 USD") + dim("   reconciled across all axes: ") + green("YES"),
        dim("# every assistant turn has message.usage → 100% of spend, no live API (#11008)"),
    ], 0.16),
    ("wait", 1.1),
]

# ── features/design-system — confirmed brand hex → globals.css + tokens ──
DESIGN = [
    ("type", "/ack-init", cprompt()),
    ("out", [
        bold("?") + " brand color " + dim("(design_system.tokens.color_brand)") + "  " + mag("●") + " " + bold("#4f46e5"),
        green("✓") + " confirmed → re-render materializes the theme",
    ], 0.18),
    ("wait", 0.45),
    ("type", "grep -E 'brand|primary' design-system/theme/globals.css"),
    ("out", [
        "  --brand: " + bold("#4f46e5") + dim(";          ← the ONE materialized token"),
        "  --primary: " + cyan("var(--brand)") + dim(";   role tracks the brand accent"),
        dim("  --foreground: oklch(0.145 0 0);  neutrals stay OKLch defaults"),
    ], 0.15),
    ("wait", 0.5),
    ("type", "cat design-system/theme/theme.tokens.json"),
    ("out", [
        dim("# snake_case brand token → shadcn CSS var crosswalk (mapping doc)"),
        "  color_brand  → " + cyan("--primary") + "       " + bold("#4f46e5"),
        "  color_danger → " + cyan("--destructive"),
        "  radius_base  → " + cyan("--radius") + dim("        (sm/md/lg/xl derive via calc())"),
        "",
        dim("Tailwind v4 @theme inline exposes them: bg-background, text-foreground"),
        dim("fullstack-only · gated by design_system.install · shadcn/ui is MIT"),
    ], 0.15),
    ("wait", 1.0),
]

# ── features/discovery — the PLANNED propose-never-adopt engine (roadmap) ──
DISCOVERY = [
    ("type", "cat discovery/sources.yaml   " + dim("# PLANNED — P7 roadmap, not built")),
    ("out", [
        yellow("status: ROADMAP (P7)") + dim("  — shape shown so the design is not lost"),
        dim("sources:"),
        "  - awesome-claude-code      " + dim("hesreallyhim/awesome-claude-code"),
        "  - claude-plugins-official  " + dim("anthropics/claude-plugins-official"),
        "  - cc-sdd                   " + dim("gotalab/cc-sdd"),
    ], 0.16),
    ("wait", 0.5),
    ("type", "/discover   " + dim("# planned command")),
    ("out", [
        dim("scan seed sources → open PRs into discovery/proposals/   (never merges)"),
        green("●") + " proposal  shadcn-theme-factory.yaml  " + dim("license: Apache-2.0  status: ") + yellow("proposed"),
        dim("a human reviews license + fit, then MANUALLY moves it to adopted/"),
    ], 0.18),
    ("wait", 0.5),
    ("out", [
        "",
        bold("propose, never auto-adopt") + dim("   ← the one invariant the design hangs on"),
        dim("only vendorable (Apache-2.0 / MIT) is copied WITH a NOTICE; proprietary stays"),
        dim("reference-only. discovery.enabled defaults false; never copied into a child."),
    ], 0.16),
    ("wait", 1.0),
]

# ── features/mcp — .mcp.json wiring gated by features.mcp ──
MCP = [
    ("type", "create-ack acme --archetype fullstack --yes   " + dim("# features.mcp=true")),
    ("out", [green("✓") + " rendered " + bold("acme") + dim("  (.mcp.json rendered only when features.mcp)")], 0.25),
    ("wait", 0.4),
    ("type", "cat acme/.mcp.json"),
    ("out", [
        "{ " + cyan("\"mcpServers\"") + ": {",
        "    " + cyan("\"ack-example\"") + ": { command: python3, args: [" + bold("${CLAUDE_PROJECT_DIR}") + "/…] },",
        "    " + cyan("\"shadcn\"") + ":      { command: npx, args: [\"shadcn@latest\", \"mcp\"] }",
        "} }" + dim("   ← shadcn double-gated: #ack:if design_system.install … #ack:endif"),
    ], 0.16),
    ("wait", 0.5),
    ("type", "claude   " + dim("# first use of a project-scoped server")),
    ("out", [
        yellow("⚠ approve MCP server \"shadcn\"?") + dim("  (project servers are NOT auto-trusted)"),
        dim("a checked-in .mcp.json cannot silently run a command on a teammate's box"),
        green("✓") + " approved → agent can browse/search/install shadcn/ui components",
    ], 0.18),
    ("wait", 1.0),
]

# ── features/skills-catalog — the harvested skills/agents/commands catalog ──
CATALOG = [
    ("type", "ack catalog   " + dim("# summary of templates/skills/INDEX.md")),
    ("out", [
        bold("META — build the kit") + dim("  (.claude/, never rendered into a fork)"),
        "  skill-creator · skill-validator · mcp-builder " + dim("· cost-telemetry   [Apache-2.0/MIT]"),
        "",
        bold("CHILD — rendered by /ack-init") + dim("  (templates/, manifest-gated)"),
        "  skills   coding-standards" + dim("(always)") + " · production-audit · cost-telemetry",
        "  agents   architect" + dim("(opus)") + " · code-explorer · code-reviewer · security-reviewer",
        "  commands /rpi/research → /rpi/plan → /rpi/implement · /prd · /rice",
    ], 0.14),
    ("wait", 0.5),
    ("type", "ack catalog --lang typescript --framework next"),
    ("out", [
        dim("manifest-gated language / framework packs selected for this fork:"),
        green("✓") + " typescript-patterns  " + dim("project.language == typescript"),
        green("✓") + " react-patterns       " + dim("framework in [next, remix]"),
        green("✓") + " prisma-patterns      " + dim("persistence.orm == prisma"),
        dim("MIT items re-authored in kit style; doc skills (docx/pdf/…) NEVER vendored"),
    ], 0.15),
    ("wait", 1.0),
]

# ── build/ack-build — the /ack-build META orchestrator ──
ACK_BUILD = [
    ("type", "/ack-build --dry-run", cprompt()),
    ("out", [
        dim("STEP 0 META-repo guard ✓   STEP 1 validate bootstrap.schema.json ✓"),
        dim("resolved run plan (phases P1..P8, skip done, model + advisory budget):"),
        green("✓ P1") + dim(" ground-truth   ") + green("✓ P3") + dim(" frozen contract   (done, regression-checked)"),
        bold("→ P4") + dim(" archetype sets  ·  team: research → template → qa  ·  ") + cyan("gate ✋"),
    ], 0.16),
    ("wait", 0.5),
    ("type", "/ack-build --from P4", cprompt()),
    ("out", [
        dim("P4: ground-truth (clone refs, exact quotes) → author → adversarial QA"),
        green("✓") + " P4-A1 render is deterministic   " + green("✓") + " P4-A2 _when.* guards strip",
        dim("cost so far: ") + yellow("unavailable (P6 pending — offline aggregator)"),
        cyan("✋ gate") + dim("  approve · stop · re-run   (STOPS at every gate: true phase)"),
    ], 0.16),
    ("wait", 1.0),
]

# ── build/bootstrap-config — ack.bootstrap.yaml validated vs its schema ──
BOOTSTRAP_CFG = [
    ("type", "sed -n '1,8p' bootstrap/ack.bootstrap.yaml"),
    ("out", [
        "meta: { kit_name: " + cyan("ai-core-kit") + ", version_source: git-describe }",
        "models: { default: " + cyan("sonnet") + ", infra: " + cyan("haiku") + ", qa: " + cyan("sonnet") + " }",
        "budgets: { per_phase_tokens: 180000 }" + dim("   # advisory, never a hard cap"),
        "phases: [ P1 … P8 ]" + dim("   # depends_on DAG; only P1, P3 are done: true"),
    ], 0.15),
    ("wait", 0.5),
    ("type", "ack validate bootstrap/ack.bootstrap.yaml"),
    ("out", [
        dim("→ bootstrap/schema/bootstrap.schema.json  (draft 2020-12)"),
        dim("  additionalProperties:false everywhere · depends_on must be a cycle-free DAG"),
        dim("  source-available/proprietary reference repos must be vendorable:false"),
        green("✓") + " VALID " + dim("— /ack-build refuses to run on an invalid config (fail-closed)"),
        dim("# re-planning the build = editing this ONE validated YAML, not a prompt"),
    ], 0.16),
    ("wait", 1.0),
]

# ── reference/commands — the two META commands + the RPI trio ──
COMMANDS = [
    ("type", "ls .claude/commands/ templates/commands/"),
    ("out", [
        cyan(".claude/commands/") + dim("   ack-build  ack-init  ack-spec   (META — build/setup)"),
        cyan("templates/commands/") + dim(" rpi/research  rpi/plan  rpi/implement  prd  rice"),
        dim("# /ack-init is NOT /init — the built-in init skill owns /init"),
    ], 0.16),
    ("wait", 0.5),
    ("type", "/rpi/research checkout-v2", cprompt()),
    ("out", [
        dim("RPI step 1 — viability before any planning → GO / NO-GO gate"),
        green("✓") + " GO " + dim("→ ") + cyan("/rpi/plan") + dim(" (product · UX · eng · phased roadmap)"),
        dim("→ ") + cyan("/rpi/implement") + dim(" (per-phase discovery · review · validation gate)"),
        dim("rendered into a fork only when features.rpi == true   [MIT, re-authored]"),
    ], 0.16),
    ("wait", 1.0),
]

CASTS = {
    "ack-usage.cast": ("create-ack — bootstrap a spec-first repo", BOOTSTRAP),
    "ack-spec.cast": ("/ack-spec — author the specs", ACK_SPEC),
    "ack-backend-api.cast": ("create-ack --archetype backend-api", BACKEND),
    "ack-fullstack.cast": ("create-ack --archetype fullstack", FULLSTACK),
    "ack-saas.cast": ("create-ack --archetype saas", SAAS),
    "ack-minimal.cast": ("create-ack — minimal-core archetypes", MINIMAL),
    "ack-install.cast": ("install & run create-ack", INSTALL),
    # ── topic casts ──
    "ack-two-layer.cast": ("META vs CHILD — .claude/ is never copied", TWO_LAYER),
    "ack-manifest.cast": ("interview → manifest → validate", MANIFEST),
    "ack-render.cast": ("render engine — deterministic, render twice", RENDER),
    "ack-gate.cast": ("contract gate — block, then allow on approval", GATE),
    "ack-telemetry.cast": ("offline cost telemetry — per-model / feature", TELEMETRY),
    "ack-design.cast": ("design system — brand hex → tokens + globals.css", DESIGN),
    "ack-discovery.cast": ("discovery (planned) — propose, never adopt", DISCOVERY),
    "ack-mcp.cast": (".mcp.json wiring — gated by features.mcp", MCP),
    "ack-catalog.cast": ("skills / agents / commands catalog", CATALOG),
    "ack-build.cast": ("/ack-build — META orchestrator, phase by phase", ACK_BUILD),
    "ack-bootstrap-config.cast": ("ack.bootstrap.yaml validated vs schema", BOOTSTRAP_CFG),
    "ack-commands.cast": ("commands — META trio + the RPI loop", COMMANDS),
}

if __name__ == "__main__":
    print("generating casts (92 cols):")
    for name, (title, script) in CASTS.items():
        write_cast(name, title, script)
    print("done.")
