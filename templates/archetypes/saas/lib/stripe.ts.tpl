// Stripe client for ${project.name} (billing provider: ${billing.provider}).
//
// ALWAYS PRESENT in this archetype. A single shared Stripe instance, constructed
// from STRIPE_SECRET_KEY. Imported by the checkout + webhook routes. Pin the API
// version explicitly so behavior is stable across Stripe SDK upgrades.
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-05-28.basil",
  typescript: true,
});
