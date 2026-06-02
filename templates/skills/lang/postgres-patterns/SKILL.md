---
name: postgres-patterns
description: PostgreSQL patterns for this project — index selection, schema/data-type choices, query optimization, pagination, locking, and security defaults. Use when the manifest sets persistence.db == postgres and you are writing SQL, designing schema, or troubleshooting slow queries. TRIGGER when editing migrations or .sql, adding indexes, or diagnosing a slow query/lock. SKIP for ORM-model authoring (use prisma-patterns / sqlalchemy-patterns) or non-Postgres engines.
license: MIT
---

# PostgreSQL Patterns

Practical PostgreSQL for correctness and performance. Active when this project's
manifest declares `persistence.db: postgres`.

## When to use

- Writing SQL queries or hand-written migrations.
- Designing schema, choosing data types, or planning indexes.
- Diagnosing slow queries, locks, or bloat.

## When NOT to use

- ORM model definitions → `prisma-patterns` / `sqlalchemy-patterns` (then come
  back here for the index/SQL layer).
- A different engine (`mysql`, `sqlite`, `mongodb`) → that engine's pack.

## Data types

| Use case | Use | Avoid |
|---|---|---|
| Surrogate IDs | `bigint generated always as identity` | `int`, random `uuid` on hot tables |
| Strings | `text` | `varchar(255)` (no perf gain) |
| Timestamps | `timestamptz` | `timestamp` (no zone = bugs) |
| Money | `numeric(12,2)` | `float`/`double` |
| Flags | `boolean` | `int`/`varchar` |
| Enumerations | `text` + `CHECK`, or native `enum` | magic numbers |

Store time in UTC (`timestamptz`); convert at the edges.

## Indexing

| Query shape | Index |
|---|---|
| `WHERE col = ?` / `col > ?` | B-tree (default) |
| `WHERE a = ? AND b > ?` | composite `(a, b)` — equality cols first |
| `WHERE jsonb @> …` / FTS `@@` | `GIN` |
| Append-only time ranges | `BRIN` |

```sql
-- Composite: equality columns before range columns.
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

-- Partial: smaller, only the rows you query.
CREATE INDEX idx_users_active_email ON users (email) WHERE deleted_at IS NULL;

-- Covering: serve the query from the index alone.
CREATE INDEX idx_users_email_inc ON users (email) INCLUDE (name, created_at);
```

- Index every foreign key (Postgres does NOT auto-create FK indexes) and every
  column in `WHERE`/`ORDER BY`/`JOIN`.
- Don't over-index write-heavy tables — each index costs on every write.
- Build on live tables with `CREATE INDEX CONCURRENTLY` to avoid long locks.

## Query patterns

```sql
-- Keyset / cursor pagination: O(1), unlike OFFSET's O(n).
SELECT * FROM products WHERE id > $last_id ORDER BY id LIMIT 20;

-- Idempotent upsert.
INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)
ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value;

-- Safe queue claim: skip rows another worker holds.
UPDATE jobs SET status = 'processing'
WHERE id = (
  SELECT id FROM jobs WHERE status = 'pending'
  ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
) RETURNING *;
```

Always `EXPLAIN (ANALYZE, BUFFERS)` a suspect query; look for Seq Scans on large
tables and row-estimate vs actual mismatches (stale stats → `ANALYZE`).

## Transactions & locking

- Keep transactions short; never hold one open across a network round-trip or
  user think-time.
- Lock rows in a consistent order across the app to avoid deadlocks.
- Set `idle_in_transaction_session_timeout` and `statement_timeout` so a stuck
  client can't pin resources.

## Migrations

- Additive first: add nullable column / new table, backfill, then add the
  constraint — avoid full-table rewrites and long `ACCESS EXCLUSIVE` locks.
- `ADD COLUMN ... DEFAULT` is fast for constants on modern Postgres, but
  validate `NOT NULL`/`CHECK` separately (`NOT VALID` then `VALIDATE
  CONSTRAINT`) on big tables.
- Wrap DDL in a transaction where supported; `CREATE INDEX CONCURRENTLY` cannot
  run inside one.

## Diagnostics

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Slowest statements
SELECT query, mean_exec_time, calls FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 20;

-- Unindexed foreign keys
SELECT conrelid::regclass, a.attname
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (SELECT 1 FROM pg_index i
                  WHERE i.indrelid = c.conrelid AND a.attnum = ANY(i.indkey));

-- Dead-tuple bloat
SELECT relname, n_dead_tup, last_autovacuum FROM pg_stat_user_tables
WHERE n_dead_tup > 10000 ORDER BY n_dead_tup DESC;
```

## Security defaults

```sql
REVOKE ALL ON SCHEMA public FROM PUBLIC;     -- least privilege
-- App connects as a role with only the grants it needs (no superuser).
```

- Parameterize every query (the ORM or driver does this) — never string-build
  SQL from user input.
- If using Row Level Security, wrap session functions so the planner can cache:
  `USING ((SELECT auth.uid()) = user_id)`.

## Anti-patterns

- `SELECT *` in application code (breaks on schema change; reads unused columns).
- `OFFSET` pagination on large tables.
- Missing indexes on foreign keys.
- `float` for money; `timestamp` (without tz) for instants.
- Long-running transactions holding locks.

---

*Re-authored for ai-core-kit from the ECC `postgres-patterns` skill
(Copyright (c) 2026 Affaan Mustafa, MIT; itself credited to the Supabase team,
MIT). Adapted to kit conventions; relicensed notice retained under MIT.*
