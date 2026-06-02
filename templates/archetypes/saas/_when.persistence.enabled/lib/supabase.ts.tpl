// Supabase client for ${project.name} (db: ${persistence.db}).
//
// Rendered only when persistence.enabled. Auth is handled by ${auth.provider} (Clerk)
// and relational data by Drizzle (lib/db) — this client is for the rest of Supabase:
// Storage, Realtime, and direct PostgREST access when convenient. Uses the public
// anon key on the client and the service-role key only in trusted server contexts.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
);
