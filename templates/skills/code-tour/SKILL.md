---
name: code-tour
description: >
  Create CodeTour `.tour` files — persona-targeted, step-by-step codebase
  walkthroughs anchored to real files and line ranges, written to `.tours/`. Use
  for onboarding tours, architecture walkthroughs, PR-review tours, RCA/failure
  tours, security-boundary tours, and structured "explain how this works"
  requests that should leave behind a reusable guided artifact. Trigger on "give
  me a code tour", "onboarding walkthrough", "tour this PR", or "walk me through
  how X works". Do NOT use when a one-off chat explanation suffices, when the
  user wants prose docs rather than a `.tour` artifact, or when the task is
  actually implementation/refactoring.
license: MIT
---

# Code Tour

Create **CodeTour** `.tour` files — guided walkthroughs that open directly to
real files and line ranges. Tours live in `.tours/` and use the CodeTour JSON
format, not ad hoc Markdown notes.

A good tour is a narrative for a specific reader: what they are looking at, why
it matters, and where to go next. Only create `.tour` JSON files — do not modify
source code as part of this skill.

## When to use

- The user asks for a code tour, onboarding tour, architecture walkthrough, or PR tour.
- The user says "explain how X works" and wants a reusable guided artifact.
- The user wants a ramp-up path for a new engineer or reviewer.
- The task is better served by a guided sequence than a flat summary.

Examples: onboarding a new maintainer, an architecture tour of one service, a
PR-review walk-through anchored to the changed files, an RCA tour tracing a
failure path, a security tour of trust boundaries and key checks.

## When NOT to use

| Instead of code-tour… | Use |
|---|---|
| A one-off chat explanation is enough | answer directly |
| The user wants prose docs, not a `.tour` artifact | edit the repo docs |
| The task is implementation or refactoring | do the implementation work |
| Broad onboarding without a tour artifact | a plain codebase walk-through |

## Workflow

1. **Discover.** Explore before writing: README, app/package entry points, folder
   structure, relevant config, and (for a PR tour) the changed files. Do not write
   steps before you understand the shape of the code.
2. **Infer the reader.** Pick persona and depth from the request (table below).
3. **Read and verify anchors.** Every path and line must be real — confirm the
   file exists, the line numbers are in range, and any selection block is exact.
   For volatile files, prefer a pattern anchor. **Never guess line numbers.**
4. **Write the `.tour`** to `.tours/<persona>-<focus>.tour` — deterministic and readable.
5. **Validate** before finishing: every path exists, every line/selection is
   valid, the first step anchors to a real file or directory, and the tour tells
   a coherent story rather than listing files.

### Persona & depth

| Request shape | Persona | Suggested depth |
|---|---|---|
| "onboarding", "new joiner" | `new-joiner` | 9–13 steps |
| "quick tour", "vibe check" | `quick-look` | 5–8 steps |
| "architecture" | `architect` | 14–18 steps |
| "tour this PR" | `pr-reviewer` | 7–11 steps |
| "why did this break" | `rca-investigator` | 7–11 steps |
| "security review" | `security-reviewer` | 7–11 steps |
| "explain how this feature works" | `feature-explainer` | 7–11 steps |
| "debug this path" | `bug-fixer` | 7–11 steps |

## Step types

**Content** — use sparingly, usually only for a closing step. Never the first step.

```json
{ "title": "Next Steps", "description": "You can now trace the request path end to end." }
```

**Directory** — orient the reader to a module.

```json
{ "directory": "src/services", "title": "Service Layer", "description": "Core orchestration lives here." }
```

**File + line** — the default step type.

```json
{ "file": "src/auth/middleware.ts", "line": 42, "title": "Auth Gate", "description": "Every protected request passes here first." }
```

**Selection** — when one block matters more than the whole file.

```json
{
  "file": "src/core/pipeline.ts",
  "selection": { "start": { "line": 15, "character": 0 }, "end": { "line": 34, "character": 0 } },
  "title": "Request Pipeline",
  "description": "Wires validation, auth, and downstream execution."
}
```

**Pattern** — when exact lines may drift.

```json
{ "file": "src/app.ts", "pattern": "export default class App", "title": "Application Entry" }
```

**URI** — link a PR, issue, or doc when helpful.

```json
{ "uri": "https://github.com/org/repo/pull/456", "title": "The PR" }
```

## Writing rule: SMIG

Each description should answer:

- **Situation** — what the reader is looking at.
- **Mechanism** — how it works.
- **Implication** — why it matters for this persona.
- **Gotcha** — what a smart reader might miss.

Keep descriptions compact, specific, and grounded in the actual code.

## Narrative shape

Unless the task clearly needs otherwise: orientation → module map → core
execution path → edge case or gotcha → closing / next move. The tour should feel
like a path, not an inventory.

## Example

```json
{
  "$schema": "https://aka.ms/codetour-schema",
  "title": "API Service Tour",
  "description": "Walkthrough of the request path for the payments service.",
  "ref": "main",
  "steps": [
    { "directory": "src", "title": "Source Root", "description": "All runtime code starts here." },
    { "file": "src/server.ts", "line": 12, "title": "Entry Point", "description": "The server boots here and wires middleware before any route is reached." },
    { "file": "src/routes/payments.ts", "line": 8, "title": "Payment Routes", "description": "Every payments request enters through this router before hitting service logic." },
    { "title": "Next Steps", "description": "You can now follow any payment request end to end." }
  ]
}
```

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Flat file listing | Make steps depend on each other; tell a story |
| Generic descriptions | Name the concrete code path or pattern |
| Guessed anchors | Verify every file and line first |
| Too many steps for a quick tour | Cut aggressively |
| First step is content-only | Anchor the first step to a real file or directory |
| Persona mismatch | Write for the actual reader, not a generic engineer |

## Best practices

- Keep step count proportional to repo size and persona depth.
- Directory steps for orientation, file steps for substance.
- For PR tours, cover changed files first.
- For monorepos, scope to the relevant packages, not the whole tree.
- Close with what the reader can now do, not a recap.

## Related skills

- `architecture-decision-records` — link the ADRs that explain *why* a tour stop looks the way it does.
- `coding-standards` — the conventions a reader will see applied throughout the tour.
- Upstream format: `microsoft/codetour`.
