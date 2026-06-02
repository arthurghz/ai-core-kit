---
description: Generate a concise product requirements document for a feature, initiative, or problem statement. Usage: /prd <feature-or-problem>
argument-hint: <feature-or-problem>
---

# /prd

Write a focused PRD for: **$ARGUMENTS**

Produce a document that an engineer could pick up and build from, and a
stakeholder could approve in one read. Keep it tight — a PRD is a decision
record, not an essay. If a section has nothing real to say, write "N/A" rather
than padding it.

## Steps

1. **Restate the problem** in one or two sentences, in the user's words plus the
   underlying need. If the input is only a feature name, infer the problem it
   solves and state that assumption explicitly.
2. **Clarify only if blocked.** Ask at most 2 questions, and only when the answer
   materially changes scope. Otherwise proceed with stated assumptions.
3. **Fill the structure below.** Be specific: name real metrics, real users, and
   concrete acceptance criteria — no placeholders like "improve engagement".

## Output structure

```markdown
# PRD: <title>

## Problem
<the problem and who has it; why it matters now>

## Goals
- <measurable outcome 1>
- <measurable outcome 2>

## Non-goals
- <explicitly out of scope, to prevent scope creep>

## Users & use cases
<primary persona(s) and the jobs-to-be-done this serves>

## User stories & acceptance criteria
- As a <user>, I want <capability> so that <benefit>.
  - [ ] <testable acceptance criterion>
  - [ ] <testable acceptance criterion>

## Success metrics
| Metric | Baseline | Target | How measured |
|---|---|---|---|
| <metric> | <now> | <goal> | <instrumentation> |

## Scope & assumptions
<what's in v1, what's deferred, key assumptions and dependencies>

## Risks & open questions
- <risk or unknown, with a mitigation or owner>
```

## Notes

- Acceptance criteria must be **testable** — each one should map to something a
  reviewer can verify.
- Tie every goal to a success metric; a goal with no metric is a wish.
- For prioritizing the resulting features against others, use `/rice`.
- Related skill: `saas-scaffolder` (when the PRD describes a new SaaS) and
  `spec-to-repo` (to turn an approved PRD into a starter repo).
