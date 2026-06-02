// Stripe webhook for ${project.name} (billing provider: ${billing.provider}).
//
// ALWAYS PRESENT in this archetype. POST /api/billing/webhook. PUBLIC — it is NOT
// behind Clerk auth because Stripe calls it server-to-server; instead it is verified
// by the Stripe signature header against STRIPE_WEBHOOK_SECRET. Reads the RAW body
// (required for signature verification — do not parse it first). Set
// STRIPE_WEBHOOK_SECRET in the environment (see env.example).
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string,
    );
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      // TODO(product): reconcile subscription state into your db (lib/db).
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
