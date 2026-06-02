---
name: spec-first
description: >
  The spec-first / context-engineering methodology for this project: specs are
  living context that lead, code follows, and the kit emits context (Markdown
  specs + CLAUDE.md + .claude/ config) rather than boilerplate. Use when starting
  work in a freshly bootstrapped repo, when deciding whether to write a spec or
  code first, when running or reviewing /ack-spec output, when keeping specs and
  CLAUDE.md in sync with the code, or when onboarding someone to "how we build
  here". Trigger on "spec-first", "context engineering", "do I write the spec or
  the code", "what does /ack-spec do", "are the specs current", "least code".
  Do NOT use to author one PRD document (use the /prd command) or to scaffold a
  whole repo from a prose spec in a single shot (use spec-to-repo) — this skill
  is the surrounding *method*, not a one-shot generator.
license: Apache-2.0
---

# spec-first — specs lead, code follows

This project is built **spec-first**. The repository's primary artifact is not
code — it is **context**: a set of narrative Markdown specs, the `CLAUDE.md`
pointer file, the contracts, and the `.claude/` methodology. Code is written
*later*, guided by that context. The kit that bootstrapped this repo emits
**context, not boilerplate** — it deliberately minimizes generated code.

Internalize the loop: **read the spec → confirm intent → write the least code
that satisfies it → update the spec in the same change**. A change that alters
behavior without touching `specs/` is incomplete.

## When to use

- Starting work in a freshly bootstrapped repo and orienting to "how we build here".
- Deciding whether to write a spec or jump straight to code (answer: spec first).
- Running `/ack-spec`, or reviewing the specs it authored, before implementation.
- Keeping `specs/`, `CLAUDE.md`, and the code in sync as the project evolves.
- Onboarding a contributor or a new agent to the methodology.

## When NOT to use

- Authoring a single PRD document → use the `/prd` command.
- One-shot scaffolding a runnable repo from a prose spec → use `spec-to-repo`.
- Framework-specific code patterns → the relevant language pack skill.
- Hunting for correctness bugs in a diff → `/code-review`.

## The artifacts (where intent lives)

| Artifact | Role | Owner |
|---|---|---|
| `specs/PRD.md` | Product: users, problem, success metrics | human + `/ack-spec` |
| `specs/ARCHITECTURE.md` | System shape: components, boundaries, data flow | human + `/ack-spec` |
| `specs/DOMAIN.md` | Entities, relationships, **invariants that never break** | human + `/ack-spec` |
| `specs/REQUIREMENTS.md` | Functional + non-functional reqs; the testable "done" | human + `/ack-spec` |
| `specs/ROADMAP.md` | Sequence, milestones, this-slice vs. deferred | human + `/ack-spec` |
| `specs/NON-GOALS.md` | Explicitly out of scope (stops scope creep) | human |
| `docs/contracts/*.contract.md` | The gate's *approved?* oracle | human approves |
| `CLAUDE.md` | Lean pointer into all of the above | mixed (see below) |
| `.claude/` | Skills, conventions, hooks (incl. contract gate) | kit + human |

Specs are **living context**, not write-once docs. They are read by Claude on
every relevant turn and must stay true. When the code and a spec disagree, the
spec is the intent and the code is the bug — reconcile, do not silently diverge.

## The method, end to end

1. **Discover** (optional, moment-0). Capture vision, domain, requirements, and
   non-goals as free text. This seeds the `specs/` skeletons.
2. **Specify.** Run `/ack-spec` to author the specs from the vision (it infers
   architecture, domain entities, and requirements and fills the skeletons), or
   write them by hand. Review them — the model proposes, the human ratifies.
3. **Contract** (for protected paths). Seed and approve a contract before editing
   anything the gate protects. See `references/contract-gate.md`.
4. **Implement.** Write the **least code** that satisfies the approved spec. No
   speculative abstractions, no files the spec does not call for.
5. **Reconcile.** In the same change, update the spec(s) that the work touched.
   Keep `CLAUDE.md`'s pointers honest.

Full step-by-step, including arguments and review checklist, is in
`references/ack-spec-workflow.md`.

## Running /ack-spec

`/ack-spec` is **model-driven**: it reads the discovery/vision docs and the
domain stub, then authors the spec set — inferring API surface, persistence
shape, requirements, and an initial contract scope — and writes into the spec
skeletons (preserving headings). It is a *proposal*, not a fait accompli:

- Run it **after** discovery or after dropping a PRD into the repo, and **before**
  the first contract gate review.
- Review every section it fills. Correct domain invariants and non-goals by hand —
  those are the load-bearing parts.
- Re-run it when the vision changes; it updates the skeletons idempotently.

It does **not** write application code. Code comes after, in step 4, guided by the
specs it produced. See `references/ack-spec-workflow.md` for the exact flow.

## Keeping specs and CLAUDE.md in sync

`CLAUDE.md` is a **lean pointer file**, not a dump — it minimizes per-turn token
tax by `@`-importing the specs rather than inlining them. Keep it that way:

- New durable context → put it in the right `specs/` doc, not inline in `CLAUDE.md`.
- Add an `@import` to `CLAUDE.md` only when you add a *new* spec file.
- The managed block in `CLAUDE.md` (gate posture, protected paths) is regenerated
  by `/ack-init` — do not hand-edit it. The "House notes" section is yours.
- After any behavior change, ask: *does a spec now lie?* If so, fix it now.

## Core principles

1. **Context over code.** The valuable, durable artifact is the spec set. Code is
   regenerable from good context; good context is not regenerable from code.
2. **Least code.** Ship the smallest implementation the spec demands. YAGNI.
3. **Specs lead, code follows.** Never implement ahead of the spec; never let the
   spec drift behind the code.
4. **Narrative, not variables.** Specs are prose for humans and models to reason
   over — clear sections and invariants, not config.
5. **The human ratifies.** The model authors and proposes; a human approves the
   specs and the contracts. Approval is the gate, not generation.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Writing code before the spec exists | Author/confirm the spec section first; then implement. |
| Behavior change with no spec update | Update `specs/` in the same change — it is part of "done". |
| Dumping detail into `CLAUDE.md` | Put it in a spec; keep `CLAUDE.md` a lean pointer. |
| Treating `/ack-spec` output as final | Review and ratify; correct invariants and non-goals by hand. |
| Routing around the contract gate | Approve the governing contract, then edit the protected path. |
| Speculative scaffolding "for later" | Build only what the current spec/roadmap slice requires. |

## Reference files

| File | Content |
|---|---|
| `references/ack-spec-workflow.md` | Moment-0 → spec → contract → implement flow; `/ack-spec` arguments and review checklist |
| `references/contract-gate.md` | How contracts gate protected paths; the approve-then-edit loop |

## Cross-references

- `/prd` — author a single product requirements doc (feeds `specs/PRD.md`).
- `spec-to-repo` — one-shot generate a runnable starter from a prose spec.
- `coding-standards` — the quality floor the implementation step is held to.
