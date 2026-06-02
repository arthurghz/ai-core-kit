# /ack-spec workflow — discovery to implementation

This is the end-to-end spec-first flow for this project. The headline rule:
**specs lead, code follows.** Each stage produces or refines *context*; code is
written only at the end, guided by the approved specs.

## The four moments

| Moment | What happens | Determinism | Output |
|---|---|---|---|
| 0. Discover | Free-text capture of vision, domain, requirements, non-goals | model + human | `specs/` skeletons seeded |
| 1. Specify | `/ack-spec` authors specs from the vision; human reviews | model-driven | filled `specs/*.md` |
| 2. Contract | Seed + approve a contract for any protected path | human approves | `docs/contracts/<id>.contract.md` at `approved` |
| 3. Implement | Write the **least code** that satisfies the spec | human + model | code + updated specs |

Discovery (moment 0) is **optional**. If you already have a PRD or a written
spec, skip it and point `/ack-spec` at the existing document.

## Running /ack-spec

`/ack-spec` is model-driven. It does, in order:

1. **Read** the discovery/vision docs and the domain stub.
2. **Synthesize** an outline: what is the domain? what are the core entities and
   their invariants? what must the system do (functional) and how well
   (non-functional)? what is explicitly out of scope?
3. **Author** the spec set, filling the skeletons while preserving their
   headings — `specs/PRD.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `REQUIREMENTS.md`,
   `ROADMAP.md`, and proposing `NON-GOALS.md`.
4. **Seed** an initial contract (`C-001-<slug>`) with a `scope` inferred from the
   spec, left at `draft`/`proposed` for human approval.
5. **Summarize** what it wrote and the next step (review, then approve a contract,
   then implement).

Typical invocations:

- `/ack-spec` — author from the discovery docs already in the repo.
- `/ack-spec --from <path-to-PRD>` — author from an existing PRD/spec, skipping discovery.
- `/ack-spec --review` — re-read the specs and flag gaps/contradictions without rewriting.

`/ack-spec` does **not** write application code. It produces context; code is
moment 3.

## Review checklist (after /ack-spec)

The model proposes; the human ratifies. Before relying on the specs:

- [ ] **PRD** names real users, a real problem, and measurable success metrics.
- [ ] **DOMAIN** lists the entities *and* the invariants that must never break —
      verify these by hand; they are load-bearing.
- [ ] **REQUIREMENTS** are testable — each maps to something a reviewer can check.
- [ ] **NON-GOALS** are honest and specific (this is what stops scope creep).
- [ ] **ARCHITECTURE** boundaries match the domain and the requirements.
- [ ] **ROADMAP** slices the work; the first slice is the smallest shippable thing.
- [ ] The seeded **contract** scope covers the protected paths you intend to touch.

## Then implement (moment 3)

Only after the specs are reviewed and (for protected paths) a contract is
approved:

1. Pick the smallest roadmap slice.
2. Write the **least code** that satisfies the relevant spec section — no
   speculative abstractions, no files the spec does not call for.
3. In the **same change**, update any spec the work touched, and add a new
   `@import` to `CLAUDE.md` only if you added a new spec file.
4. Run the project's tests and quality checks (`coding-standards`).

## Re-running

Specs are living context. Re-run `/ack-spec` when the vision changes; it updates
the skeletons idempotently. Re-run `/ack-init` to regenerate the managed blocks
(gate posture, protected paths) in `CLAUDE.md` and the manifest — never hand-edit
those managed blocks.
