# Domain Model — acme-app

> 
>
> <!-- STATUS: skeleton. Authored by `/ack-spec` from the moment-0 discovery
>      interview. This is the "language": the ubiquitous vocabulary, the core
>      entities and their relationships, and the invariants that must always hold.
>      The spec, the code, the tests, and the team must all use these terms
>      IDENTICALLY — that shared language is the point. Keep the headings. This is
>      a CONCEPTUAL model (business meaning), not a database schema; the physical
>      schema is implied by ARCHITECTURE.md#Data & Persistence and the manifest's
>      persistence.* block. Sources: discovery `domain_entities`,
>      `domain_relationships`, `ubiquitous_language`, `domain_invariants`. -->

## Glossary (Ubiquitous Language)

<!-- The shared vocabulary. Every term that has a SPECIFIC meaning in this domain,
     or that differs from everyday usage, with its precise definition HERE. Flag
     overloaded or ambiguous words and pin them to one meaning. Code, comments,
     and conversation should use exactly these terms. Source: `ubiquitous_language`.
     Keep alphabetical for findability. -->

| Term | Definition (in THIS domain) | Notes / synonyms to avoid |
|------|------------------------------|---------------------------|
| <Term> | <precise meaning> | <"do not call it X"> |

## Entities

<!-- The core nouns the system is fundamentally about. One subsection per entity:
     definition, key attributes, identity, lifecycle (states it moves through),
     and the invariants specific to it. Source: `domain_entities`. Use the
     glossary terms exactly. -->

### <Entity>

- **Definition:** <what it represents in the domain, in glossary terms>
- **Identity:** <what uniquely identifies an instance>
- **Key attributes:** <the attributes that matter at the domain level>
- **Lifecycle / states:** <created → … → terminal; valid transitions>
- **Owns / belongs to:** <its place in the relationship graph>

## Relationships

<!-- How the entities relate: cardinality, ownership, and lifecycle coupling
     ("an Order has many LineItems; a LineItem cannot exist without its Order").
     Source: `domain_relationships`. A diagram makes this concrete. -->

```text
<!-- Entity-relationship sketch. Mermaid `erDiagram` or ASCII is fine for the
     skeleton. Show entities, cardinalities, and ownership/composition. -->
```

| From | Relationship | To | Cardinality | Ownership |
|------|--------------|----|-------------|-----------|
| <Order> | contains | <LineItem> | 1..* | composition (LineItem dies with Order) |

## Invariants

<!-- The non-negotiable rules of the domain — the things that, if violated, mean
     the system is WRONG, independent of any single feature. State each as an
     always-true assertion. These are the strongest source of acceptance criteria
     and contract clauses (REQUIREMENTS.md#Acceptance Criteria). Source:
     `domain_invariants`. -->

- **INV-01** — <e.g. an account balance never goes negative>
- **INV-02** — <e.g. an email is unique per tenant>
- **INV-03** — <e.g. a shipped order cannot be cancelled>

## Bounded Contexts / Subdomains

<!-- OPTIONAL — include only if the domain is large enough to split. Name each
     bounded context, the entities it owns, and the language boundaries between
     them (the same word may mean different things in different contexts; say so).
     For small domains, delete this section. -->

| Context | Owns | Boundary notes |
|---------|------|----------------|
| <context> | <entities> | <where the language shifts> |

## Domain Events

<!-- OPTIONAL — the significant things that HAPPEN in the domain, in past tense
     ("OrderPlaced", "PaymentCaptured"), and what they trigger. Useful for
     event-driven designs and for tracing flows in ARCHITECTURE.md. Delete if
     not relevant. -->

| Event | Raised when | Consumers / effects |
|-------|-------------|---------------------|
| <OrderPlaced> | <condition> | <what reacts> |
