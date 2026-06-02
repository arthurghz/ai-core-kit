# Architecture Decision Records — ${project.name}

This directory holds the durable record of architecturally-significant decisions
for this project: short, structured documents capturing the context, the choice,
the alternatives rejected, and the consequences. They live next to the code they
govern so the *why* never goes missing.

<!-- This index is maintained by hand (and by the architecture-decision-records
     skill). Add a row for every ADR, newest at the bottom. Keep it in sync with
     ARCHITECTURE.md#Key Decisions, which links here. -->

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | accepted | <!-- YYYY-MM-DD --> |
<!-- | [0002](0002-<slug>.md) | <Decision title> | proposed | YYYY-MM-DD | -->

## How to add one

1. Copy [`template.md`](template.md) to `NNNN-<short-decision-title>.md`, where
   `NNNN` is the next zero-padded number (scan this index and increment).
2. Fill every section. "We just picked it" is not a valid rationale — record the
   alternatives you rejected and *why*.
3. Add a row to the **Index** above.
4. Reference it from `ARCHITECTURE.md#Key Decisions`.

Or just say "record this decision" / "ADR this" in Claude Code and the
`architecture-decision-records` skill will walk through it.

## Status lifecycle

```text
proposed → accepted → [deprecated | superseded by ADR-NNNN]
```

- **proposed** — under discussion, not yet committed.
- **accepted** — in effect and being followed.
- **deprecated** — no longer relevant (e.g. the feature was removed).
- **superseded** — replaced by a newer ADR; always link the replacement, and do
  not edit the original's substance — supersede it instead.

## What deserves an ADR

Significant, hard-to-reverse choices: datastore, framework, API style (REST vs
GraphQL), sync vs async, monolith vs services, auth strategy, deployment model,
key schema-design calls. **Not** trivial choices (naming, formatting) and **not**
general prose documentation — those belong elsewhere.
