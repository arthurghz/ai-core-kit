---
description: RPI Step 2 — turn an approved research report into product, UX, engineering, and phased-roadmap planning docs.
argument-hint: "<feature-slug>"
---

<!-- Re-authored for ai-core-kit from claude-code-best-practice rpi/.claude/commands/rpi/plan.md (MIT, Copyright 2025-2026 Shayan Rais). -->

## User input

```text
$ARGUMENTS
```

Parse `$ARGUMENTS` to extract the **feature slug** — the folder under
`${CLAUDE_PROJECT_DIR}/rpi/`.

## Purpose

**Step 2 of the RPI workflow** (Research → Plan → Implement). It converts an approved
research report into comprehensive planning artifacts: product requirements, UX design,
technical specification, and a phased implementation roadmap. This command orchestrates
specialist agents; it does not carry the design procedure inline.

**Prerequisites:** `${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/research/RESEARCH.md` exists
with a GO (or acknowledged conditional) recommendation.
**Output:** all files saved to `${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/plan/`.

## Phases

### Phase 0 — Load context
Confirm `rpi/<feature-slug>/research/RESEARCH.md` exists and read it (product analysis,
technical discovery, feasibility, risks, constraints). Read
`${CLAUDE_PROJECT_DIR}/project.manifest.yaml` and `CLAUDE.md` for archetype, stack, and
constraints, plus any constitution/principles doc. Warn — but allow proceeding — if the
research verdict was NO-GO or CONDITIONAL.

### Phase 1 — Understand requirements
From the research report, restate the feature name and primary goal, identify the
primary and secondary (integration) components and shared utilities, and catalog
existing patterns to reuse. Delegate codebase scouting to the **code-explorer** agent
when the affected area is unfamiliar.

### Phase 2 — Analyze technical requirements
Map internal/external dependencies, storage and auth needs, integration points (APIs to
add/modify, schema changes, event flows), and technical risks (breaking changes,
performance, security, data migration).

### Phase 3 — Design the architecture → **architect** + **senior-software-engineer**
Use the `architect` agent for the high-level structure, component responsibilities, data
flow, API contracts, and load-bearing decisions (as ADRs). Use the
`senior-software-engineer` agent to translate that into an implementation approach: file
layout, code-organization patterns, error-handling strategy, schema/migration plan, and
a testing strategy (unit / integration / e2e).

### Phase 4 — Break down the work
Decompose the feature into **3–5 logical phases**, each delivering working, testable
functionality and building on the prior one. For each phase list specific tasks with a
Low/Medium/High estimate, mark dependencies and parallelizable work, and define explicit
success/acceptance criteria.

### Phase 5 — Generate the docs → **product-manager**, **ux-designer**, **senior-software-engineer**, **documentation-analyst-writer**
Produce four files in `${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/plan/`:

- **`pm.md`** (product-manager) — description, user stories, business value, success
  metrics, acceptance criteria, out-of-scope, constitutional alignment.
- **`ux.md`** (ux-designer) — UI description, user flows, accessibility, error/edge states.
- **`eng.md`** (senior-software-engineer) — architecture, API specs, schema changes,
  technology choices, technical risks + mitigations.
- **`PLAN.md`** (documentation-analyst-writer synthesizes) — phased roadmap: tasks +
  estimates per phase, ordering/dependencies, per-phase success criteria, testing
  requirements, and validation checkpoints.

Validation: all four files present, no placeholder text, clean Markdown, each file
covers its mandate.

## Agent spine

| Phase | Agent | Source |
|-------|-------|--------|
| 1 | code-explorer | `${CLAUDE_PROJECT_DIR}/.claude/agents/code-explorer.md` |
| 3 | architect | `${CLAUDE_PROJECT_DIR}/.claude/agents/architect.md` |
| 3 / 5 | senior-software-engineer | `${CLAUDE_PROJECT_DIR}/.claude/agents/senior-software-engineer.md` |
| 5 | product-manager | `${CLAUDE_PROJECT_DIR}/.claude/agents/product-manager.md` |
| 5 | ux-designer | `${CLAUDE_PROJECT_DIR}/.claude/agents/ux-designer.md` |
| 5 | documentation-analyst-writer | `${CLAUDE_PROJECT_DIR}/.claude/agents/documentation-analyst-writer.md` |

## Completion report

```markdown
### Outputs — ${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/plan/
- pm.md   — <Y> user stories
- ux.md   — <Z> flows
- eng.md  — <A> APIs, <B> schema changes
- PLAN.md — <C> phases, <D> tasks

### Feature summary
Name / Component / Complexity / Phases / Tasks / Dependencies (internal, external)

### Implementation phases
1. <phase> — <task count>   2. … (continue for all phases)
```

**Next:** review the docs, validate with stakeholders, then run
`/rpi:implement "<feature-slug>"`.

## Error handling

- **Research report missing** → STOP: "Run `/rpi:research \"<feature-slug>\"` first."
- **Research verdict was NO-GO** → warn and ask whether to proceed anyway.
- **Target component does not exist** → confirm with the user whether it is a new component.
- **A documentation agent fails** → generate the doc directly and note that it may not
  fully meet the standard.

## Notes

- Thin orchestrator: keep design procedure in the agents (Command → Agent → Skill spine).
- A detailed, specific plan makes implementation smoother — be concrete, validate early.
- After completing, prompt the user to run `/compact` to preserve the planning decisions
  while freeing context for `/rpi:implement`.
