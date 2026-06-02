# Plan — ${project.name}

> ${project.description}
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview (templates/interview/spec-questions.yaml, the PLAN & SEQUENCING
>      bank). This is the BUILD plan: the order work happens in, why that order,
>      and how each phase is proven done — derived from REQUIREMENTS.md (the FR/NFR
>      it delivers) and ROADMAP.md (the phases it sequences). Keep the headings
>      (CLAUDE.md links to them). The governing rule of this repo is SPECS LEAD,
>      CODE FOLLOWS: a phase does not start until its slice of the specs is written
>      and its acceptance is known. Keep phases and build steps ATOMIC, NUMBERED,
>      and TRACEABLE — each maps to FR/NFR ids, a ROADMAP phase, and a validation
>      gate. Numbering is stable: never renumber an existing phase; mark dropped
>      ones as Deprecated rather than reusing the id. The PLAN is a living
>      sequence, not a promise — revisit it at every contract gate. -->

## Sequencing principle — specs lead, code follows

<!-- State the operating rule explicitly so every phase below inherits it: no code
     is written for a phase until (a) the relevant REQUIREMENTS.md FR/NFR and their
     acceptance exist, (b) DESIGN.md DA-NN exist for any UI in the phase, and (c) a
     contract governs the protected paths the phase will touch. This is the kit's
     contract gate restated as a build discipline. -->

1. **Spec before code.** A phase begins only when its requirements, acceptance, and
   (for UI) design acceptance are written. The spec is the definition of done.
2. **Contract before protected edits.** Edits under protected paths are gated on an
   *approved* contract whose scope covers them — propose/approve it as part of
   starting the phase, never after.
3. **Thinnest slice first.** Prove the thesis end-to-end before widening; see
   First Slice below.

## First Slice

<!-- The thinnest vertical slice that proves the core thesis end-to-end — one path
     through the whole stack, not a horizontal layer. This becomes Phase 1 and the
     scope of the first contract. State what it touches, the single observable that
     proves it works, and what it deliberately leaves out (link NON-GOALS.md).
     Source: discovery `plan_first_slice`; mirror ROADMAP.md#MVP. -->

- **Thesis it proves:** <the core bet validated by shipping this one path>
- **The slice (end-to-end):** <entry → through the stack → observable result>
- **Proves it works when:** <the single validation signal>
- **Deliberately NOT in the slice:** <deferred — link NON-GOALS.md / later phases>

## Phases

<!-- The build phases in order, each tracing to a ROADMAP phase and the FR/NFR ids
     it delivers. Phase 1 = the First Slice above. Keep phases outcome-named (the
     completion condition), not date-named. Each phase names its deliverables and
     the gate that proves it done (detailed under Validation Gates). Source:
     `milestones`, `plan_sequencing`. -->

| Phase | Outcome (done = this is true) | Delivers (FR/NFR) | ROADMAP phase | Gate |
|-------|-------------------------------|-------------------|---------------|------|
| 1 — First Slice | <thesis validated end-to-end> | <FR-01…> | <MVP> | G1 |
| 2 — <name> | <next outcome> | <FR-0n, NFR-0n> | <phase 2> | G2 |
| 3 — <name> | <next outcome> | <…> | <phase 3> | G3 |

### Phase 1 — First Slice

<!-- Expand the current/next phase: the specific deliverables, the requirements it
     covers (FR/NFR ids), the design acceptance (DA-NN) for any UI, the exit
     criteria, and dependencies. Keep later phases as table rows until they come
     into focus — avoid false precision on the future. -->

- **Deliverables:** <the concrete artifacts this phase ships>
- **Requirements covered:** <FR-NN, NFR-NN>
- **Design acceptance (if UI):** <DA-NN from DESIGN.md>
- **Exit criteria:** <the observable conditions that close the phase>

## Build Order

<!-- The ordered build steps WITH the dependency reason for each — the "why this
     before that" is the load-bearing part ("auth before billing because billing
     needs an authenticated subject"). A step with no dependency reason is a
     to-do, not a plan. Source: `plan_sequencing`. Keep steps small enough to land
     behind a single contract. -->

| # | Step | Depends on | Why this order |
|---|------|-----------|----------------|
| 1 | <e.g. data model + persistence> | — | foundation everything else reads/writes |
| 2 | <e.g. core domain logic> | step 1 | needs the model to enforce invariants |
| 3 | <e.g. API / UI surface> | step 2 | exposes the validated domain |

## Validation Gates

<!-- How each phase is PROVEN done — the test/observe gate, one per phase. Validate
     at every gate (do not batch validation to the end). Per gate: the automated
     checks (tests, lint, types), the manual/observed checks, and the acceptance
     criteria it must satisfy (from REQUIREMENTS.md#Acceptance and DESIGN.md DA-NN).
     A phase is not done until its gate is green. Source: `plan_validation_per_phase`. -->

| Gate | Phase | Automated checks | Observed checks | Acceptance satisfied |
|------|-------|------------------|-----------------|----------------------|
| G1 | 1 | <unit + integration; lint; types> | <the slice runs end-to-end> | <AC-01…, DA-01…> |
| G2 | 2 | <…> | <…> | <…> |

## First Contract

<!-- The first contract proposal (C-001-<slug>), anchored to the First Slice. Its
     SCOPE is the globs the first slice touches (a subset of the gate's protected
     paths) and its ACCEPTANCE restates the load-bearing AC/DA the slice must meet.
     `/ack-spec` drafts it at `status: draft`; it is never auto-approved — a human
     approves it before any protected-path edit. Source: `plan_contract_scope`,
     REQUIREMENTS.md#Acceptance, DOMAIN.md#Invariants. See
     docs/contracts/CONTRACT.template.md for the shape. -->

- **Proposed id:** `C-001-<slug>`
- **Scope (globs the first slice touches):**
  - `<e.g. src/**>`
  - `<e.g. app/**>`
- **Acceptance (restated from specs):**
  - <AC-NN from REQUIREMENTS.md>
  - <DA-NN from DESIGN.md, if the slice has UI>
  - <INV-NN from DOMAIN.md, where the slice must hold an invariant>
- **Status:** draft (a human approves before the first protected-path edit)

## Open Plan Questions

<!-- Sequencing or scoping decisions still unresolved — what could reorder the
     plan, and what would force a re-plan. Each with an owner and a decide-by so
     nothing silently lingers. Mirror to ROADMAP.md#Open Questions if it gates a
     phase. -->

| Question | Owner | Decide by | Blocks (phase / step) |
|----------|-------|-----------|-----------------------|
| <unresolved sequencing decision> | <who> | <when> | <phase / step it gates> |

## Traceability

<!-- Map phase ⇄ requirements ⇄ validation gate ⇄ contract, so coverage gaps and
     orphan phases are visible. The contract gate enforces that edits to protected
     paths trace to an approved contract; this table is the human view of how the
     plan, the specs, and the gate line up. -->

| Phase | Requirements (FR/NFR) | Design (DA) | Gate | Contract |
|-------|-----------------------|-------------|------|----------|
| 1 | FR-01… | DA-01… | G1 | C-001-<slug> |
| 2 | … | … | G2 | <next contract> |

---

<!-- When a phase ships, reconcile this PLAN with what actually happened: mark the
     phase done, fold lessons into the next gate, and revisit the risk register in
     ROADMAP.md. Specs lead, code follows — if the build taught you the spec was
     wrong, fix the spec first, then the plan, then the code. -->
