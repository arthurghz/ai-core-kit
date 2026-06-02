# Harvested patterns

> The reusable **structural patterns** the P3 port extracted from the reference
> repos, distilled into the kit's canonical form. These are the *why* behind how
> `ai-core-kit` arranges commands, agents, and skills — and the QA loop that keeps
> ported primitives honest. License/provenance for the source repos:
> [`REFERENCES.md`](./REFERENCES.md) · [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
>
> **Two layers, one vocabulary.** Patterns apply in both the META repo
> (`.claude/skills/` — build the kit) and the CHILD payload (`templates/…` — what a
> fork receives). Where a pattern differs by layer, it is called out.

---

## 1. Command → Agent → Skill (the three-tier spine)

*Source: shanraisshan/claude-code-best-practice (MIT). Reinforced by affaan-m/ecc.*

The kit separates **three** kinds of primitive by responsibility, and they stack in
one direction only — a command may invoke agents; an agent may invoke skills; never
the reverse.

| Tier | Primitive | Lives in | Owns | Frontmatter |
|---|---|---|---|---|
| 1. **Command** | slash command | `templates/commands/` | *Orchestration* — a user-invoked entry point that sequences a workflow and stops at gates. | `description`, optional `argument-hint`. **No** `name`/`tools`/`model`. |
| 2. **Agent** | sub-agent | `templates/agents/` | *Delegation* — a focused role with its own context window, tool allow-list, and model tier. | `name`, `description` ("use proactively when…"), `model`, `tools`. |
| 3. **Skill** | SKILL.md (+ refs/scripts) | `templates/skills/`, `.claude/skills/` | *Knowledge + procedure* — domain expertise and deterministic scripts a model loads on demand. | `name`, `description` (third-person: what + when + triggers + when-NOT); optional `license`, `allowed-tools`. **Reject** `version`/`author`/`category`/`triggers`/`updated`. |

**Why three tiers.** Each tier has a different reuse boundary and a different cost:

- A **command** is cheap to write and user-facing; it encodes *the sequence and the
  gates*, not the expertise.
- An **agent** isolates a role in a fresh context so a long orchestration doesn't
  pollute the main thread, and so each role gets the *right* model (opus for
  design/judgement, sonnet for mechanical work) and a *minimal* tool set.
- A **skill** is the unit of *reusable knowledge*. The same skill is loaded by many
  agents and many commands; it must trigger reliably (hence the description
  discipline) and stay under ~500 lines, pushing detail into `references/*.md`.

**Worked example in the kit:** `/rpi/implement` (command) drives the implement phase,
which spawns `code-explorer` then `code-reviewer` (agents), each loading
`coding-standards`, `error-handling`, and the relevant `lang/*` pack (skills).

**Anti-patterns the tiering prevents:**
- A monolithic command that inlines all the expertise → unmaintainable, can't be
  reused outside that one flow. *Fix: push expertise down into a skill.*
- An agent with `tools: *` and no model pin → expensive and unfocused.
  *Fix: minimal allow-list + explicit model.*
- A skill that lists `triggers:` in frontmatter → the harness ignores it; triggers
  belong **in the description prose**. *The linter rejects the key.*

---

## 2. RPI — Research → Plan → Implement (the feature-delivery loop)

*Source: shanraisshan/claude-code-best-practice `rpi/` (MIT). Validator gate adapted
with affaan-m/ecc reviewers.*

The kit's default loop for non-trivial work is three sequential phases, each its own
command, each producing a durable artifact and **stopping at a human gate** before
the next phase spends tokens.

```
/rpi/research <slug>   →  GO / NO-GO report           ── gate ──►
/rpi/plan <slug>       →  product + UX + eng + roadmap ── gate ──►
/rpi/implement <slug>  →  phased exec + review + validate
```

| Phase | Command | Lead agents | Output | Gate |
|---|---|---|---|---|
| **Research** | `/rpi/research` | `requirement-parser`, `code-explorer`, `constitutional-validator` | Viability report with a **GO / NO-GO** call | User approves GO before any planning. |
| **Plan** | `/rpi/plan` | `architect`, `constitutional-validator` | Product/UX/engineering docs + a **phased** roadmap | User approves the plan before implementation. |
| **Implement** | `/rpi/implement` | `code-explorer` (per phase), `code-reviewer`, `silent-failure-hunter`, `security-reviewer`, `refactor-cleaner` | Working code, phase by phase | Per-phase **validation gate** — user signs off each phase. |

**Why RPI.** It front-loads cheap mistakes. Disagreements about *what* and *whether*
are resolved in research (cheap text), architecture is settled in plan (still text),
and only then does the expensive implement phase run — against an approved plan, in
small validated increments. The `constitutional-validator` agent enforces that each
phase stays aligned with the project's archetype/constitution, so scope creep is
caught at a gate rather than in a review of finished code.

**Maps onto the three-tier spine:** RPI commands are tier 1; the parser/explorer/
architect/reviewer/validator are tier 2; the standards/error-handling/lang packs they
consult are tier 3.

**Relationship to Anthropic's guidance.** This is the kit's concrete instantiation of
"break work into phases with checkpoints" from *Building effective agents* and the
multi-agent research system — see [`REFERENCES.md`](./REFERENCES.md).

---

## 3. Skill-QA — validator / scorer / auditor

*Source: alirezarezvani/claude-skills (MIT) — validator/scorer/auditor patterns;
benchmark loop from anthropics/skills `skill-creator` (Apache-2.0).*

Skills are knowledge artifacts that **silently degrade** — a description that
over-triggers, a body that drifts past 500 lines, frontmatter that adds a forbidden
key. The kit guards against this with three complementary QA roles, each a distinct
primitive:

| Role | What it judges | In the kit |
|---|---|---|
| **Validator** | *Conformance* — does the primitive obey the canonical frontmatter + structure rules? Deterministic, binary. | `scripts/lint-frontmatter.py`, surfaced via the META `skill-validator` skill. Run before every commit / port. |
| **Scorer** | *Effectiveness* — does the skill actually improve outcomes vs no skill? Empirical, graded. | META `skill-creator` benchmark loop: with-skill vs baseline evals, graded, with `improve_description.py` to tune triggering. |
| **Auditor** | *Latent defects in the target domain* — applies the skill's expertise to find problems the author missed. | The CHILD auditor agents/skills: `silent-failure-hunter`, `security-reviewer`, `production-audit`, `cost-audit`. |

**The pipeline.** Authoring a kit skill runs all three, in order:

```
author SKILL.md
   │
   ├─►  validator  (skill-validator → lint-frontmatter.py)   ── must be green ──►
   │
   ├─►  scorer     (skill-creator: eval with_skill vs without, grade,
   │                improve_description until triggering is reliable)
   │
   └─►  auditor    (domain auditor agents review what the skill produces
                    in a real fork — e.g. silent-failure-hunter on its outputs)
```

**Why separate the three.** A skill can be *valid* (lints clean) yet *ineffective*
(never triggers, or doesn't change behavior); it can be *effective* yet still let a
real defect through. Conflating them hides failures. The validator is the gate the
port pipeline enforces mechanically; the scorer prevents shipping skills that look
right but don't help; the auditors are the runtime payoff — the same QA mindset,
pointed at the *child's* code instead of the skill itself.

**Canonical rules the validator enforces** (full list:
[`CONVENTIONS.md`](./CONVENTIONS.md) and the `skill-validator` skill):
- Skill frontmatter: `name` (lowercase-hyphenated) + third-person `description`;
  optional `license`, `allowed-tools`. Reject `version`/`author`/`category`/
  `triggers`/`updated`. Body ≤ 500 lines; detail → `references/*.md` (one level).
- Agent frontmatter: `name`, `description`, `model`, `tools`.
- Command frontmatter: `description`, optional `argument-hint` — no `name`/`tools`.

---

## How the three patterns compose

```
        USER
         │  /rpi/research · /rpi/plan · /rpi/implement   ◄── Pattern 2 (RPI loop)
         ▼
   ┌─────────────┐
   │  COMMAND    │  tier 1 — orchestration + gates
   └─────┬───────┘
         │ spawns
         ▼
   ┌─────────────┐
   │   AGENT     │  tier 2 — role, model, minimal tools                ◄── Pattern 1
   └─────┬───────┘                                                          (3-tier spine)
         │ loads
         ▼
   ┌─────────────┐
   │   SKILL     │  tier 3 — knowledge + scripts
   └─────┬───────┘
         │ guarded by
         ▼
   validator → scorer → auditor                                        ◄── Pattern 3
                                                                            (skill-QA)
```

One spine (what calls what), one loop (how a feature flows through it), one QA triad
(how the knowledge units stay trustworthy). Every primitive in
[`templates/skills/INDEX.md`](../templates/skills/INDEX.md) slots into exactly one
tier of the spine and is gated by the validator before it ships.
