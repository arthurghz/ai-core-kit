---
name: spec-to-repo
description: >
  Turns a natural-language project specification into a complete, runnable
  starter repository — parsing the spec, inferring or honoring the tech stack,
  designing the file tree and schema, generating real (non-stub) code, and
  validating the result. Stack-agnostic (Next.js, FastAPI, Express, Go, Rust,
  Flutter, and more). Use when the user says "build me an app", "create a
  project from this spec", "scaffold a new repo", "bootstrap a project", "turn
  this idea/PRD into code", or hands over requirements and expects a working
  codebase. Do NOT use this for a subscription SaaS with auth + Stripe billing
  specifically (use saas-scaffolder), for adding a feature to an existing repo
  (use the project's normal implement workflow), or for generating design tokens
  (use ui-design-system).
license: MIT
---

# spec-to-repo — natural-language spec to a runnable starter

Turn a text description of an app into a complete, runnable repository. This is a
**spec interpreter**, not a template filler: it reads intent and generates real,
working code for whatever stack fits.

## When to use

- The user describes an app in prose and wants code.
- The user has a PRD, requirements doc, or feature list and needs a codebase.
- "Build me an app that…", "scaffold this", "bootstrap a project".

## When NOT to use

- A subscription SaaS specifically wanting auth + Stripe → use `saas-scaffolder`.
- Adding a feature to an existing repo → use the project's implement workflow.
- Generating design tokens → use `ui-design-system`.

## Phase 1 — Parse & interpret

Read the spec and extract these fields silently:

| Field | Source | Required |
|---|---|---|
| App name | explicit, or inferred from the description | yes |
| Description | first sentence of the spec | yes |
| Features | bullets / sentences describing behavior | yes |
| Tech stack | explicit ("use FastAPI") or inferred | yes |
| Auth | "login", "users", "accounts", "roles" | if mentioned |
| Database | "store", "save", "persist", "records", "schema" | if mentioned |
| API surface | "endpoint", "API", "REST", "GraphQL" | if mentioned |
| Deploy target | "Vercel", "Docker", "AWS", "Railway" | if mentioned |

**Stack inference** (only when the user does not specify):

| Signal | Inferred stack |
|---|---|
| "web app", "dashboard", "SaaS" | Next.js + TypeScript |
| "API", "backend", "microservice" | FastAPI (Python) or Express (Node) |
| "mobile app" | Flutter or React Native |
| "CLI tool" | Go or Python |
| "data pipeline" | Python |
| "high performance", "systems" | Rust or Go |

Then reflect a structured interpretation back to the user (app, stack, features,
database, auth, deploy) and ask "does this match?". Flag ambiguities and ask
**at most 3** clarifying questions. If the user says "just build it", proceed
with best-guess defaults. The full parsing rubric is in
`references/spec-parsing-guide.md`.

## Phase 2 — Architecture

Design before writing a single file:

1. **Select a template** — match the stack to `references/stack-templates.md`.
2. **Define the file tree** — list every file to be created.
3. **Map features to files** — each feature gets at least one file/component.
4. **Design the schema** — tables/collections with fields and types, if any.
5. **Identify dependencies** — every package, with version constraints.
6. **Plan API routes** — method, path, request/response shape, if any.

Present the file tree to the user before generating. Reference file-tree
examples for three representative stacks (FastAPI API, Next.js web app, Python
CLI) are in `references/stack-templates.md`.

## Phase 3 — Generate

Write every file. Non-negotiable rules:

- **Real code, not stubs.** Every function has a working implementation — no
  `// TODO: implement` or bare `pass`.
- **Syntactically valid.** Every file parses in its language.
- **Imports match the manifest.** Every import maps to a declared dependency
  (`package.json` / `requirements.txt` / `go.mod` / `Cargo.toml` / …).
- **Typed.** TypeScript types, Python type hints, Go typed structs.
- **`.env.example`** lists every env var the code reads, each commented.
- **README.md** — description, prerequisites, setup (clone → install → configure
  env → run), and the available scripts/commands.
- **CI** — `.github/workflows/ci.yml` with install, lint (if a linter is in
  deps), test, build.
- **`.gitignore`** — stack-appropriate (`node_modules`, `__pycache__`, `.env`,
  build artifacts).

**Generation order:** manifest → config (`.env.example`, `.gitignore`, CI) →
schema/migrations → core logic → API routes → UI (if any) → tests → README.

## Phase 4 — Validate

Run the validation script against the generated directory, then walk the
checklist:

```bash
python3 scripts/validate_project.py /path/to/generated-project
python3 scripts/validate_project.py /path/to/generated-project --format json
```

- [ ] Every imported package exists in the manifest.
- [ ] Every file referenced by an import exists in the tree.
- [ ] `.env.example` lists every env var used in code.
- [ ] `.gitignore` covers build artifacts and secrets.
- [ ] README setup steps actually work.
- [ ] No hardcoded secrets, API keys, or passwords.
- [ ] At least one test file exists.
- [ ] The build/start command is documented and would run.

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Placeholder code (`// TODO`, bare `pass`, empty bodies) | Implement a working (if simplified) version of every function. |
| Stack override — picking Next.js when the user said Flask | Honor explicit tech choices; only infer when unspecified. |
| Missing `.gitignore` — committing `node_modules`/`.env` | Generate it as one of the first files. |
| Phantom imports — importing packages not in the manifest | Cross-check every import before finishing. |
| Over-engineering the MVP — Redis, rate limiting, WebSockets in a v1 | Build the minimum that works; let the user iterate. |
| Missing env vars — code reads `process.env.X`, `.env.example` omits it | Every env var used appears in `.env.example` with a comment. |
| No tests | At least one smoke test per endpoint or core function. |
| Hallucinated APIs — calling library methods that do not exist | Stick to stable, well-documented APIs; prefer the simplest approach. |

## Progressive enhancement

For complex specs, generate in stages and check in with the user after each:
**MVP** (core feature, end-to-end) → **Auth** → **Polish** (error handling,
validation, loading states) → **Deploy** (Docker, CI, deploy config). After the
MVP: "Core works. Add auth / polish / deploy next, or iterate on this?"

## Tooling

- `scripts/validate_project.py` — `<project_dir> [--format text|json] [--strict]`. Stdlib only; checks README, `.gitignore`, manifest, `.env.example` vs. env usage, no committed `.env`, a test file, and absence of placeholder code.

## Reference files

| File | Content |
|---|---|
| `references/spec-parsing-guide.md` | Field-extraction rubric, inference rules, clarifying-question policy |
| `references/stack-templates.md` | Per-stack file trees, manifests, and example outputs |

## Cross-references

- `saas-scaffolder` — subscription SaaS (Next.js + auth + Stripe), more opinionated.
- `ui-design-system` — design tokens for the generated front-end.
