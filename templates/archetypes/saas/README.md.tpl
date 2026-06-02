# ${project.name}

${project.description}

A SaaS web app on the kit's opinionated stack:

| Layer | Choice |
|---|---|
| Hosting | ${hosting.target} |
| Framework | ${project.framework} (App Router) + React |
| UI | shadcn/ui (design system: install=${design_system.install}) |
| Auth | ${auth.provider} |
#ack:if persistence.enabled
| Data | ${persistence.db} (${persistence.orm}) |
#ack:endif
| Billing | ${billing.provider} |

> Specs lead, code follows. Read `specs/` (PRD, ARCHITECTURE, REQUIREMENTS, PLAN, and
> DESIGN when a design system is installed) before building. The contract gate
> (`.claude/hooks/contract-gate`, mode **${contract_gate.mode}**) traces edits under
> protected paths back to an approved contract.

## Layout

```
app/                      # Next.js App Router
  page.tsx                #   marketing / landing (public)
  layout.tsx              #   root layout (<ClerkProvider>)
  (dashboard)/            #   PROTECTED route group (Clerk-gated)
    dashboard/page.tsx
  api/health/route.ts     #   health probe
  api/billing/checkout    #   Stripe Checkout session
  api/billing/webhook     #   Stripe webhook (signature-verified, public)
middleware.ts             # Clerk middleware (protects /dashboard)
lib/                      # auth, stripe, db client, utils
db/                       # Drizzle schema + migrations (when persistence.enabled)
design-system/            # shadcn theme + skills (when design_system.install)
```

## Getting started

1. `cp .env.example .env.local` and fill in the Clerk / Supabase / Stripe keys.
2. Install deps with your package manager (${project.package_manager}).
3. If persistence is enabled: `npm run db:generate && npm run db:migrate`.
4. `npm run dev` and open http://localhost:3000.
5. For Stripe webhooks in dev: `stripe listen --forward-to localhost:3000/api/billing/webhook`.

## Deploy

Deploy to ${hosting.target}. Set the same environment variables in the project
settings (use the Supabase session pooler `DATABASE_URL` for serverless), and add the
production Stripe webhook endpoint pointing at `/api/billing/webhook`.
