# Product Requirements — ${project.name}

> ${project.description}
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview (templates/interview/spec-questions.yaml). Every section below
>      carries an inline prompt telling the author what to write. Replace the
>      prompts with real prose; keep the headings (other specs and the contract
>      gate link to them). This is the "why" and "what" of the product — the
>      ARCHITECTURE.md is the "how", REQUIREMENTS.md is the "must", DOMAIN.md is
>      the "language". Do not paste the manifest here; the manifest is the
>      machine source of truth, this is the human source of intent. -->

## Problem

<!-- The pain this removes or the job it does, stated BEFORE any solution.
     Who feels the pain, how acute it is, and what they do today instead (the
     status-quo workaround this replaces). Source: discovery `problem_statement`.
     A reader who knows nothing about the project should finish this paragraph
     understanding why it deserves to exist. -->

## Vision

<!-- One or two sentences: if this succeeds completely, what is true about the
     world? Outcome-oriented, not a feature list. Source: `vision_statement`. -->

## Why Now

<!-- Why this, why now, why over the alternatives (including doing nothing).
     Name the alternatives and the wedge/timing that make it viable.
     Source: `value_proposition`. -->

## Target Users & Personas

<!-- One subsection per distinct persona/role. For each: who they are, the job
     they hire this product for, their goals, frustrations, and context of use.
     For the primary persona include the "day in the life" narrative.
     For an SDK/library these are integrating developers; for IaC, operators.
     Sources: `target_users`, `persona_pain`. -->

### Primary persona — <name / role>

<!-- Goals · Frustrations today · Context of use · Definition of success for them -->

### Secondary personas

<!-- Brief entries for the remaining personas; depth proportional to importance. -->

## Goals & Success Metrics

<!-- The handful of OUTCOMES this must achieve, each tied to a measurable KPI.
     Distinguish from acceptance criteria (correctness, in REQUIREMENTS.md):
     these are about value delivered, measured after launch. -->

| Goal | Metric (KPI) | Baseline | Target | How measured |
|------|--------------|----------|--------|--------------|
| <e.g. drive adoption> | <e.g. weekly active users> | <today> | <target> | <instrument> |

### North-star metric

<!-- The single number that best signals success. Source: `north_star`,
     `success_metrics`. Everything above should ladder up to this. -->

## Scope (this PRD covers)

<!-- The boundary of the product this document describes. One or two lines.
     Functional detail lives in REQUIREMENTS.md; what is excluded lives in
     NON-GOALS.md; the phased plan lives in ROADMAP.md. Link, do not duplicate. -->

- Functional requirements → see `REQUIREMENTS.md`
- Out of scope / non-goals → see `NON-GOALS.md`
- Phasing & milestones → see `ROADMAP.md`
- Domain language → see `DOMAIN.md`
- Architecture → see `ARCHITECTURE.md`

## Open Questions

<!-- Product-level unknowns that affect WHAT gets built (technical unknowns go in
     ROADMAP.md#Open Questions). Each with an owner and a decide-by moment. -->

| Question | Owner | Decide by |
|----------|-------|-----------|
| <unresolved product decision> | <who> | <when> |

---

<!-- After this PRD is filled, `/ack-spec` proposes the first contract
     (C-001-<slug>) whose scope + acceptance trace back to REQUIREMENTS.md and
     NON-GOALS.md. See docs/contracts/CONTRACT.template.md for the contract shape. -->
