# Tech-stack comparison

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `saas-scaffolder` skill.

Options and trade-offs for swapping any layer of the default stack (Next.js +
TypeScript + Tailwind + Drizzle + Stripe). The default is chosen for ecosystem
size and time-to-PMF; deviate when a column below matters more for the product.

## Frontend

| | Next.js | Remix (React Router v7) | SvelteKit |
|---|---|---|---|
| Ecosystem | largest | medium | growing |
| Learning curve | medium | medium | low |
| Performance | good | good | excellent (no VDOM) |
| Bundle size | medium | small | smallest |
| Hiring pool | large | small | small |
| Deploy flexibility | medium (Vercel-leaning) | high | high |

**Default: Next.js** — biggest ecosystem, RSC, shadcn/ui, trivial Vercel deploy.
Pick **SvelteKit** when bundle size / DX is the priority; **Remix** for
web-standards, data-heavy apps.

## Backend (when you split the API out of Next.js)

| | Node (NestJS/Fastify) | Python (FastAPI/Django) | Go (Gin/Echo) |
|---|---|---|---|
| Performance | good | moderate | excellent |
| Full-stack synergy | excellent (shared TS) | none | none |
| Data/ML integration | medium | excellent | low |
| Deploy simplicity | medium | medium | high (single binary) |

**Default: keep it in Next.js** (route handlers + server actions) until you
need a separate service. Then **NestJS** for TS shops, **FastAPI** for
data/ML-heavy products, **Go** for high-throughput APIs.

## Database

| | PostgreSQL | MySQL |
|---|---|---|
| Feature richness | excellent (JSON, FTS, pgvector) | good |
| Horizontal scale | moderate (Citus/partitioning) | good (PlanetScale) |
| Learning curve | medium | low |
| Default? | **yes** | situational |

**Default: PostgreSQL** via a managed host — **Neon** (serverless, branching),
**Supabase** (Postgres + auth + storage), or **PlanetScale** (MySQL, branching).
All work with Drizzle; set `?sslmode=require` in the connection string.

## ORM

- **Drizzle** (default) — typed, lightweight, SQL-first, great migrations
  (`drizzle-kit`). Edge-friendly with the HTTP driver.
- **Prisma** — richer client/tooling, larger runtime; good when you want the
  studio and a broad ecosystem.

## Auth & payments

- **Auth:** NextAuth (default, self-hosted, free), **Clerk** (managed, fastest
  UI), **Supabase Auth** (if already on Supabase).
- **Payments:** **Stripe** (default; Checkout/Elements keep you in PCI SAQ-A),
  **Lemon Squeezy** (merchant-of-record — handles sales tax/VAT for you).

## Caching / sessions / rate limiting

- **Redis** (default) — rich structures, pub/sub, used for cache, sessions,
  queues, rate limiting. **Upstash** gives serverless Redis over HTTP (works on
  Edge).
- **Memcached** — pure key-value cache only; reach for it solely when memory
  efficiency for simple lookups dominates.

## Reference stacks by product type

| Product | Frontend | Backend | DB | Auth | Payments |
|---|---|---|---|---|---|
| B2B SaaS (default) | Next.js | in-app or NestJS | Postgres + Redis | NextAuth/Clerk | Stripe |
| Dev tool / API | Next.js or SvelteKit | Go or Fastify | Postgres + Redis | JWT + API keys | Stripe |
| Data / analytics | Next.js | FastAPI | Postgres (+ ClickHouse) | NextAuth | Stripe |
| Real-time / collab | Next.js or SvelteKit | Fastify + WS | Postgres + Redis pub/sub | NextAuth | Stripe |
