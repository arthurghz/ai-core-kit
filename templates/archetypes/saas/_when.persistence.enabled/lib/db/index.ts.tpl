// Database client for ${project.name} (db: ${persistence.db}, orm: ${persistence.orm}).
//
// Rendered only when persistence.enabled (path-segment guard _when.persistence.enabled/).
// Drizzle ORM over the Supabase Postgres connection. Use the SESSION pooler URL
// (DATABASE_URL) for serverless on Vercel. The schema lives in db/schema.ts; this
// module exports the typed `db` handle the rest of the app imports.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const connectionString = process.env.DATABASE_URL as string;

// `prepare: false` is required when going through the Supabase transaction pooler.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
