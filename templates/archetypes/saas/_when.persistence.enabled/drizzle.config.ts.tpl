// drizzle-kit config for ${project.name} (db: ${persistence.db}, orm: ${persistence.orm}).
//
// Rendered only when persistence.enabled. Drives `drizzle-kit generate` / `migrate`.
// Migrations are written to db/migrations/ (the contract_gate exempts
// db/migrations/** so generated SQL is not gated). DATABASE_URL points at the
// Supabase Postgres connection.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
});
