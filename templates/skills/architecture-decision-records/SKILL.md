---
name: architecture-decision-records
description: >
  Capture architectural decisions as structured ADR documents that live in
  docs/adr/ alongside the code, recording context, alternatives considered, and
  rationale so future contributors understand why the codebase is shaped the way
  it is. Use when the user says "record this decision" / "ADR this", chooses
  between significant alternatives (framework, datastore, pattern, API style),
  states "we decided to… because…", or asks "why did we choose X" (read mode).
  Trigger on those phrases and during planning when trade-offs are weighed. Do
  NOT use for trivial choices (naming, formatting) or as a general docs writer —
  ADRs are short decision records, not prose documentation.
license: MIT
---

# Architecture Decision Records

Capture architectural decisions as they happen, so the reasoning does not live
only in a chat thread, a PR comment, or someone's memory. This skill produces
short, structured ADR documents in `docs/adr/` next to the code they govern.

## When to activate

- The user explicitly says "record this decision" or "ADR this".
- A choice is made between significant alternatives — framework, library,
  pattern, datastore, API design, auth strategy, infra.
- The user states "we decided to…" or "the reason we're doing X instead of Y is…".
- The user asks "why did we choose X?" → switch to **read mode**.
- During planning, when architectural trade-offs are discussed.

## When NOT to use

- Trivial decisions (variable naming, formatting) — they do not need an ADR.
- General prose documentation — use the project's docs flow, not an ADR.
- Recording a decision the user has not actually made — suggest, do not invent.

## ADR format

Lightweight Nygard-style format, adapted for AI-assisted development:

```markdown
# ADR-NNNN: <Decision Title>

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | deprecated | superseded by ADR-NNNN
**Deciders**: <who was involved>

## Context
What problem or force is motivating this decision? (2–5 sentences: situation,
constraints, forces at play.)

## Decision
What we are doing. (1–3 sentences, stated clearly, present tense.)

## Alternatives Considered
### <Alternative 1>
- **Pros**: …
- **Cons**: …
- **Why not**: <the specific reason it was rejected>

## Consequences
### Positive
- …
### Negative
- …
### Risks
- <risk and its mitigation>
```

## Capture workflow

When a decision moment is detected:

1. **Initialize (first time only).** If `docs/adr/` does not exist, ask the user
   to confirm before creating it, a `README.md` seeded with the index header,
   and a blank `template.md`. **Never create files without explicit consent.**
2. **Identify the decision** — the core architectural choice being made.
3. **Gather context** — the problem that prompted it and the live constraints.
4. **Document alternatives** — what else was considered and why each was rejected.
   "We just picked it" is not a valid rationale.
5. **State consequences** — the honest trade-offs; what gets easier and harder.
6. **Assign a number** — scan `docs/adr/` and increment (zero-padded, `0007`).
7. **Confirm and write** — present the draft for review. Write
   `docs/adr/NNNN-decision-title.md` only after explicit approval; if declined,
   discard without writing.
8. **Update the index** — append a row to `docs/adr/README.md`.

## Read workflow

When the user asks "why did we choose X?":

1. If `docs/adr/` does not exist, say so and offer to start recording decisions.
2. Scan `docs/adr/README.md` for relevant entries.
3. Read the matching ADR(s) and present the **Context** and **Decision** sections.
4. If nothing matches, say so and offer to record one now.

## Directory layout

```text
docs/adr/
├── README.md              ← index of all ADRs
├── 0001-use-nextjs.md
├── 0002-postgres-over-mongo.md
└── template.md            ← blank template for manual use
```

### Index format

```markdown
# Architecture Decision Records

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-use-nextjs.md) | Use Next.js as the frontend framework | accepted | 2026-01-15 |
| [0002](0002-postgres-over-mongo.md) | PostgreSQL over MongoDB | accepted | 2026-01-20 |
```

## Detection signals

**Explicit** — "let's go with X", "we should use X instead of Y", "the trade-off
is worth it because…", "record this as an ADR".

**Implicit** (suggest an ADR; do not auto-create) — comparing two
frameworks/libraries to a conclusion, a schema-design choice with stated
rationale, monolith-vs-microservices or REST-vs-GraphQL calls, choosing an
auth/authorization strategy, picking deployment infrastructure after evaluation.

## What makes a good ADR

**Do** — be specific ("use Prisma ORM", not "use an ORM"); record the *why*;
include rejected alternatives; state consequences honestly; keep it readable in
two minutes; write in present tense.

**Don't** — record trivial decisions; write essays (a Context over ~10 lines is
too long); omit alternatives; backfill without marking the original date; let a
superseded ADR go stale without linking its replacement.

## Lifecycle

```text
proposed → accepted → [deprecated | superseded by ADR-NNNN]
```

- **proposed** — under discussion, not yet committed.
- **accepted** — in effect and being followed.
- **deprecated** — no longer relevant (e.g. the feature was removed).
- **superseded** — replaced by a newer ADR; always link the replacement.

## Categories worth recording

| Category | Examples |
|----------|----------|
| Technology | framework, language, datastore, cloud provider |
| Architecture | monolith vs microservices, event-driven, CQRS |
| API design | REST vs GraphQL, versioning, auth mechanism |
| Data modeling | schema design, normalization, caching strategy |
| Infrastructure | deployment model, CI/CD, observability stack |
| Security | auth strategy, encryption, secret management |
| Process | branching, review, release cadence |

## Related skills

- `code-tour` — turn a set of related ADRs into a guided architecture walkthrough.
- `coding-standards` — the conventions an architecture decision is implemented against.
