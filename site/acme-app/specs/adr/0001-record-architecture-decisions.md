# ADR-0001: Record architecture decisions

**Date**: <!-- YYYY-MM-DD — set to the day this is accepted -->
**Status**: accepted
**Deciders**: <!-- who agreed to adopt ADRs (e.g. the founding team) -->

<!-- This is the seed ADR: the decision to KEEP architecture decisions as ADRs.
     It is shipped pre-filled as a starting point by `/ack-spec`. Adjust the date
     and deciders; the body below is a sound default you can keep as-is. Every
     subsequent decision gets its own file (0002, 0003, …) using ./template.md.
     The architecture-decision-records skill automates capturing new ones. -->

## Context

We want the reasoning behind significant architecture and design choices to
outlive any single chat thread, PR comment, or person's memory. As the project
evolves, future contributors (human and AI) repeatedly ask "why is it built this
way?" Without a durable record, that knowledge erodes and decisions get silently
re-litigated or accidentally reversed.

## Decision

We record architecturally-significant decisions as lightweight, Nygard-style ADRs
in `docs/specs/adr/`, numbered sequentially and version-controlled alongside the
code they govern. Each ADR captures context, the decision, the alternatives
rejected, and the consequences. New ADRs are appended; existing ones are never
edited in substance — they are superseded by a newer ADR that links back.

## Alternatives Considered

### Keep decisions only in PR descriptions and commit messages

- **Pros**: zero extra files; lives next to the change.
- **Cons**: not discoverable later; reasoning is scattered and lost to history.
- **Why not**: future readers cannot find or trust it.

### A single growing DECISIONS.md log

- **Pros**: one file to read.
- **Cons**: merge conflicts, no stable per-decision identity, hard to supersede.
- **Why not**: numbered, individually-addressable records age far better.

## Consequences

### Positive

- The "why" is durable, discoverable, and reviewable in PRs.
- New contributors (and AI agents) can self-serve the rationale.
- ARCHITECTURE.md#Key Decisions links to ADRs instead of re-explaining them.

### Negative

- A small, ongoing discipline cost: each significant decision needs a short write-up.

### Risks

- Risk: ADRs go stale or get skipped. Mitigation: capture decisions at the moment
  they are made (the architecture-decision-records skill prompts for this), and
  review the ADR index during architecture changes.

<!-- Index lives in ./README.md — add a row there for every ADR, including this one. -->
