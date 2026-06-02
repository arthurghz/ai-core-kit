---
name: saas-scaffolder
description: >
  Generates a production-shaped subscription-SaaS starter — authentication,
  a database schema, billing/checkout, protected routes, and a working
  dashboard — on a Next.js App Router + TypeScript + Tailwind + Drizzle + Stripe
  stack, with a phase-by-phase build-and-validate checklist. Use when the user
  wants to start a new SaaS or subscription web app, scaffold a Next.js app with
  auth and payments, "wire up Stripe billing", or mentions a SaaS starter /
  boilerplate that needs login + a paywall. Do NOT use this for a generic app
  from a free-form spec (use spec-to-repo), for a non-SaaS site with no billing,
  for adding billing to an existing app (do that incrementally), or for design
  tokens (use ui-design-system). It scaffolds; it does not deploy or take
  payments live.
license: MIT
---

# saas-scaffolder — subscription-SaaS starter

Generates an opinionated, production-shaped SaaS boilerplate: auth, database,
billing, protected routes, and a dashboard. Default stack: **Next.js (App
Router) + TypeScript + Tailwind + shadcn/ui + Drizzle ORM + Stripe**. Each phase
ends with an explicit validation step — do not advance until it passes.

## When to use

- "Start a new SaaS / subscription web app."
- "Scaffold a Next.js app with auth and Stripe billing."
- "I need a SaaS boilerplate with a login and a paywall."

## When NOT to use

- A generic app from a free-form spec → `spec-to-repo`.
- A site with no subscription/billing → `spec-to-repo` or a plain template.
- Adding billing to an *existing* app → do it incrementally, not via a scaffold.
- Design tokens → `ui-design-system`.

## Input

Collect (ask only for what is missing; infer sensible defaults):

```
Product:     <name>
Description: <1–3 sentences>
Auth:        nextauth | clerk | supabase        (default nextauth)
Database:    neon | supabase | planetscale      (default neon, Postgres)
Payments:    stripe | lemonsqueezy | none        (default stripe)
Features:    <comma-separated list>
```

## Target file tree

```
my-saas/
├── app/
│   ├── (auth)/{login,register}/page.tsx · layout.tsx
│   ├── (dashboard)/{dashboard,settings,billing}/page.tsx · layout.tsx
│   ├── (marketing)/{page,pricing}/page.tsx · layout.tsx
│   ├── api/auth/[...nextauth]/route.ts
│   ├── api/webhooks/stripe/route.ts
│   ├── api/billing/{checkout,portal}/route.ts
│   └── layout.tsx
├── components/{ui,auth,dashboard,marketing,billing}/*
├── lib/{auth,db,stripe,validations,utils}.ts
├── db/schema.ts · db/migrations/
├── hooks/{use-subscription,use-user}.ts
├── middleware.ts
├── .env.example · drizzle.config.ts · next.config.ts
```

## Phased build (validate at each gate)

The phases are ordered by dependency. **Run the validation before the next
phase.** Code patterns for every phase are in `references/auth-billing-guide.md`
and `references/architecture-patterns.md`.

### Phase 1 — Foundation
Next.js + TypeScript (App Router), Tailwind with theme tokens, shadcn/ui,
ESLint + Prettier, `.env.example` with every variable.
**Validate:** `npm run build` — no TypeScript or lint errors.

### Phase 2 — Database
Drizzle ORM configured; schema (`users`, `accounts`, `sessions`,
`verification_tokens`); initial migration applied; a DB-client singleton in
`lib/db.ts`.
**Validate:** `db.select().from(users)` returns `[]` without throwing.
*If it fails:* confirm `DATABASE_URL` includes `?sslmode=require` for Neon/Supabase
and that the migration was applied (`drizzle-kit push` in dev, `migrate` in prod).

### Phase 3 — Authentication
Auth provider installed; OAuth (Google/GitHub) configured; auth route; a session
callback that adds `id` and `subscriptionStatus`; middleware protecting
`/dashboard`; login/register pages with error states.
**Validate:** sign in via OAuth, confirm the session carries `id` +
`subscriptionStatus`; hit `/dashboard` signed-out and get redirected to `/login`.
*If sign-out loops in prod:* set a stable `NEXTAUTH_SECRET` across deploys.

### Phase 4 — Payments
Stripe client (typed singleton); checkout-session route; customer-portal route;
webhook handler with **signature verification**; webhook updates subscription
status **idempotently**.
**Validate:** complete a test checkout with card `4242 4242 4242 4242`; confirm
`stripeSubscriptionId` is written; replay `checkout.session.completed` and confirm
no duplicate writes. *Locally:* `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
— never hardcode the webhook secret.

### Phase 5 — UI
Landing page (hero, features, pricing); dashboard layout (sidebar + responsive
header); billing page (current plan + upgrade); settings page (profile form with
success states).
**Validate:** `npm run build`; walk every route — no broken layouts, missing
session data, or hydration errors.

## Security defaults (non-negotiable)

- **Never** commit real secrets; `.env` is git-ignored, `.env.example` holds
  placeholders only.
- Verify the Stripe webhook signature on every event; treat handlers as
  idempotent (events can be re-delivered).
- Gate features server-side on subscription state (`stripeCurrentPeriodEnd`),
  never on a client-trusted flag.
- Protect routes in `middleware.ts`, not only in the client.
- Rate-limit auth routes (see `references/architecture-patterns.md`).

## Companion files to generate alongside the scaffold

- **`CUSTOMIZATION.md`** — swapping auth providers, databases, ORMs, payment
  providers, UI themes, and billing models (per-seat / flat / usage-based).
- **`PITFALLS.md`** — missing `NEXTAUTH_SECRET`, webhook-secret mismatch, Edge
  runtime vs. Drizzle, unextended session types, dev-vs-prod migration strategy.

## Tooling

- `scripts/project_bootstrapper.py` — `<config.json> [--output-dir DIR] [--format text|json] [--dry-run]`. Stdlib only; emits the base tree, manifest, README, `.env.example`, `.gitignore`, `docker-compose.yml`, and `Dockerfile` for `nextjs`, `express`, or `fastapi`. The auth/billing code is added per the references.

## Reference files

| File | Content |
|---|---|
| `references/architecture-patterns.md` | App-Router layout, route groups, server actions, rate limiting, feature gating |
| `references/auth-billing-guide.md` | NextAuth config, Drizzle schema, Stripe checkout/portal/webhook code |
| `references/tech-stack-comparison.md` | Auth, DB, payments, and ORM options with trade-offs |

## Cross-references

- `spec-to-repo` — generic spec-to-repo when the project is not a subscription SaaS.
- `ui-design-system` — design tokens for the marketing + dashboard UI.
