# Auth & billing implementation guide

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `saas-scaffolder` skill, Phases 2–4.

Concrete code for the auth + Drizzle + Stripe path, plus the security rules that
make it safe. Examples target Next.js App Router, NextAuth, Drizzle (Postgres),
and Stripe. Pin the exact package versions in `package.json`.

## NextAuth config (`lib/auth.ts`)

```ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
        subscriptionStatus: (user as { subscriptionStatus?: string }).subscriptionStatus,
      },
    }),
  },
  pages: { signIn: "/login" },
};
```

Extend the session type so TypeScript knows about `id` / `subscriptionStatus`:

```ts
// types/next-auth.d.ts
import "next-auth";
declare module "next-auth" {
  interface Session { user: { id: string; subscriptionStatus?: string } & DefaultSession["user"]; }
}
```

## Drizzle schema (`db/schema.ts`)

```ts
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  stripeCurrentPeriodEnd: timestamp("stripe_current_period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
});
```

Also model `sessions` and `verification_tokens` per the adapter's schema.

## Middleware route protection (`middleware.ts`)

```ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    if (req.nextUrl.pathname.startsWith("/dashboard") && !token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  },
  { callbacks: { authorized: ({ token }) => !!token } },
);

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/billing/:path*"],
};
```

## Stripe checkout route (`app/api/billing/checkout/route.ts`)

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { priceId } = await req.json();
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: session.user.email! });
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
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
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
