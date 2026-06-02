// Stripe Checkout for ${project.name} (billing provider: ${billing.provider}).
//
// ALWAYS PRESENT in this archetype. POST /api/billing/checkout creates a Checkout
// Session for the signed-in user and returns its URL. Protected: it reads the Clerk
// session, so an unauthenticated caller is rejected. Set STRIPE_SECRET_KEY,
// STRIPE_PRICE_ID, and NEXT_PUBLIC_APP_URL in the environment (see env.example).
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    client_reference_id: userId,
    success_url: appUrl + "/dashboard?checkout=success",
    cancel_url: appUrl + "/dashboard?checkout=cancelled",
  });

  return NextResponse.json({ url: session.url });
}
