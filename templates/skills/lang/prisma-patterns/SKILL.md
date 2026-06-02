---
name: prisma-patterns
description: Prisma ORM patterns and non-obvious traps for this project — schema/ID strategy, select vs include, transactions, cursor pagination, the PrismaClient singleton, and traps like updateMany returning a count not records, the 5s interactive-transaction timeout, and serverless pool exhaustion. Use when the manifest sets persistence.orm == prisma. TRIGGER when editing schema.prisma or Prisma queries/migrations. SKIP for raw SQL/index tuning (use postgres-patterns) or a different ORM.
license: MIT
---

# Prisma Patterns

Production patterns and traps for Prisma ORM (5.x / 6.x) in TypeScript backends.
Active when this project's manifest declares `persistence.orm: prisma`. Pairs
with `postgres-patterns` (or the underlying engine pack) for the SQL/index layer.

```bash
npx prisma --version   # confirm before applying version-specific guidance
```

## When to use

- Designing/modifying `schema.prisma` models and relations.
- Writing queries, transactions, or pagination.
- Any `updateMany`/`deleteMany`/bulk operation, or serverless deployment.

## When NOT to use

- Index strategy, `EXPLAIN`, locking → `postgres-patterns`.
- A non-Prisma data layer → that ORM's pack.

## Schema & IDs

```prisma
model User {
  id        String    @id @default(cuid())   // URL-safe, sortable, no collisions
  email     String    @unique                // @unique already indexes — no @@index
  role      Role      @default(USER)
  posts     Post[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  @@index([deletedAt, createdAt])             // soft-delete + sort
}
```

- `cuid()` default; `uuid()` only for cross-system interop; `autoincrement()`
  only for internal tables (it leaks row counts).
- `@@index` on every FK and every `WHERE`/`ORDER BY` column.
- Declare `deletedAt DateTime?` upfront if soft delete is foreseeable.
- `@updatedAt` is set on `update`/`upsert` only — NOT on bulk writes (see traps).

## select vs include

- `select`: explicit allowlist — use on hot paths / wide tables to avoid
  over-fetch.
- `include`: scalars + named relations — use when you need most fields.
- **Never return raw Prisma entities from an API** — map to a response DTO so
  you don't leak `passwordHash`, `deletedAt`, internal columns.

```ts
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
return { id: user.id, name: user.name, email: user.email };   // explicit DTO
```

## Transactions

| Situation | Form |
|---|---|
| Independent ops | array `$transaction([...])` (one round trip) |
| Later step needs earlier result | interactive `$transaction(async (tx) => …)` |
| Involves email/HTTP/external calls | **outside** any transaction |

Inside the interactive form use the `tx` client only — never the outer
`prisma`.

## PrismaClient singleton

Each instance opens its own pool. Instantiate once; guard against hot-reload
duplicates:

```ts
// lib/prisma.ts
import { PrismaClient } from "@prisma/client";
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
```

## Cursor pagination

```ts
async function getPosts(cursor?: string, limit = 20) {
  const items = await prisma.post.findMany({
    where: { published: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], // unique secondary sort = stable
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
  const hasNext = items.length > limit;
  if (hasNext) items.pop();
  return { items, nextCursor: hasNext ? items.at(-1)!.id : null };
}
```

Fetch `limit + 1` and pop to detect `hasNextPage` with no extra count query.
Offset pagination only for admin "jump to page N" tables.

## Error handling

```ts
import { Prisma } from "@prisma/client";
try {
  await prisma.user.create({ data: { email } });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") throw new ConflictError("email already exists"); // unique
    if (e.code === "P2025") throw new NotFoundError("record not found");
    if (e.code === "P2003") throw new BadRequestError("bad reference");       // FK
  }
  throw e;
}
```

Translate at the service boundary; never surface raw Prisma messages to clients.

## Traps (these bite in production)

- **`updateMany`/`deleteMany` return `{ count: n }`, not rows.** To get affected
  records: select ids → `updateMany` by id → `findMany` those ids. `@updatedAt`
  is also skipped on these bulk writes — set the timestamp explicitly if needed.
- **Interactive `$transaction` times out at ~5s** ("Transaction already
  closed"). Do external calls (email, HTTP) outside the transaction.
- **`prisma migrate dev` can reset the database** on drift — never run it
  against production; use `prisma migrate deploy` there.
- **Serverless pool exhaustion** — embed params in the URL:
  `DATABASE_URL="postgresql://…/db?connection_limit=1&pool_timeout=20"` (or
  `?pgbouncer=true&connection_limit=1` behind a pooler).
- **N+1** — relation loads inside a loop. Use `include`/`select` to fetch in one
  query (benchmark `relationJoins` row-explosion on large 1:N).

## Soft delete

Filter explicitly (`where: { deletedAt: null }`); don't hide it in middleware —
implicit filtering is hard to debug.

## Anti-patterns

- Returning raw entities from APIs (field leakage).
- Treating `updateMany` result as records.
- External I/O inside an interactive transaction.
- One `PrismaClient` per request (pool exhaustion).
- Relying on middleware for soft-delete filtering.

---

*Re-authored for ai-core-kit from the ECC `prisma-patterns` skill
(Copyright (c) 2026 Affaan Mustafa, MIT). Adapted to kit conventions; relicensed
notice retained under MIT.*
