# Environment for ${project.name} — copy to .env.local and fill in.
# Stack: ${hosting.target} + Next.js + ${auth.provider} + ${billing.provider}.
# NEVER commit real secrets. .env.local is gitignored; set production values in your
# ${hosting.target} project settings.

# --- App ---------------------------------------------------------------------
NEXT_PUBLIC_APP_URL=http://localhost:3000

# --- Auth (${auth.provider}) -------------------------------------------------
# From the Clerk dashboard (API Keys). The publishable key is safe in the client.
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
# Optional: where Clerk redirects after sign-in / sign-up.
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

#ack:if persistence.enabled
# --- Data (${persistence.db} / ${persistence.orm}) ---------------------------
# Supabase project URL + anon key (client) and the Postgres connection string for
# Drizzle (server). Use the SESSION POOLER url for serverless (Vercel).
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
DATABASE_URL=postgresql://postgres.xxxx:password@aws-region.pooler.supabase.com:5432/postgres
#ack:endif

# --- Billing (${billing.provider}) -------------------------------------------
# From the Stripe dashboard. STRIPE_WEBHOOK_SECRET comes from `stripe listen` (dev)
# or the webhook endpoint config (prod). STRIPE_PRICE_ID is the subscription price.
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID=price_xxx
