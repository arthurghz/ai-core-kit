# Attribution reference — how each axis is derived

The aggregator buckets every priced assistant turn onto four independent axes.
Each turn contributes its full cost to exactly one bucket per axis, so every
axis reconciles to the same grand total.

## model

- **Source:** `message.model` (exact id).
- **Reliability:** exact. Always correct.
- **Failure:** an id absent from `pricing.json` is a hard error (it names the id).

## session

- **Source:** `sessionId`.
- **Reliability:** exact. One bucket per Claude Code session.

## agent

Transcripts contain **no agent name**. The only usable signal is `isSidechain`:

| `isSidechain` | bucket |
|---|---|
| `false` (or absent) | `main` |
| `true` | `subagent:<requestId>` (falls back to `<uuid>` then default) |

This separates main-session spend from delegated subagent/`Task` spend. It does
**not** recover a human-readable agent name (none exists in the transcript). When
a build uses agent teams, each spawned teammate's turns are sidechains and group
under their own `subagent:<requestId>`.

## feature

Transcripts contain **no feature field**, so feature must be supplied explicitly
by one of two conventions. Anything matching neither lands in the **default
bucket** (`--default-bucket`, default `unattributed`) — never dropped.

### branch_prefix (default)

- **Convention:** one branch per feature, named `<prefix><feature>`.
- **Rule:** `gitBranch` that starts with `--branch-prefix` → bucket is the tail.
  `feat/order-intake` with prefix `feat/` → `order-intake`.
- **Non-matching** branches (`main`, `master`, `develop`, `HEAD`, detached) →
  default bucket.
- **Pros:** zero extra tooling. **Cons:** granularity is the branch; turns made
  on `main` are unattributed.

### sidecar_map (precise)

- **Convention:** a JSON file of `{from, to, bucket}` windows. A turn whose
  `timestamp ∈ [from, to)` buckets to that window's label; `to: null` means
  open-ended.
- **Who writes it:** a `SessionStart`/`SessionEnd` hook can legitimately append a
  `timestamp → contract_id` window (recording *time and a label* is allowed; only
  recording *cost* is blocked by issue 11008). The aggregator then joins those
  windows to usage lines offline.
- **Pros:** contract-level precision regardless of branch. **Cons:** requires the
  recorder; overlapping windows resolve to the first match.

Use **branch_prefix** for lightweight per-feature reporting; **sidecar_map** when
you need per-contract precision (e.g. enforcing `telemetry.budgets[]` caps keyed
on `contract`).
