# Stack templates & example file trees

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `spec-to-repo` skill, Phase 2 & 3.

Per-stack file structure, manifest, and run/test commands, plus three full
example outputs.

## Next.js (TypeScript + Tailwind)

**When:** web apps, dashboards, SaaS, dynamic landing pages.
**Manifest:** `package.json` — scripts `dev|build|start|lint|test`.
**Core deps:** `next`, `react`, `react-dom`, `tailwindcss`, `postcss`, `autoprefixer`.
**Auth:** `next-auth` (default) or `clerk`. **DB:** `prisma` + `@prisma/client`.
**Test:** `jest` + `@testing-library/react`.

```
src/app/layout.tsx        root layout + providers
src/app/page.tsx          homepage
src/app/api/*/route.ts    API routes
src/components/*.tsx       shared components
src/lib/*.ts              utilities, DB client
prisma/schema.prisma      schema (if DB)
```
Config: `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `postcss.config.mjs`.

## FastAPI (Python)

**When:** REST APIs, backends, microservices.
**Manifest:** `requirements.txt` — `fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `pytest`, `httpx`.
**Run:** `uvicorn main:app --reload` · **Test:** `pytest`.

```
main.py        app, CORS, lifespan
models.py      SQLAlchemy models
schemas.py     Pydantic schemas
database.py    engine + session factory
routers/*.py   route modules
tests/test_*.py
```

## Express (TypeScript)

**When:** Node APIs, middleware-heavy or real-time backends.
**Manifest:** `package.json` — `dev: tsx watch`, `build: tsc`, `start: node dist`.
**Deps:** `express`, `cors`, `dotenv`; dev `typescript`, `tsx`, `@types/*`, `jest`, `ts-jest`.

```
src/index.ts        app + middleware + listen
src/routes/*.ts     handlers
src/middleware/*.ts  auth, validation, errors
src/models/*.ts     data models / entities
tests/*.test.ts
```

## Go (net/http or Gin)

**When:** high-performance APIs, CLI tools, systems work. **Manifest:** `go.mod`.
**Run:** `go run .` · **Test:** `go test ./...` · **Build:** `go build -o app .`.

```
# API                       # CLI
main.go     router setup    main.go      flag parsing
handlers/   HTTP handlers   cmd/         subcommands
models/     structs         internal/    business logic
middleware/ auth, logging   *_test.go    tests
db/         connection
*_test.go   table tests
```

## Rust (Axum or Actix-web)

**When:** high-performance, safety-critical services. **Manifest:** `Cargo.toml`.
**Run:** `cargo run` · **Test:** `cargo test`.

```
src/main.rs       server setup
src/routes/*.rs   handlers
src/models/*.rs   structs + serde
src/db.rs         pool
src/error.rs      error types
tests/*.rs        integration tests
```

## Flutter (Dart) · Rails (Ruby) · Django (Python)

| Stack | Manifest | Run | Test | Layout |
|---|---|---|---|---|
| Flutter | `pubspec.yaml` | `flutter run` | `flutter test` | `lib/{main,screens,widgets,models,services,providers}.dart`, `test/` |
| Rails | `Gemfile` | `bin/rails server` | `bin/rspec` | standard `app/ config/ db/ spec/` |
| Django | `requirements.txt` (`django`, `djangorestframework`, `pytest-django`) | `python manage.py runserver` | `pytest` | `config/{settings,urls}.py`, `apps/<n>/{models,views,serializers,urls}.py` |

## CI template (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup [runtime]
        uses: actions/setup-[runtime]@v5
        with: { [runtime]-version: '[version]' }
      - run: [install]
      - run: [lint]
      - run: [test]
      - run: [build]
```

## `.gitignore` essentials

| Stack | Must ignore |
|---|---|
| Node/Next.js | `node_modules/`, `.next/`, `.env`, `dist/`, `.turbo/` |
| Python | `__pycache__/`, `*.pyc`, `.venv/`, `.env`, `*.egg-info/` |
| Go | binary, `.env`, `vendor/` (if uncommitted) |
| Rust | `target/`, `.env` |
| Flutter | `.dart_tool/`, `build/`, `.env`, `*.iml` |
| Rails | `log/`, `tmp/`, `.env`, `storage/`, `node_modules/` |

All stacks also ignore `.env`, `.DS_Store`, `*.log`, `.idea/`, `.vscode/`.

---

## Example outputs

### A — Task management API (FastAPI + SQLite, API-key auth)

> "Tasks have title, description, status (todo/in-progress/done), due date. CRUD. FastAPI + SQLite. API-key auth."

```
task-api/
├── README.md
├── .env.example              # API_KEY, DATABASE_URL
├── .gitignore
├── .github/workflows/ci.yml
├── requirements.txt          # fastapi, uvicorn, sqlalchemy, pytest
├── main.py                   # app, CORS, lifespan
├── models.py                 # SQLAlchemy Task
├── schemas.py                # Pydantic request/response
├── database.py               # SQLite engine + session
├── auth.py                   # API-key middleware
├── routers/tasks.py          # CRUD endpoints
└── tests/test_tasks.py
```

### B — Recipe sharing (Next.js + Tailwind + PostgreSQL)

> "Users sign up, post recipes with ingredients and steps, browse, save favorites. Next.js + Tailwind, PostgreSQL."

```
recipe-share/
├── README.md
├── .env.example              # DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
├── .gitignore
├── .github/workflows/ci.yml
├── package.json              # next, react, tailwindcss, prisma, next-auth
├── prisma/schema.prisma      # User, Recipe, Ingredient, Favorite
├── src/app/{layout,page}.tsx
├── src/app/recipes/{page,[id]/page,new/page}.tsx
├── src/app/api/auth/[...nextauth]/route.ts
├── src/app/api/recipes/route.ts
├── src/components/{RecipeCard,RecipeForm,Navbar}.tsx
├── src/lib/{prisma,auth}.ts
└── tests/recipes.test.ts
```

### C — Expense tracker CLI (Python + SQLite)

> "Python CLI: add, list, summary, export-csv. Local SQLite. No external API."

```
expense-tracker/
├── README.md
├── .gitignore
├── .github/workflows/ci.yml
├── pyproject.toml
├── src/expense_tracker/{__init__,cli,database,models,formatters}.py
└── tests/test_cli.py
```
