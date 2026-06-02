---
description: RPI Step 3 — execute a feature's phased plan with per-phase code discovery, review, and a user validation gate.
argument-hint: "<feature-slug> [--phase N] [--validate-only] [--skip-validation]"
---

<!-- Re-authored for ai-core-kit from claude-code-best-practice rpi/.claude/commands/rpi/implement.md (MIT, Copyright 2025-2026 Shayan Rais). -->

## User input

```text
$ARGUMENTS
```

Parse `$ARGUMENTS` to extract the **feature slug** — the folder under
`${CLAUDE_PROJECT_DIR}/rpi/`.

## Purpose

**Step 3 of the RPI workflow** (Research → Plan → Implement). It executes the phased
plan, orchestrating specialist agents and enforcing a validation gate at every phase so
issues surface early and the change stays aligned with the project's constitution. This
command orchestrates; the work lives in the agents.

**Prerequisite:** `${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/plan/PLAN.md` exists.
**Output:** `${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/implement/IMPLEMENT.md` (plus the
code changes themselves), and phase-status updates written back into `PLAN.md`.

## Flags

- `--phase N` — run only phase N (default: start from phase 1).
- `--validate-only` — validate the current phase without implementing.
- `--skip-validation` — bypass the user gate (use with caution; record that it was used).

## Phase 0 — Load context and rules

1. Read `${CLAUDE_PROJECT_DIR}/project.manifest.yaml` and `CLAUDE.md` for the archetype,
   stack, constraints, and the project's configured **lint / test / build** commands.
   Load any constitution/principles doc.
2. Load domain rules for the files in scope (component READMEs, style guides, testing
   requirements).
3. Read `rpi/<feature-slug>/plan/PLAN.md`; list every file to be modified and the phase
   execution order.

Validation: constraints + commands loaded; files mapped; execution plan understood.

## Per-phase loop

For each phase in `PLAN.md`, run these six steps in order:

### 1 — Code discovery → **code-explorer** agent
Delegate to the `code-explorer` agent to understand the files this phase touches:
current implementation, integration points, dependencies, patterns to follow, and the
risks of changing them. Implementation is grounded in this discovery, not assumptions.

### 2 — Implementation → **senior-software-engineer** agent
Give the `senior-software-engineer` agent the constitutional constraints (Phase 0), the
domain rules, the discovery summary, and the phase deliverables from `PLAN.md`. It
implements every deliverable: following existing patterns, honoring type-safety and
testing constraints, writing tests for new behavior, adding observability, and handling
errors. It must avoid breaking existing functionality.

### 3 — Self-validation → **senior-software-engineer** agent
The implementing agent validates its own work against the phase checklist and runs the
project's configured commands (read from the manifest; do not assume a stack):

```bash
<project lint command>
<project test command>
<project build command>
```

All deliverables done; lint clean; tests pass; build succeeds; no regressions;
constraints and domain rules honored.

### 4 — Code review → **code-reviewer** agent
Invoke the `code-reviewer` agent on the phase changes (correctness, security,
maintainability, architectural boundaries). For changes touching auth, input handling,
or sensitive data, also invoke **security-reviewer**. Verdicts: APPROVED → proceed;
APPROVED WITH SUGGESTIONS → note and proceed; NEEDS REVISION → fix and re-review.
Optionally invoke **constitutional-validator** to confirm continued alignment.

### 5 — User validation gate  *(STOP — requires the user)*
Unless `--skip-validation` is set, present the phase result and **wait for the user**:

```markdown
## Phase N validation request
Deliverables: - [x] … (with implementation summary)
Files changed: | file | add/modify | ±lines |
Tests: unit / integration / build — PASS
Code review: <verdict> — <issues or none>
Validation criteria (from PLAN.md): - [ ] …

Decide: PASS (proceed) | CONDITIONAL PASS (note issues, proceed) | FAIL (fix, re-run 2–5)
```

### 6 — Documentation update
Update the phase status in `PLAN.md` and append the phase result to
`${CLAUDE_PROJECT_DIR}/rpi/<feature-slug>/implement/IMPLEMENT.md`.

Phase status markers in `PLAN.md`:
`[ ]` not started · `[~]` in progress · `[x]` validated (PASS) · `[!]` conditional pass ·
`[-]` failed (needs rework).

## Agent spine

| Step | Agent | Source |
|------|-------|--------|
| 1 | code-explorer | `${CLAUDE_PROJECT_DIR}/.claude/agents/code-explorer.md` |
| 2 / 3 | senior-software-engineer | `${CLAUDE_PROJECT_DIR}/.claude/agents/senior-software-engineer.md` |
| 4 | code-reviewer | `${CLAUDE_PROJECT_DIR}/.claude/agents/code-reviewer.md` |
| 4 | security-reviewer | `${CLAUDE_PROJECT_DIR}/.claude/agents/security-reviewer.md` |
| 4 | constitutional-validator | `${CLAUDE_PROJECT_DIR}/.claude/agents/constitutional-validator.md` |

## Error handling

- **Implementation fails** → document the failure, try at most 2 alternatives, then STOP
  for guidance. Never advance with a broken implementation.
- **Tests fail** → diagnose (code bug vs. test bug), fix, re-run; if persistent,
  document and ask. Never mark a phase complete with failing tests.
- **Build fails** → check types, imports, syntax; fix and rebuild; escalate if persistent.
- **An agent fails/times out** → retry once; if it still fails, proceed without it and
  record the gap in the validation request.

## Completion report

```markdown
## Implementation complete
Feature: <name>  •  Phases: <N> of <N>
Phases: | phase | status | notes |
Files modified: | file | type | ±lines |
Tests added: <files>
Code review: blockers fixed <N>, suggestions addressed <N>
Artifacts: PLAN.md (status updated), implement/IMPLEMENT.md (all phase validations)
Next: open a PR, request human review, deploy to staging, verify, then production.
```

## Notes

- **Use when:** a feature has a `PLAN.md` and warrants gated, phased implementation.
- **Skip when:** simple bug fixes, sub-30-minute changes, prototyping, or docs-only edits
  — those are too heavy for this command.
- Thin orchestrator: keep the heavy procedure in the agents (Command → Agent → Skill).
- After completing (or after each major phase in a multi-session build), prompt the user
  to run `/compact` to preserve progress and free context.
