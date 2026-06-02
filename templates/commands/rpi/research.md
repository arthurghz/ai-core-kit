---
description: RPI Step 1 — research a feature's viability and produce a GO / NO-GO recommendation before any planning.
argument-hint: "<feature-slug>"
---

<!-- Re-authored for ai-core-kit from claude-code-best-practice rpi/.claude/commands/rpi/research.md (MIT, Copyright 2025-2026 Shayan Rais). -->

## User input

```text
$ARGUMENTS
```

Parse `$ARGUMENTS` to extract the **feature slug** — the folder name under
`${CLAUDE_PROJECT_DIR}/rpi/`. Expected request file:
`${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/REQUEST.md`.

## Purpose

This is **Step 1 of the RPI workflow** (Research → Plan → Implement). It is a GO/NO-GO
gate: it researches a feature request *before* any planning effort is spent, so
non-viable ideas are stopped early. This command is a thin orchestrator — the analysis
lives in the specialist agents it delegates to.

**Prerequisite:** `${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/REQUEST.md` exists.
**Output:** `${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/research/RESEARCH.md`.

## Phases

### Phase 0 — Load context
1. Read `rpi/<feature-slug>/REQUEST.md` (required).
2. Read `${CLAUDE_PROJECT_DIR}/project.manifest.yaml` and `CLAUDE.md` for the chosen
   archetype, stack, and constraints. If a constitution/principles doc exists
   (`constitution.md`, `PRINCIPLES.md`, `docs/PRINCIPLES.md`), load it too.
3. Synthesize a short research context and the alignment criteria to judge against.

Validation: feature folder and `REQUEST.md` exist; context and alignment criteria captured.

### Phase 1 — Parse the request → **requirement-parser** agent
Delegate the raw description to the `requirement-parser` agent. It returns the feature
identity, functional/non-functional requirements, constraints, complexity, and any
clarifying questions. **If clarifying questions come back, STOP and ask the user**
before continuing.

### Phase 2 — Product analysis → **product-manager** agent
Pass the parsed requirements and the archetype/constitution context to the
`product-manager` agent for user value, market fit, strategic and constitutional
alignment, a viability score (High/Medium/Low), and any red flags.

### Phase 2.5 — Technical discovery → **code-explorer** agent  *(critical)*
Delegate to the `code-explorer` agent to ground the feasibility call in real code:
existing implementation, integration points, conflicts, reusable components, and the
true constraints the current code imposes. This phase ensures Phase 3 is based on code
reality, not assumptions.

### Phase 3 — Technical feasibility → **senior-software-engineer** agent
Give the parsed requirements, the product context, and the Phase 2.5 discovery to the
`senior-software-engineer` agent for a feasibility score, a recommended approach (with
alternatives), a complexity estimate, and the technical risks with mitigations.

### Phase 4 — Strategic assessment → **technical-cto-advisor** agent
Hand all prior outputs to the `technical-cto-advisor` agent to synthesize a
**GO / NO-GO / CONDITIONAL GO / DEFER** recommendation with rationale, the best path
forward, any preconditions, and the key risks.

### Phase 5 — Write the report → **documentation-analyst-writer** agent
Have the `documentation-analyst-writer` agent assemble the findings into
`${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/research/RESEARCH.md` with: executive summary
+ recommendation, feature overview, requirements summary, product analysis, technical
discovery, technical analysis, strategic recommendation, and next steps.

## Agent spine

| Phase | Agent | Source |
|-------|-------|--------|
| 1 | requirement-parser | `${CLAUDE_PROJECT_DIR}/.claude/agents/requirement-parser.md` |
| 2 | product-manager | `${CLAUDE_PROJECT_DIR}/.claude/agents/product-manager.md` |
| 2.5 | code-explorer | `${CLAUDE_PROJECT_DIR}/.claude/agents/code-explorer.md` |
| 3 | senior-software-engineer | `${CLAUDE_PROJECT_DIR}/.claude/agents/senior-software-engineer.md` |
| 4 | technical-cto-advisor | `${CLAUDE_PROJECT_DIR}/.claude/agents/technical-cto-advisor.md` |
| 5 | documentation-analyst-writer | `${CLAUDE_PROJECT_DIR}/.claude/agents/documentation-analyst-writer.md` |

## Completion report

```markdown
### Recommendation
Decision: <GO | NO-GO | CONDITIONAL GO | DEFER>  •  Confidence: <High | Medium | Low>
Rationale: <1–2 sentences>

### Summary
Feature / Type / Component / Complexity
Scores — Product: <…>  Technical: <…>  Overall: <…>
Key risks: 1) …  2) …  3) …

### Report
${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/research/RESEARCH.md
```

**Next steps by decision:**
- **GO** → review the report, then run `/rpi:plan "<feature-slug>"`.
- **CONDITIONAL GO** → address the listed conditions, then re-run or proceed.
- **DEFER** → revisit per the timeline in the report.
- **NO-GO** → review rationale and alternatives; archive.

## Error handling

- **`REQUEST.md` missing** → STOP: "Create `rpi/<feature-slug>/REQUEST.md` first
  (Step 0: describe the feature)."
- **Request too vague** → requirement-parser raises clarifying questions; ask the user,
  wait for answers, then continue.
- **An agent fails/times out** → retry once; if it still fails, ask the user whether to
  continue with incomplete research and record the gap in the report.

## Notes

- Use after the feature folder and `REQUEST.md` exist; this gate prevents wasted effort.
- This command orchestrates only — keep heavy procedure in the agents (Command → Agent
  → Skill spine).
- After completing, prompt the user to run `/compact`: this workflow consumes
  significant context, and compacting preserves the findings while freeing space for
  `/rpi:plan`.
