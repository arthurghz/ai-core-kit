---
name: saas-scaffolder
description: >
  Generates a production-shaped subscription-SaaS starter — authentication,
  a database schema, billing/checkout, protected routes, and a working
  dashboard — on the kit's opinionated SaaS stack: Next.js App Router + React +
  TypeScript + Tailwind + shadcn/ui + Clerk auth + Supabase Postgres + Drizzle
  ORM + Stripe, deployed to Vercel, with a phase-by-phase build-and-validate
  checklist. Use when the user wants to start a new SaaS or subscription web app,
  scaffold a Next.js app with auth and payments, "wire up Stripe billing", or
  mentions a SaaS starter / boilerplate that needs login + a paywall. Do NOT use
  this for a generic app from a free-form spec (use spec-to-repo), for a non-SaaS
  site with no billing, for adding billing to an existing app (do that
  incrementally), or for design tokens (use ui-design-system). It scaffolds; it
  does not deploy or take payments live.
license: MIT
---

# saas-scaffolder — subscription-SaaS starter

Generates an opinionated, production-shaped SaaS boilerplate: auth, database,
billing, protected routes, and a dashboard. Default stack (matches the kit's
`saas` archetype + manifest defaults): **Next.js (App Router) + React +
TypeScript + Tailwind + shadcn/ui + Clerk auth + Supabase Postgres + Drizzle ORM
+ Stripe**, deployed to **Vercel**. Each phase ends with an explicit validation
step — do not advance until it passes. Swap any edge (auth/db/payments/hosting)
via `CUSTOMIZATION.md`; the alternatives live in the manifest selects.

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
Auth:        clerk | supabase-auth | nextauth     (default clerk)
Database:    supabase | neon | planetscale        (default supabase, Postgres)
ORM:         drizzle | prisma                      (default drizzle)
Payments:    stripe | lemonsqueezy | none          (default stripe)
Hosting:     vercel | netlify | fly | aws | gcp    (default vercel)
Features:    <comma-separated list>
```

## Target file tree

```
my-saas/
├── app/
│   ├── (auth)/{sign-in,sign-up}/[[...rest]]/page.tsx · layout.tsx   (Clerk)
│   ├── (dashboard)/{dashboard,settings,billing}/page.tsx · layout.tsx
│   ├── (marketing)/{page,pricing}/page.tsx · layout.tsx
│   ├── api/webhooks/stripe/route.ts
│   ├── api/webhooks/clerk/route.ts            (user sync → Supabase)
│   ├── api/billing/{checkout,portal}/route.ts
│   └── layout.tsx                              (wraps <ClerkProvider>)
├── components/{ui,auth,dashboard,marketing,billing}/*
├── lib/{auth,db,supabase,stripe,validations,utils}.ts
├── db/schema.ts · supabase/migrations/         (Drizzle schema on Supabase Postgres)
├── hooks/{use-subscription,use-user}.ts
├── middleware.ts                               (clerkMiddleware protecting /dashboard)
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

### Phase 2 — Database (Supabase Postgres + Drizzle)
Drizzle ORM pointed at the Supabase Postgres connection string; schema
(`users` mirroring the Clerk user id, `subscriptions`, plus product tables);
initial migration in `supabase/migrations/` applied; a DB-client singleton in
`lib/db.ts` and the Supabase client in `lib/supabase.ts`.
**Validate:** `db.select().from(users)` returns `[]` without throwing.
*If it fails:* use the Supabase **pooled** connection string (port 6543,
`?pgbouncer=true&sslmode=require`) for the app and the direct string for
`drizzle-kit`; confirm the migration was applied (`drizzle-kit push` in dev,
`migrate` in prod).

### Phase 3 — Authentication (Clerk)
`@clerk/nextjs` installed; `<ClerkProvider>` wrapping the root layout;
`clerkMiddleware()` in `middleware.ts` protecting `/dashboard`; hosted
`<SignIn>`/`<SignUp>` catch-all routes; a Clerk webhook (`api/webhooks/clerk`)
that syncs `user.created`/`user.updated` into the Supabase `users` row; the
active subscription status read from the DB, not from the Clerk session.
**Validate:** sign in via Clerk, confirm a `users` row is synced with the Clerk
user id; hit `/dashboard` signed-out and get redirected to `/sign-in`.
*If the webhook 400s:* verify the `CLERK_WEBHOOK_SIGNING_SECRET` and that the
Svix signature headers are checked before parsing the body.

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
- **`PITFALLS.md`** — Clerk/Stripe webhook-secret mismatch, Edge runtime vs.
  Drizzle (use the Node runtime for DB routes), Supabase pooled-vs-direct
  connection strings, syncing the Clerk user id into the DB, dev-vs-prod
  migration strategy.

## Tooling

- `scripts/project_bootstrapper.py` — `<config.json> [--output-dir DIR] [--format text|json] [--dry-run]`. Stdlib only; emits the base tree, manifest, README, `.env.example`, `.gitignore`, `docker-compose.yml`, and `Dockerfile` for `nextjs`, `express`, or `fastapi`. The auth/billing code is added per the references.

## Reference files

| File | Content |
|---|---|
| `references/architecture-patterns.md` | App-Router layout, route groups, server actions, rate limiting, feature gating |
| `references/auth-billing-guide.md` | Clerk setup + webhook sync, Drizzle schema on Supabase Postgres, Stripe checkout/portal/webhook code |
| `references/tech-stack-comparison.md` | Auth, DB, payments, and ORM options with trade-offs |

## Cross-references

- `spec-to-repo` — generic spec-to-repo when the project is not a subscription SaaS.
- `ui-design-system` — design tokens for the marketing + dashboard UI.
