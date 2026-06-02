# Auth & billing implementation guide

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `saas-scaffolder` skill, Phases 2–4.

Concrete code for the auth + Drizzle + Stripe path, plus the security rules that
make it safe. Examples target the kit's opinionated `saas` stack — Next.js App
Router, **Clerk** auth, **Drizzle on Supabase Postgres**, and **Stripe**. (Swap
to `supabase-auth` / `nextauth` via `CUSTOMIZATION.md`; the alternatives live in
the manifest `auth.provider` select.) Pin the exact package versions in
`package.json`.

## Clerk setup (`<ClerkProvider>` + `lib/auth.ts`)

`@clerk/nextjs` is the identity provider; the Supabase `users` row is the
app-owned mirror of the Clerk user, keyed by the Clerk user id. Wrap the root
layout and expose a small server helper that resolves the DB user from the Clerk
session (subscription status is read from the DB, never trusted from the client).

```tsx
// app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en"><body>{children}</body></html>
    </ClerkProvider>
  );
}
```

```ts
// lib/auth.ts — resolve the app's DB user from the Clerk session (server-only)
import { auth } from "@clerk/nextjs/server";
import { db } from "./db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function requireUser() {
  const { userId } = await auth();              // Clerk user id, or null
  if (!userId) return null;
  const [user] = await db.select().from(users).where(eq(users.clerkId, userId));
  return user ?? null;                          // subscription status lives here
}
```

## Drizzle schema (`db/schema.ts`)

```ts
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// The app-owned mirror of the Clerk user. `clerkId` is the join key the Clerk
// webhook (api/webhooks/clerk) syncs on user.created / user.updated.
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

Clerk owns the credential/session tables, so there is no `accounts` / `sessions`
table to model — the `users` row is the only identity record your app stores.

## Clerk webhook — sync Clerk users into Supabase (`app/api/webhooks/clerk/route.ts`)

```ts
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = await req.text();                              // raw body required
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SIGNING_SECRET!);
  let evt: { type: string; data: any };
  try {
    evt = wh.verify(body, {                                   // Svix headers first
      "svix-id": req.headers.get("svix-id")!,
      "svix-timestamp": req.headers.get("svix-timestamp")!,
      "svix-signature": req.headers.get("svix-signature")!,
    }) as typeof evt;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, email_addresses, first_name, image_url } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    // Idempotent upsert keyed by clerk_id — safe to replay.
    await db.insert(users)
      .values({ clerkId: id, email, name: first_name, image: image_url })
      .onConflictDoUpdate({ target: users.clerkId, set: { email, name: first_name, image: image_url } });
  }
  return new Response(null, { status: 200 });
}
```

## Middleware route protection (`middleware.ts`)

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/dashboard(.*)", "/settings(.*)", "/billing(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();   // redirects signed-out users to sign-in
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
```

## Stripe checkout route (`app/api/billing/checkout/route.ts`)

```ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  const user = await requireUser();             // resolves the DB user from Clerk
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { priceId } = await req.json();

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email });
    customerId = customer.id;
    await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, user.id));
  }

  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    subscription_data: { trial_period_days: 14 },
  });
  return NextResponse.json({ url: checkout.url });
}
```

A **customer-portal** route mirrors this with `stripe.billingPortal.sessions.create`.

## Webhook handler — verify + idempotent

```ts
// app/api/webhooks/stripe/route.ts
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const body = await req.text();                       // raw body required
  const sig = req.headers.get("stripe-signature")!;
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.updated") {
    const sub = await stripe.subscriptions.retrieve(/* sub id from event */);
    // Idempotent: a fixed update keyed by stripeSubscriptionId is safe to replay.
    await db.update(users)
      .set({
        stripeSubscriptionId: sub.id,
        stripePriceId: sub.items.data[0].price.id,
        stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
      })
      .where(eq(users.stripeCustomerId, sub.customer as string));
  }
  return new Response(null, { status: 200 });
}
```

**Webhooks to handle:** `checkout.session.completed`,
`customer.subscription.{created,updated,deleted}`, `invoice.paid`,
`invoice.payment_failed` (dunning).

## `.env.example`

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Supabase Postgres — pooled string (port 6543, pgbouncer) for the app runtime,
# the direct string for drizzle-kit migrations. See PITFALLS.md.
DATABASE_URL=postgresql://user:pass@host:6543/postgres?pgbouncer=true&sslmode=require
# Clerk (auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
# Stripe (billing)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...
```

## Security rules (non-negotiable)

- **PCI:** use Stripe Checkout / Elements; card data goes browser → Stripe.
  Your servers only ever hold tokens and customer IDs. Never log card data.
- **JWT/session:** short-lived access (15–60 min); cookies
  `httpOnly; secure; sameSite=strict`; never localStorage; validate `aud`/`exp`.
- **Webhooks:** verify the signature on every event; respond 200 fast; treat
  handlers as idempotent (events are re-delivered).
- **Secrets:** rotate API keys; require 2FA on the Stripe dashboard; keep real
  values out of git (`.env` ignored, `.env.example` placeholders only).
- **Access control:** RBAC (Admin/Editor/Viewer) covers most SaaS; reach for
  ABAC only when access depends on resource ownership or per-tenant context.

## Subscription lifecycle (dunning)

Trial (7–14 days, reminders at −3d/−1d) → active (proration on upgrade, downgrade
at period end) → payment failure (retry → warn → restrict → cancel over ~14 days)
→ churned (downgrade to free, retain data ~90 days) → reactivated. Stripe drives
state transitions; your webhook syncs them to `users.stripeCurrentPeriodEnd`.
