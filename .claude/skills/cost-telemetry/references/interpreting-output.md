# Interpreting the aggregator output

The tool emits a human table and/or a JSON object (`--format table|json|both`).

## Reading the table

```
========================================================================
ai-core-kit cost report  (OFFLINE, from transcript usage x pricing)
pricing as_of 2026-06-01  |  files=2  turns=4
========================================================================

## by feature
bucket                                     turns      cost USD
--------------------------------------------------------------
order-intake                                   2        0.1187
telemetry                                      1        0.0103
unattributed                                   1        0.0032
--------------------------------------------------------------
sum(buckets)                                            0.1322   [reconcile vs total 0.1322: OK]
...
GRAND TOTAL: $0.1322 USD
tokens: in=3,053 out=1,812 cache_read=26,416 cache_write_5m=500 cache_write_1h=7,522
reconciled across all axes: YES
========================================================================
```

Checklist when quoting numbers:

1. **`reconciled across all axes: YES`.** If any axis says `MISMATCH` or the
   exit code is non-zero, STOP — the breakdown is not trustworthy.
2. **GRAND TOTAL** is the headline spend (USD).
3. **`unattributed` size.** A large default bucket on the `feature` axis means
   feature attribution is mostly unconfigured (work happened on `main`, or no
   sidecar windows covered it) — not that the work was cheap. Say this explicitly.
4. **token line** sanity-checks the cost: cache_read tokens are an order of
   magnitude cheaper than input/output; heavy cache_write_1h is the priciest
   write tier.
5. **`pricing as_of`** tells the reader which price snapshot produced the number.

## Reading the JSON

Top-level keys: `files_scanned`, `assistant_turns`, `total_cost_usd`,
`total_tokens`, `axes`, `buckets`, `reconciliation`, `reconciled`,
`default_bucket`, `pricing_as_of`.

```json
{
  "total_cost_usd": 0.1322,
  "buckets": {
    "feature": {
      "order-intake": {"cost_usd": 0.1187, "turns": 2, "tokens": {"input": 1003, "...": 0}}
    }
  },
  "reconciliation": {"feature": {"bucket_sum": 0.1322, "ok": true}},
  "reconciled": true
}
```

`buckets.<axis>` is ordered by descending cost. `reconciliation.<axis>.ok` must
be `true` on every axis (and `reconciled` overall) before the figures are usable.

## Comparing against budgets

CHILD manifests may declare `telemetry.budgets[]` (advisory USD caps, scope
`project|feature|contract|agent`). Match a cap to the matching bucket total:

| budget scope | compare against |
|---|---|
| `project` | `total_cost_usd` |
| `feature` | `buckets.feature[<id>].cost_usd` |
| `contract` | `buckets.feature[<contract_id>].cost_usd` (sidecar_map mode) |
| `agent` | `buckets.agent[<bucket>].cost_usd` |

Budgets only **flag** overage; they never block a live session.

## Common questions

- *"Why does feature X cost more than I expected?"* — Check its `turns` and
  `tokens`; large `cache_write_1h` or `output` dominate. Output tokens are 5×
  input on every tier.
- *"Why is everything in `unattributed`?"* — No branch matched `--branch-prefix`
  and no `--sidecar-map` was given. Re-run with the right attribution mode.
- *"The total looks low/high vs my console bill."* — This is a transcript-derived
  estimate at `pricing as_of`; it excludes anything not in the transcripts you
  scanned and uses the price snapshot in `pricing.json`, not your account's
  negotiated rates.
