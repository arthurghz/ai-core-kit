---
name: cost-audit
description: >
  Evidence-first investigation of runaway or anomalous spend in an app or service
  — runaway job/PR creation, quota/usage-gate bypass, premium-model leakage,
  duplicate-job fanout, retry burn, and recursive self-triggering — tracing the
  request path (ingress → queue → worker → side effects) to a ranked, file-cited
  root cause and a burn-ordered fix list. For the LLM-token-spend NUMBERS of a
  Claude Code run, it delegates to the offline aggregator
  (`telemetry/aggregate.py` via the `cost-telemetry` skill) instead of
  re-deriving pricing. Use when the user reports a cost spike, "why is our bill
  so high", over-created PRs/jobs, a usage-limit bypass, or model-tier leakage.
  Trigger on "cost spike", "burn rate", "we're over budget", "duplicate jobs", or
  "free users hitting the paid model". Do NOT use to simply compute what one
  finished Claude Code session cost (use cost-telemetry directly) or to reconcile
  an Anthropic console invoice.
license: MIT
---

# Cost Audit

Investigate **why** spend spiked, not just how much. This is an operator workflow
for finding the root cause of runaway cost in an app — recursive job creation,
quota bypass, premium-model leakage, duplicate fanout, retry burn — and returning
a ranked, file-cited cause with fixes ordered by burn impact.

It deliberately does **not** re-implement cost math. When the question involves
the token spend of a Claude Code run, the authoritative numbers come from the
project's offline aggregator — see **Cost numbers come from telemetry** below.

## When to use

- The user reports a cost spike, a surprise bill, or "why is our spend so high".
- An app over-creates PRs, jobs, branches, or messages.
- A usage limit or paid gate appears to be bypassed.
- Free/capped users seem to reach a premium model or analyzer.
- Duplicate jobs, retry loops, or self-triggering webhooks are suspected.

## When NOT to use

- Just computing what one finished Claude Code session/build cost → use
  `cost-telemetry` (it runs `telemetry/aggregate.py` and interprets the output).
- Reconciling an Anthropic console/API invoice → that is provider billing, not a
  transcript- or repo-derived estimate.
- A real-time/streaming cost meter → impossible for Claude Code spend (hooks see
  no token fields; `cost-telemetry` explains the offline-only constraint).

## Cost numbers come from telemetry — do not re-derive them

For any spend that is LLM token usage in a Claude Code run, the single source of
truth is the offline aggregator shipped with this project:

```bash
python3 ${CLAUDE_PROJECT_DIR}/telemetry/aggregate.py \
  --by feature,model,agent,session --format both
```

- It multiplies transcript `message.usage` lines by the versioned
  `telemetry/pricing.json` and attributes spend by model / feature / agent /
  session, with a reconciliation check that must read `reconciled: YES`.
- A model id missing from `pricing.json` is a **hard error** — never edit a
  transcript or invent a price to dodge it; add the row and re-run.
- Invoke the `cost-telemetry` skill to run and interpret this; this skill's job
  is the *root-cause investigation*, telemetry's job is the *numbers*. Quote
  telemetry's figures; do not produce your own pricing math.

This skill adds the cost dimensions telemetry cannot see — provider API spend
outside Claude Code, infrastructure/compute, and the *behavioral* root cause of a
spike (the recursion or the bypass that created the volume in the first place).

## Scope guardrails

- Start **read-only** unless the user clearly asked for a fix.
- Pin the audit to a concrete surface; do not wander the whole repo.
- Separate three things explicitly and never conflate them:
  1. the **repo-side root cause** of the burn (code-backed),
  2. the **customer/billing impact** (inference, kept distinct from code truth),
  3. the **product/entitlement gaps** that belong in the backlog.
- Treat app-generated branches, PRs, and events as red-flag recursion paths until
  proven otherwise.

## Workflow

### 1. Freeze the scope
Check the current branch and local diff first. Identify the exact surface under
audit: webhook/HTTP ingress, queue producer, queue consumer, the
job/PR/side-effect creation path, the usage-reservation/billing path, and the
model-routing path.

### 2. Trace ingress before theorizing
Inspect the entrypoint first. Map **every** enqueue path before proposing a fix.
Confirm which events share a queue/job type and whether push, sync, comment,
cron, or manual re-run events can converge on the same expensive path.

### 3. Trace the worker and its side effects
Inspect the consumer/worker that does the expensive work. Confirm whether a
queued unit always ends in a created PR/job, file writes, premium model calls, or
usage increments. **If it can spend tokens and then fail before persisting
output, classify it as burn-with-broken-output** — that is pure waste.

### 4. Audit the high-signal burn paths

- **Multiplication** — inspect creation helpers and naming; check dedupe,
  sync-event handling, and existing-resource reuse. If app-generated output can
  re-enter processing, treat it as a priority-0 recursion risk.
- **Quota / gate bypass** — find where quota is *checked* versus where usage is
  *reserved/incremented*. If checked at the front door but charged only in the
  worker, concurrent passes are a real race.
- **Premium-model leakage** — inspect tier branching and provider routing; verify
  free/capped users cannot reach premium models when premium keys are present.
  Confirm against `aggregate.py --by model` which model tiers actually billed.
- **Retry burn** — inspect retry loops and deterministic-failure reruns. If the
  same non-transient error can spend repeatedly, fix that before any polish.

### 5. Fix in burn order
If the user asked for changes, prioritize: (1) stop runaway multiplication,
(2) stop quota bypass, (3) stop premium leakage, (4) stop duplicate fanout and
pointless retries, (5) close rerun/update safety gaps. Keep the pass to one to
three direct fixes unless one root cause clearly spans several files.

### 6. Verify with the smallest proving step
Rerun only the targeted tests or integration slices covering the changed path.
State the burn path's new state (blocked / deduped / downgraded / rejected early)
and the exact status: changed locally, verified locally, pushed, deployed, or
still blocked. Re-run `aggregate.py` over the post-fix window if Claude Code
spend was part of the spike, and confirm the per-axis numbers dropped.

## High-signal failure patterns

1. **One queue type for every trigger** — pushes, syncs, and manual runs all
   enqueue the same job and the worker always creates a PR → analysis = spam.
2. **Post-enqueue usage reservation** — quota checked at the door, charged only
   in the worker → concurrent requests all pass and exceed quota.
3. **Free tier on the premium path** — free jobs still route to a premium
   provider when keys exist → real spend even if the user never sees the result.
4. **App output re-enters ingress** — `synchronize`, branch pushes, or
   comment-triggered runs fire on app-owned branches → recursive self-analysis.
5. **Expensive work before persistence safety** — tokens spent, then a failure on
   create/update/collision → cost with no shipped value.

## Output format

- **Spike summary** — one sentence: what spiked, by how much, over what window.
  Cite the telemetry figure (and its `reconciled: YES`) for any Claude Code spend.
- **Root cause** — ranked, each citing exact file paths and code areas.
- **Burn-ordered fixes** — ordered by impact, not code neatness.
- **Customer/billing impact** — kept distinct from code-backed truth.
- **Verification** — the proving command(s) and the exact post-fix status.

## Pitfalls

- Do not start with broad repo wandering; settle ingress → queue → worker first.
- Do not produce your own LLM pricing math — quote `aggregate.py`.
- Do not mix billing inference with code-backed truth.
- Do not fix lower-value issues before the highest-burn path is contained.
- Do not claim the burn is fixed until the narrow proving step was rerun.
- Do not push or deploy unless the user asked.

## Related skills

- `cost-telemetry` — runs `telemetry/aggregate.py`; the source of all Claude Code
  spend numbers this skill quotes.
- `production-audit` — pre-launch pass that includes payment/abuse and burn risks.
- `error-handling` — idempotency and retry-only-retriable patterns that prevent
  retry burn at the source.
