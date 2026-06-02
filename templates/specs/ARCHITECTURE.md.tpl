# Architecture — ${project.name}

> ${project.description}
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview. This is the "how": the system's shape, the load-bearing
>      decisions and their rationale, and the seams where it meets the outside
>      world. The "what/why" lives in PRD.md; the "must" in REQUIREMENTS.md.
>      Keep the headings. Architecture-level CHOICES belong here AND get a
>      standalone record under ./adr/ (use the architecture-decision-records
>      skill). This doc summarises and links; the ADRs hold the full reasoning. -->

## System Overview

<!-- The boxes-and-arrows narrative: the major components/services and how
     requests and data flow through them. State the architectural style
     (the manifest records project.architecture, e.g. layered/hexagonal/clean) and
     why it fits. Source: discovery `system_context`. Keep prose tight; let the
     diagram below carry the structure. -->

```text
<!-- Context / component diagram. ASCII is fine for the skeleton; replace with a
     real diagram (Mermaid `flowchart`, C4, or an image link) once stable.
     Show: external actors → entry points → core components → data stores →
     external integrations. -->
```

## Components

<!-- One row per major component. Responsibility = the single thing it owns.
     Keep components cohesive; if a responsibility column needs "and", split it. -->

| Component | Responsibility | Key dependencies |
|-----------|----------------|------------------|
| <name> | <single clear responsibility> | <what it relies on> |

## Key Decisions

<!-- The load-bearing architecture/design decisions. Summarise each here in a row
     and record the full reasoning as an ADR under ./adr/ (Context → Decision →
     Alternatives rejected → Consequences). Sources: `key_decisions`,
     `decision_rationale`. The most consequential decision should already have a
     drafted ADR — see ./adr/0001-record-architecture-decisions.md for the
     process and ./adr/template.md for the shape. -->

| # | Decision | Rationale (summary) | ADR |
|---|----------|---------------------|-----|
| 1 | <e.g. PostgreSQL over MongoDB> | <one-line why> | [ADR-0002](adr/0002-<slug>.md) |

## Data & Persistence

<!-- How and where state lives. The manifest records the engine/ORM/migrations
     (persistence.*); here describe the LOGICAL model: the main stores, the shape
     of the data, consistency expectations, and the migration/versioning approach.
     For projects with no persistence (persistence.enabled=false), state that
     explicitly and describe how state is handled instead (stateless, external). -->

## External Integrations

<!-- Every external system this talks to. Per integration: direction (we call
     them / they call us), protocol, authn, criticality, and the failure mode if
     it is unavailable + the containment (retry, circuit-breaker, fallback,
     queue). Sources: `external_integrations`, `integration_risks`. -->

| System | Direction | Protocol / auth | Criticality | Failure handling |
|--------|-----------|-----------------|-------------|------------------|
| <name> | inbound / outbound | <e.g. REST + OAuth2> | <hard / soft> | <retry / fallback / degrade> |

## Cross-Cutting Concerns

<!-- How the architecture addresses the NFRs flagged in REQUIREMENTS.md, at the
     STRUCTURAL level: security/authn-authz boundaries, observability (logging,
     metrics, tracing, audit), error handling, configuration, scalability seams.
     Reference the numbered NFRs (NFR-NN) rather than restating their targets. -->

- **Security:** <authn/authz model, trust boundaries, secret handling>
- **Observability:** <logs / metrics / traces / audit trail>
- **Scalability & resilience:** <where it scales, where it can fail safely>
- **Configuration:** <how environments/config are managed>

## Constraints & Trade-offs

<!-- The architecturally-significant constraints (from REQUIREMENTS.md#Constraints)
     and the trade-offs this design deliberately accepts. Be honest about what
     this architecture makes HARDER. -->

## Open Architecture Questions

<!-- Technical decisions still unresolved. Mirror to ROADMAP.md#Open Questions if
     they gate phases. Each with an owner and a decide-by. -->

---

<!-- ADRs live under ./adr/ and are the durable record of these decisions.
     Whenever a Key Decision above is made or changed, add/supersede an ADR. -->
