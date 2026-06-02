# Spec parsing guide

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `spec-to-repo` skill, Phase 1.

How to extract structured requirements from an ambiguous, incomplete, or
conversational specification.

## Strategy

Read the full spec once. On a second pass, extract fields into the interpretation
table. Do not ask about anything you can reasonably infer.

**Extraction priority (highest first):**

1. **Explicit statements** — "Use PostgreSQL", "Build with Next.js" —
   non-negotiable, never override.
2. **Strong signals** — "users can sign up" implies auth + a user model + a
   database.
3. **Contextual inference** — "dashboard" implies a web app; "track expenses"
   implies CRUD + a database.
4. **Defaults** — when nothing is stated, pick the most common choice for the
   domain.

## Ambiguity resolution

### Stack not specified

| Spec pattern | Default | Why |
|---|---|---|
| Web app with UI | Next.js + TypeScript | versatile, SSR + API routes |
| API / backend only | FastAPI | fast to scaffold, typed |
| Mobile app | Flutter | one cross-platform codebase |
| CLI tool | Python | fastest to ship, stdlib-rich |
| "simple" / "lightweight" | Express or Flask | minimal overhead |
| "fast" / "performance" | Go | compiled, concurrent |

### Database not specified

| Signal | Default |
|---|---|
| User accounts, persistent data | PostgreSQL |
| Small / local-only / CLI | SQLite |
| Document-oriented, flexible schema | MongoDB (only if signaled) |
| No persistence mentioned | **No database — do not add one** |

### Auth not specified

| Signal | Default |
|---|---|
| "users", "accounts", "login" | yes — session or JWT |
| "admin panel", "roles" | yes — with role-based access |
| API with "API keys" | yes — API-key middleware |
| No user-facing features | **No auth — do not add one** |

## Common spec shapes

- **Stream of consciousness** — "people post recipes, others comment and save
  favorites, maybe ratings, looks nice on mobile." → Features: post / comment /
  favorite / rate; responsive UI; implies auth + DB (recipes, comments,
  favorites, ratings) + web app.
- **Feature list** — numbered features, each gets a route/component; registration
  ⇒ auth; named entities ⇒ tables. Flag complex features (kanban = drag-drop,
  uploads = storage).
- **Technical spec** — "FastAPI + PostgreSQL, SQLAlchemy, JWT, 5 CRUD endpoints."
  Stack and API fully defined; generate exactly what is asked, minimal inference.
- **Existing PRD** — read the overview for scope, map feature requirements to
  files, seed test cases from acceptance criteria; ignore personas, market
  analysis, and timelines — they do not affect code generation.

## Ask vs. infer

**Ask (≤ 3 questions)** — only when it materially changes the code:
stack when truly ambiguous; SQL vs. NoSQL when equally valid; deploy target when
it forces serverless vs. container.

**Infer silently** — auth method (JWT for APIs, session for web); test framework
(stack default); linter/formatter; CSS approach (Tailwind for React/Next);
package versions (latest stable).

**Never ask** — "what folder structure?" (use the convention), "do you want
TypeScript?" (yes, always for JS), "should I add error handling / tests?" (yes,
always).
