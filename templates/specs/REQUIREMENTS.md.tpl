# Requirements — ${project.name}

> ${project.description}
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview. This is the "must": the testable functional and non-functional
>      requirements, the constraints the solution lives within, and the
>      acceptance criteria that define "done". Keep requirements ATOMIC,
>      NUMBERED, and VERIFIABLE — each one should map cleanly to a test and,
>      where it governs a protected path, to a clause in a contract
>      (docs/contracts/). The "why" is in PRD.md; the "how" in ARCHITECTURE.md.
>      Numbering is stable: never renumber an existing requirement; mark removed
>      ones as Deprecated rather than reusing the id. -->

## Functional Requirements

<!-- Each FR-NN: a single, testable capability the system MUST provide, phrased as
     observable behaviour. Prefer the user-story frame where it fits. Priority via
     MoSCoW (Must / Should / Could / Won't-now). Sources: discovery
     `core_use_cases`, `in_scope_features`. One requirement per row; if a row
     needs "and", split it. -->

| ID | Requirement | Priority | Acceptance (how verified) |
|----|-------------|----------|---------------------------|
| FR-01 | As a <persona>, I can <capability> so that <outcome>. | Must | <given/when/then or test ref> |
| FR-02 | <next capability> | Should | <…> |

<!-- For complex requirements, expand below with their detailed behaviour, edge
     cases, and error handling. Reference the FR id. -->

### FR-01 — <title>

<!-- Detailed behaviour, inputs/outputs, edge cases, error paths. Optional;
     only for requirements that need more than a table row. -->

## Non-Functional Requirements

<!-- Each NFR-NN: a quality attribute with a MEASURABLE target and a verification
     method. Reject vague targets ("fast", "secure") — every NFR has a number, a
     unit, and a way to check it. Only include dimensions flagged in discovery
     (`nfr_categories`); for each, state the target from `nfr_targets`. Note the
     dimensions deliberately NOT treated as primary constraints, so silence is
     never ambiguous. -->

| ID | Category | Requirement (measurable) | Target | Verification |
|----|----------|--------------------------|--------|--------------|
| NFR-01 | Performance | <e.g. p95 API latency> | <e.g. < 200ms at 1k rps> | <load test> |
| NFR-02 | Availability | <e.g. monthly uptime> | <e.g. 99.9%> | <SLO monitor> |
| NFR-03 | Security | <e.g. authn on all write paths> | <100%> | <test + review> |

### Not primary constraints

<!-- Explicitly list the NFR dimensions that are NOT first-class for this project
     (so a future reader knows it was a choice, not an oversight). -->

## Compliance & Regulatory

<!-- Regulatory, contractual, or policy obligations the system must demonstrably
     meet (GDPR, HIPAA, PCI, SOC2, internal policy). Per obligation: what it
     requires AND the evidence/audit trail needed to prove it. Source:
     `compliance_obligations`. "None applicable" is a valid, explicit entry. -->

| Obligation | What it requires | Evidence / audit |
|------------|------------------|------------------|
| <e.g. GDPR> | <data subject rights, deletion, consent> | <logs, DPA, records> |

## Constraints

<!-- Externally-imposed limits the design cannot violate: budget, deadline, team
     size, mandated/forbidden technology, data residency, systems it must live
     within. Distinguish from preferences. Source: `hard_constraints`. -->

| Constraint | Detail | Impact on design |
|------------|--------|-------------------|
| <e.g. data residency> | <e.g. EU-only storage> | <region pinning, vendor choice> |

## Acceptance Criteria

<!-- The observable behaviours that define "the first deliverable is done and
     correct". Prefer given/when/then. These seed the FIRST contract's acceptance
     section (docs/contracts/). Strongest acceptance clauses come from domain
     INVARIANTS (DOMAIN.md#Invariants) — restate the load-bearing ones here as
     checks. Source: discovery `primary_acceptance`, `domain_invariants`. -->

- [ ] **AC-01** — Given <context>, when <action>, then <observable result>.
- [ ] **AC-02** — Invariant: <always-true rule> holds under <conditions>.
- [ ] **AC-03** — <…>

## Traceability

<!-- Optional but valuable: map requirements ⇄ tests ⇄ contracts so coverage gaps
     and orphan requirements are visible. The contract gate enforces that edits to
     protected paths trace to an approved contract; this table is the human view. -->

| Requirement | Test(s) | Contract |
|-------------|---------|----------|
| FR-01 | <test ref> | C-001-<slug> |
