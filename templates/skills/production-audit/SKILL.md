---
name: production-audit
description: >
  Local-evidence production-readiness audit for a shipped app — pre-launch
  reviews, post-merge risk passes, and "what breaks in prod?" questions, built
  only from the repo, CI, and user-authorized surfaces (no uploading source to an
  external scanner). Produces a scored ship/block call with named blockers,
  high-value fixes, and the evidence checked. Use when the user asks "is this
  production-ready", "what would break in prod", "ready to ship?", or wants
  deploy risk despite green CI. Trigger on those phrases near a launch, demo, or
  customer rollout. Do NOT use during active implementation (use security-review
  for line-level secure coding), for docs-only/library repos, or for formal
  legal/compliance certification.
license: MIT
---

# Production Audit

Use this when the user asks whether an app is ready to ship, what could break in
production, or what must be fixed before a launch. It builds the audit from
**local and user-authorized evidence only** — it keeps the production-readiness
lens while refusing to upload repo contents to a third-party service or run
unpinned remote code.

## When to use

- "Is this production-ready?", "what would break in prod?", "what did we miss?",
  "audit this repo", or "ready to ship?".
- A feature was merged and needs a pre-deploy or post-merge risk pass.
- A public launch, demo, customer rollout, or investor walkthrough is close.
- CI is green but the user wants production *risk*, not just test status.
- A deployed URL, release branch, PR, or current checkout is available as evidence.

## When NOT to use

- During active implementation — the right lens is line-level secure coding; use
  `security-review` first.
- Pure libraries, templates, docs-only repos, or scaffolds (unless the user wants
  packaging/release readiness rather than application readiness).
- A formal compliance audit — this is engineering triage, not legal, financial,
  medical, or regulatory certification.
- When the only evidence is a product idea with no repo, deployment, CI, or runtime.

## How it works

Do not run unpinned remote code, upload repository contents to third-party
services, or call external scanners unless the user explicitly approves that
specific tool and data flow. Work in this order:

1. Establish the release surface (what ships, where, how).
2. Read recent changes and current branch state.
3. Inspect the runtime, auth, data, payment, background-job, AI, and deployment
   boundaries that actually exist in the repo.
4. Check CI, tests, migrations, environment docs, and the rollback path.
5. Produce a short ship/block recommendation with specific fixes.

## Evidence checklist

Start with cheap local signals (run from `${CLAUDE_PROJECT_DIR}`):

```bash
git status --short --branch
git log --oneline --decorate -20
git diff --stat origin/main...HEAD
```

Then inspect the project-specific surface:

- Package scripts, CI workflows, release scripts, Dockerfiles, deploy manifests.
- API routes, webhooks, auth middleware, background workers, cron jobs, migrations.
- Environment-variable documentation and startup validation.
- Observability hooks, error reporting, logs, health checks, dashboards.
- Rollback, seed, migration, and backfill instructions.
- E2E coverage for the user paths that matter most.

If a deployed URL is in scope, use browser or HTTP checks only against that URL,
and avoid credentialed actions unless the user supplies a safe test account.

## Risk lenses

### Security & auth
- Are public, API, and admin routes clearly separated?
- Is authn/authz enforced **server-side**?
- Are secrets kept out of client bundles, logs, example output, and committed files?
- Are rate limits, CSRF, CORS, and upload validation present where needed?
- Does the AI/agent surface defend against prompt injection, tool abuse, and
  untrusted content crossing into privileged actions?

### Data integrity
- Do migrations run forward cleanly with a rollback or recovery plan?
- Are destructive migrations, backfills, and imports staged safely?
- Do DB policies, grants, and service-role boundaries match the tenancy model?
- Are writes, jobs, and webhook handlers idempotent under retry?

### Payments & webhooks
- Are webhook signatures verified before trusting payload fields?
- Is each payment/subscription/fulfillment webhook idempotent?
- Are replay, duplicate delivery, and out-of-order delivery handled?
- Are test-mode and live-mode credentials separated?

### Operations
- Can the app start from a clean checkout using documented commands?
- Are required env vars named, validated, and fail-fast?
- Is there a health check that proves dependencies are reachable?
- Are deploy, rollback, and incident-owner paths documented?
- Are logs useful without leaking secrets or personal data?

### User experience
- Are launch-critical paths covered on desktop and mobile?
- Are forms usable on mobile (no input zoom, layout overlap, blocked submit)?
- Do loading, empty, error, and permission-denied states explain what happened?
- Is there a support or recovery path when a critical operation fails?

## Scoring

Scores force prioritization; they do not imply mathematical certainty.

| Band | Score | Meaning |
|---|---|---|
| Blocked | 0–49 | Do not ship until the top risks are fixed |
| Risky | 50–69 | Ship only behind a small rollout or internal beta |
| Launchable with caveats | 70–84 | Ship if owners accept the listed risks |
| Strong | 85–100 | No obvious launch blockers from available evidence |

**Cap the score at 69** if any of these hold: authn/authz missing on sensitive
data; payment/fulfillment webhooks not idempotent; required migrations cannot be
run safely; secrets exposed in client bundles, logs, or committed files; no
rollback path for a high-impact release.

**Cap the score at 84** if CI is not green or the launch-critical path was not
tested end to end.

## Output format

Lead with one sentence, then the structured list:

```text
Production audit: 76/100, launchable with caveats — webhook idempotency and
rollback docs are the two risks to fix before public launch.
```

- **Blockers** — must-fix before deploy.
- **High-value fixes** — next fixes to improve the score.
- **Evidence checked** — files, commands, CI runs, deployed URL, or PRs inspected.
- **Evidence missing** — what would change confidence if provided.
- **Next action** — one concrete fix or verification step.

Keep strengths short. The user asked for readiness, so the useful answer is the
remaining risk and the next action.

## Anti-patterns

- Running `npx <pkg>@latest` or a remote scanner as the default audit path.
- Uploading source, secrets, customer data, or private topology to an external
  service without explicit approval.
- Producing a score without naming the evidence checked.
- Treating green CI as production readiness.
- Ending with a generic "let me know what you want to do."

## Related skills

- `security-review` — line-level secure-coding pass on a change.
- `error-handling` — the failure contract this audit checks for at the boundary.
- `cost-audit` — pair with this to flag spend/abuse risks before a public launch.
