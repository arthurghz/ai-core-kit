---
name: coding-standards
description: >
  Baseline, cross-language coding conventions for naming, readability,
  immutability, type safety, and code-smell review — the shared quality floor for
  any module in this project. Use when starting a new module, reviewing code for
  maintainability, refactoring toward conventions, or onboarding a contributor.
  Trigger on "clean this up", "is this idiomatic", "review for quality", or
  "what are our conventions". Do NOT use as the source for framework-specific
  patterns — defer to the relevant language pack (e.g. react-patterns,
  fastapi-patterns) or to error-handling for the error contract.
license: MIT
---

# Coding Standards

The baseline coding conventions every module in this project is held to. This is
the shared **floor**, not a framework playbook — when a narrower skill exists
(`react-patterns`, `fastapi-patterns`, `go-patterns`, `error-handling`,
`frontend-a11y`), that skill wins for its domain.

## When to activate

- Starting a new module, package, or service.
- Reviewing a diff for quality and maintainability (not bugs — that is `code-review`).
- Refactoring existing code toward the project conventions.
- Setting up or tightening linting, formatting, or type-checking config.
- Onboarding a contributor to how this codebase is written.

## When NOT to use

- Framework composition, hooks, rendering, routing → the relevant language pack.
- The error-handling contract (typed errors, retries, envelopes) → `error-handling`.
- Hunting for correctness bugs in a change → `code-review` / `security-review`.

## Core principles

1. **Readability first.** Code is read far more than written. Prefer
   self-documenting names over comments that restate the code.
2. **KISS.** Ship the simplest thing that works. No speculative generality, no
   premature optimization.
3. **DRY, with judgment.** Extract genuinely shared logic; do not over-abstract
   two superficially-similar call sites into one wrong abstraction.
4. **YAGNI.** Build for the requirement in front of you. Add the seam when the
   second caller actually arrives.
5. **Immutability by default.** Treat inputs as read-only; produce new values
   rather than mutating shared state, except in a hot path with a measured reason.

## Naming

Names are the cheapest documentation you will ever write.

```text
GOOD                                BAD
marketSearchQuery                   q
isUserAuthenticated                 flag
fetchMarketData(marketId)           market(id)
calculateSimilarity(a, b)           sim(a, b)
isValidEmail(email): boolean        email(e)
```

- **Variables**: descriptive nouns; booleans read as predicates (`is…`, `has…`, `should…`).
- **Functions**: verb-noun (`fetchUser`, `renderRow`, `validatePayload`).
- **Constants**: name the magic number — `MAX_RETRIES = 3`, not a bare `3`.
- **Files**: follow the language's idiom consistently (PascalCase components,
  `use`-prefixed hooks, `*_test`/`*.test` for tests). Pick one scheme per layer
  and do not mix.

## Type safety

Lean on the type system; it is the cheapest test you have.

```ts
// GOOD — precise, closed set
interface Market {
  id: string
  name: string
  status: 'active' | 'resolved' | 'closed'
  createdAt: Date
}
function getMarket(id: string): Promise<Market> { /* … */ }

// BAD — `any` erases every guarantee downstream
function getMarket(id: any): Promise<any> { /* … */ }
```

- Avoid `any` / untyped escape hatches; if you must, isolate and comment why.
- Prefer narrow unions and enums over loose strings for closed sets.
- In dynamically-typed languages, validate untrusted input at the boundary
  (schema validation) and treat the validated value as the typed core.

## Functions and control flow

- **Keep functions short** — if one exceeds ~50 lines or does more than one
  thing, split it.
- **Guard-clause early returns** over deep nesting:

```text
// BAD                         // GOOD
if (user) {                    if (!user) return
  if (user.isAdmin) {          if (!user.isAdmin) return
    if (record) {              if (!record) return
      // do work               // do work
    }
  }
}
```

- **Parallelize independent async work** (`Promise.all`, goroutines,
  `asyncio.gather`) instead of awaiting sequentially when there is no dependency.

## Comments and documentation

Comment the **why**, never the **what** — the code already says what.

```ts
// GOOD: explains a non-obvious decision
// Exponential backoff caps at 30s so a provider outage can't stall the queue.
const delay = Math.min(1000 * 2 ** retry, 30_000)

// BAD: restates the code
count++ // increment count
```

Document **public** APIs with the language's doc convention (JSDoc/docstrings/Go
doc comments): purpose, params, return, errors raised, and one example for
anything non-trivial.

## Code-smell checklist (review lens)

- [ ] Functions under ~50 lines, doing one thing.
- [ ] No nesting deeper than ~3 levels — refactor with early returns or extraction.
- [ ] No magic numbers or magic strings — named constants instead.
- [ ] No dead code, commented-out blocks, or `TODO` without an owner/issue.
- [ ] No `any`/untyped leaks crossing a module boundary.
- [ ] Inputs treated as immutable unless mutation is deliberate and noted.
- [ ] Names survive being read aloud to someone unfamiliar with the code.
- [ ] Errors handled per the project `error-handling` contract — never swallowed.

## Project structure

Group by **feature/domain** at the top, by **layer** within it; keep a flat,
discoverable tree and avoid deep nesting. Co-locate tests with the code they
cover unless the toolchain mandates otherwise. Keep generated artifacts and
vendored code out of the hand-authored tree.

## Related skills

- `error-handling` — the typed-error and failure contract this floor assumes.
- `frontend-a11y` — accessibility requirements for any interactive UI.
- Language packs under `skills/lang/` — framework-specific patterns that extend
  this floor.
