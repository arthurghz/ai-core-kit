# /ack-spec workflow — discovery to implementation

This is the end-to-end spec-first flow for this project. The headline rule:
**specs lead, code follows.** Each stage produces or refines *context*; code is
written only at the end, guided by the approved specs.

## The moments

| Moment | What happens | Determinism | Output |
|---|---|---|---|
| 0. Scaffold | `create-ack` / `/ack-init` write the manifest + spec SKELETONS + the DRAFT marker | deterministic | `project.manifest.yaml`, `specs/*` skeletons |
| 1. Specify (headline) | `/ack-spec` (or `create-ack spec`) runs the discovery interview and authors the spec set + a lean `CLAUDE.md`; human reviews | model-driven | filled `specs/*.md` |
| 1b. Finalize design | design-bearing archetypes: re-run `/ack-init` to merge the confirmed brand color and re-materialise the theme | deterministic | refreshed `design-system/theme/` |
| 2. Contract | Seed + approve a contract for any protected path | human approves | `docs/contracts/<id>.contract.md` at `approved` |
| 3. Implement | Write the **least code** that satisfies the spec | human + model | code + updated specs |

Moment 1 is the **headline** — the LLM island between two deterministic bookends
(scaffold before, finalize after). Discovery (moment 0's free-text capture) is
**optional**: if you already have a PRD or a written spec, point `/ack-spec --from`
at it and skip straight to authoring.

## Running /ack-spec

`/ack-spec` is model-driven. It does, in order:

1. **Read** the discovery/vision docs and the domain stub.
2. **Synthesize** an outline: what is the domain? what are the core entities and
   their invariants? what must the system do (functional) and how well
   (non-functional)? what is explicitly out of scope?
3. **Author** the spec set, filling the skeletons while preserving their
   headings — `specs/PRD.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `REQUIREMENTS.md`,
   `PLAN.md`, `ROADMAP.md`, `NON-GOALS.md` — plus `DESIGN.md` for the
   design-bearing archetypes (`fullstack`, `saas`) only.
4. **Seed** an initial contract (`C-001-<slug>`) with a `scope` inferred from the
   spec, left at `draft`/`proposed` for human approval.
5. **Summarize** what it wrote and the next step (review, then approve a contract,
   then implement). For design-bearing archetypes that confirmed a brand color, the
   next step is to **re-run `/ack-init`** to finalize the design system (it merges the
   confirmed `design_system.tokens.color_brand` and re-materialises the theme).

Typical invocations (all equivalent to the `create-ack spec` CLI entry, which shells
to `/ack-spec`):

- `/ack-spec` — author from the discovery docs already in the repo.
- `/ack-spec --from <path-to-PRD>` — author from an existing PRD/spec, skipping discovery.
- `/ack-spec --only PRD,DOMAIN` — author only the named docs; leave the rest untouched.
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
