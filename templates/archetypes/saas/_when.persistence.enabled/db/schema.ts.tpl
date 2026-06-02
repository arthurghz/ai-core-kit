// Drizzle schema for ${project.name} (db: ${persistence.db}, orm: ${persistence.orm}).
//
// Rendered only when persistence.enabled. This is an EXAMPLE schema: one table that
// ties an application record to a Clerk user id (auth: ${auth.provider}). Model your
// real domain from specs/DOMAIN.md. db/** is a gate-protected, contract-scoped path:
// schema changes go through a contract. Generate + run migrations with drizzle-kit
// (see drizzle.config.ts).
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  // The Clerk user id (auth provider: ${auth.provider}). One profile per user.
  userId: text("user_id").notNull().unique(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
