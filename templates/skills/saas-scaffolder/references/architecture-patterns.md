# SaaS architecture patterns (App Router)

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `saas-scaffolder` skill.

App-Router structure, server-side gating, rate limiting, and the multi-tenancy
decision — the architectural choices to make before Phase 1.

## App Router layout & route groups

Use **route groups** `(name)` to share a layout without affecting the URL:

```
app/
  (marketing)/      public: /, /pricing      — no auth
  (auth)/           /login, /register         — redirect signed-in users away
  (dashboard)/      /dashboard, /settings, /billing — auth required
  api/              route handlers
```

Each group owns a `layout.tsx`. The `(dashboard)` layout reads the session
server-side and renders the sidebar/header; the `(auth)` layout bounces an
already-authenticated user to `/dashboard`.

## Route protection lives in middleware

Guard protected paths in `middleware.ts` so an unauthenticated request never
renders a protected layout (pattern in `auth-billing-guide.md`). Client-side
checks are UX only — they are not a security boundary.

## Server-side feature gating

Gate features on subscription state read **on the server**, never on a
client-trusted flag:

```ts
// lib/entitlements.ts
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function hasActivePlan(userId: string): Promise<boolean> {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  const end = u?.stripeCurrentPeriodEnd;
  return !!end && end.getTime() + 86_400_000 > Date.now(); // +1 day grace
}
```

Entitlement types: **boolean** (feature on/off), **numeric limit** (e.g. 10
projects), **tiered** (basic vs. advanced). Show an upgrade prompt at the limit
rather than a hard block, and allow a brief grace period for overages.

## Server actions for mutations

Prefer server actions over hand-rolled API routes for form mutations — they keep
validation and the DB write server-side and integrate with progressive
enhancement:

```ts
"use server";
export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  // validate with zod, then db.update(...)
}
```

Wrap async dashboard data in `<Suspense>` boundaries so the shell renders
immediately.

## Rate limiting (auth & webhook routes)

Use Upstash Redis + `@upstash/ratelimit` on login/register and any public
mutation:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const limiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "60 s"),
});

// in the handler:
const { success } = await limiter.limit(ip);
if (!success) return new Response("Too many requests", { status: 429 });
```

## Multi-tenancy: pick early

| Model | Isolation | Cost | Best for |
|---|---|---|---|
| Shared schema (`tenant_id` column) | low | low | early-stage, SMB, 10k+ tenants |
| Schema-per-tenant | medium | medium | mid-market, 100–1,000 tenants |
| DB-per-tenant | high | high | enterprise/regulated, 10–100 tenants |

Default for a new SaaS: **shared schema** with a `tenant_id` (or
`organizationId`) on every tenant-scoped table, and a query helper that always
filters by it. Cross-tenant leakage is the highest-severity bug class — enforce
the filter in one place, not per query.

## Infrastructure by stage

| Stage | Users | Architecture | DB | Hosting |
|---|---|---|---|---|
| MVP | 0–100 | monolith | shared Postgres | PaaS / single host |
| Growth | 100–10k | modular monolith | managed DB + read replicas | autoscaling |
| Scale | 10k–100k | extract hot services | DB per service + cache | k8s / ECS |

Start as a modular monolith; extract services only when team and traffic justify
the operational cost.
