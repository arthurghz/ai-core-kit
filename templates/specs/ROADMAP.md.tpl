# Roadmap — ${project.name}

> ${project.description}
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview. This is the "when and in what order": the MVP, the phased plan,
>      and the risks/assumptions/open-questions to revisit at every gate. Keep the
>      headings. Phase 1 should map to REQUIREMENTS.md#Functional Requirements
>      (Must) and to the first contract's scope; later phases absorb the items
>      deferred in NON-GOALS.md. This is a PLAN, not a promise — date ranges are
>      directional and the risk register is meant to be revisited. Sources:
>      discovery `milestones`, `mvp_definition`, `risks`, `assumptions`,
>      `open_questions`. -->

## MVP / First Release

<!-- The smallest version that delivers real value and proves the core thesis.
     What is IN it, what is deferred, and the one validating outcome that says the
     bet is working. The MVP scope should equal phase 1 below and seed the first
     contract (C-001-<slug>). Source: `mvp_definition`. -->

- **Thesis it proves:** <the core bet validated by shipping this>
- **In the MVP:** <the thin end-to-end slice>
- **Explicitly deferred:** <what waits — link NON-GOALS.md entries>
- **Validation signal:** <the observable that says it worked>

## Phases

<!-- The major milestones in order, each with the ONE outcome that defines its
     completion and the key deliverables. Tie phase 1 to the MVP. Keep phases
     outcome-named, not date-named. Source: `milestones`. -->

| Phase | Goal (completion = this is true) | Key deliverables | Rough timing |
|-------|----------------------------------|------------------|--------------|
| 1 — MVP | <core thesis validated> | <FR-01…FR-0n> | <e.g. Q1> |
| 2 — <name> | <next outcome> | <…> | <e.g. Q2> |
| 3 — <name> | <next outcome> | <absorbs deferred non-goals> | <…> |

### Phase 1 — MVP

<!-- Expand the current/next phase: the specific scope, the requirements it
     covers (FR/NFR ids), exit criteria, and dependencies. Keep later phases as
     table rows until they come into focus (avoid false precision on the future). -->

## Risks & Mitigations

<!-- The biggest technical, product, market, and organisational risks. Per risk:
     likelihood, impact, the mitigation, and the early signal that tells you it is
     materialising. Revisited at EVERY contract gate. Source: `risks`,
     `integration_risks`. An empty risk register is rarely truthful — probe. -->

| ID | Risk | Likelihood | Impact | Mitigation | Early signal |
|----|------|-----------|--------|------------|--------------|
| R-01 | <description> | low/med/high | low/med/high | <how reduced> | <what to watch> |

## Assumptions

<!-- The load-bearing beliefs this plan rests on that, if wrong, change the
     approach. Pair each with HOW and WHEN it gets validated. Source:
     `assumptions`. -->

| ID | Assumption | If wrong, then… | Validate by |
|----|------------|-----------------|-------------|
| A-01 | <belief about users/scale/dependency> | <consequence> | <experiment / date> |

## Open Questions

<!-- Undecided or unknown items that need answers before or during the build.
     Each with an owner and a decide-by moment so nothing silently lingers.
     Technical-architecture questions may also live in
     ARCHITECTURE.md#Open Architecture Questions — link rather than duplicate.
     Source: `open_questions`. -->

| Question | Owner | Decide by | Blocks |
|----------|-------|-----------|--------|
| <unresolved decision> | <who> | <when> | <phase / requirement it gates> |

## Out of This Roadmap

<!-- Pointer, not content: items deliberately not planned live in NON-GOALS.md.
     Keep the deferred items there in sync with the Phases table above. -->

- Deliberately excluded work → see `NON-GOALS.md`
