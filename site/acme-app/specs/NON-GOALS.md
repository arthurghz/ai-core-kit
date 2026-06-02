# Non-Goals — acme-app

> 
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview. A non-goal is as load-bearing as a requirement: it is the
>      explicit boundary that keeps scope honest, prevents creep, and tells the
>      contract gate what NOT to expand into. Every entry names WHAT is excluded
>      and WHY, and distinguishes "not yet" (deferred → ROADMAP.md) from
>      "not ever" (a deliberate, durable boundary). Keep the headings. Sources:
>      discovery `non_goals`, `non_goal_rationale`. -->

## Out of Scope

<!-- Things people might reasonably EXPECT this project to do, that it is
     deliberately NOT doing. For each: a clear statement of the exclusion, the
     rationale (the trade-off or cost that makes resisting it the right call),
     and its disposition (Deferred vs Never). A non-goal without a reason is just
     an omission — always give the why. -->

| Non-goal | Why excluded (the trade-off) | Disposition |
|----------|------------------------------|-------------|
| <e.g. multi-tenancy in v1> | <adds isolation complexity that delays the core bet> | Deferred → ROADMAP phase 3 |
| <e.g. on-prem deployment> | <ops burden incompatible with team size; not the target market> | Never |

## Rationale

<!-- For the most TEMPTING non-goal (the one people will keep pushing for),
     explain in prose why resisting it is correct: what adding it would cost or
     compromise, and what signal would make you revisit. This is the argument you
     point to when the pressure comes. Source: `non_goal_rationale`. -->

## Deferred (revisit later)

<!-- Non-goals with disposition "Deferred": not now, but plausibly later. Each
     links to where it lives on the roadmap and the condition that would promote
     it into scope. Keep this in sync with ROADMAP.md so nothing is silently lost. -->

| Deferred item | Revisit when | Roadmap link |
|---------------|--------------|--------------|
| <item> | <triggering condition / phase> | ROADMAP.md#<phase> |

## Explicit Anti-Goals

<!-- OPTIONAL but powerful: things the project actively does NOT want to become —
     outcomes to steer away from even if technically possible (e.g. "not a
     general-purpose platform", "not a system of record"). These guard the
     product's identity, not just its scope. Delete if not applicable. -->

- <e.g. This is not a general-purpose workflow engine; it does one job well.>
