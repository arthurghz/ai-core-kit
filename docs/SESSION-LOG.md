# Session log — ai-core-kit build

> A dated changelog of the exclusive build session that took `ai-core-kit` from a
> frozen P3 contract to a published, documented, observable forkable standard.
> Reconstructed from `git log` — every claim is tied to a commit hash. Newest
> theme last; within a theme, commits are oldest-first.

The session ran **2026-06-01 → 2026-06-02**. The two P3-foundation commits
(`85c7a7e`, `84e814d`, 2026-06-01) predate the session proper and are the
ground it built on; everything else landed on 2026-06-02.

---

## 0. Inherited foundation (2026-06-01)

The frozen P3 contract the session started from — listed for context, not part
of this session's work.

- `85c7a7e` — P3 foundation: frozen manifest schema, question bank, `/ack-init`,
  render contract, plan-review.
- `84e814d` — Closed the P3 punch-list (O1–O12): JSON-Schema validator +
  renderable archetype trees.

---

## 1. META core — repo skeleton, `.claude/` machinery, build config

The kit's own META layer: docs, the Claude Code config that *builds* the kit
(never rendered into a fork), the meta-builder skills, and the data-driven build
config.

- `8150a7d` — Ignore build output (`dist`/`.next`/`out`/`.vercel`), demo media,
  local artifacts.
- `f0394c2` — README, minimal CLAUDE.md, license ledger / NOTICES, conventions,
  patterns, bootstrap-config docs.
- `2eb26e7` — META `.claude/` core: `settings.json` (deliberately **no**
  self-gate — it would pass vacuously), the build-team agents, and the
  `/ack-build` + `/ack-spec` commands.
- `3774860` — META meta-builder skills (`skill-creator`, `mcp-builder`,
  `skill-validator`) + `cost-telemetry` + the frontmatter linter.
- `e5ca1d3` — YAML-driven build config `bootstrap/ack.bootstrap.yaml` + its JSON
  schema, so re-planning the build means editing one validated file, not a prompt.

---

## 2. Deterministic render engine + the offline telemetry it ships with

The zero-LLM render path (manifest → files) and the cost engine, both authored as
META tools that also ship to forks under `templates/`.

- `25dfd77` — Offline cost aggregator (`telemetry/aggregate.py`) + versioned
  `pricing.json` + the Prometheus / Grafana observability stack. (This is the
  base the later observability suite — §8 — extends.)
- `05490fe` — JS render engine + the `create-ack` CLI for fork-free product
  spin-up: select files, substitute `${dotted.path}` vars, strip `_when.*`
  guards, deterministic byte-for-byte output.

---

## 3. The CHILD payload — skills catalog, specs, design system, telemetry

What `/ack-init` / `create-ack` actually render into a fork. All of it lives
under `templates/`.

- `f9254ee` — CHILD skills catalog: engineering, language packs, product, and
  document-generation skills (docx/xlsx/pptx/pdf). License-clean — proprietary
  doc skills are referenced, never vendored.
- `bab8a76` — Spec-first CHILD payload: specs, a per-product docs-site,
  design-system + shadcn, telemetry; wired the `.mcp.json`, `settings.json`, and
  NOTICE.

---

## 4. The docs site — Nextra (EN + PT), landing, and per-page terminal video

A bilingual Nextra site with concept diagrams, a full reference catalog, a
spec-first landing page, and a hand-authored asciinema cast on every page.

- `955aedc` — Nextra docs site (EN+PT): concept diagrams, full reference
  catalog, standalone landing, Vercel-ready.
- `cd9100e` — Demo recorders: VHS terminal screencast + Playwright browser-tour
  (+ lightweight svg/cast).
- `24987da` — Replayable asciinema terminal-bootstrap video on the landing hero.
- `ee4f4cd` — Redesigned the landing into a spec-first product homepage + docs
  polish.
- `26d4685` — Clean, non-clipping terminal casts + demos across the docs.
- `abeef94` — Longer hero walkthrough + a terminal demo per archetype and install
  page.
- `e2beee2` — A ~10-15s explanatory terminal video on **every** docs page
  (the cast set this session's observability cast — §8 — joins).

---

## 5. Spec-first / docs-first methodology — Phases A–E

The pivot that made the kit context/spec-first: a moment-0 interview authors prose
specs (PRD, DOMAIN, REQUIREMENTS, ARCHITECTURE, DESIGN, PLAN) and the best
CLAUDE.md, with minimal code generation.

- `1be4f6b` — `SPEC-FIRST-BOOTSTRAP` design: the docs-first pipeline + the
  archetype matrix (SaaS, IaC).
- `6925ccc` — **Phase A**: DESIGN.md + PLAN.md specs, the design/plan interview,
  `/ack-spec` wiring.
- `33fc356` — **Phase B**: materialize the child design system from the single
  brand token.
- `efd78a2` — **Phase C** (breaking): manifest `schema_version` 2→3, the `saas`
  archetype + orthogonal IaC.
- `4c01e67` — **Phase D**: the `saas` archetype tree + IaC subtree + interview
  branches.
- `350e959` — **Phase E**: made spec-first the **default** bootstrap flow +
  reconciled the skills.

---

## 6. SaaS + IaC archetypes (shipped, not planned)

- `efd78a2` / `4c01e67` (see §5) introduced the `saas` archetype and the
  orthogonal infra-as-code subtree.
- `351643e` — Flipped the site cards from "planned" to "shipped" and added the
  `archetypes/saas` page — SaaS + IaC are real archetypes, documented as such.

---

## 7. Licensing, Vercel fixes, and the npm publish pipeline

The cross-cutting fixes that made the site deploy and the kit installable.

- `5ad0148` — MIT as the canonical license + reconciled entry points and stale
  references.
- `8700c98` — Recovered gitignored "Building the Kit" pages that had broken the
  Vercel build.
- `ca4199e` — Redirect `/` → `/en` so the root URL stops 404ing on Vercel
  (the **Vercel root-dir / root-URL fix**).
- `413d795` — Stop the i18n middleware from locale-redirecting public assets
  (so the casts and images actually load).
- `f52dc39` — Ship as **`@arthurghz/create-ack`** on npm via CI/CD + fix the
  broken entry point (the publish pipeline).

---

## 8. Observability suite — AI/token-usage monitoring + DORA + docs (this sub-session)

Extends the §2 cost stack rather than duplicating it. Three workstreams:

- **(A) AI / token-usage monitoring** — `aggregate.py` now carries token counts
  (input / output / cache_read / cache_write_5m / cache_write_1h) on every bucket
  alongside USD, adds a `day` time axis and per-day series, and advisory budgets;
  a new `ack-ai-usage` Grafana dashboard charts tokens and budget utilization.
- **(B) DORA metrics** — `telemetry/dora.py` computes the four keys (deployment
  frequency, lead time for changes, change-failure rate, time-to-restore) from
  git history (+ `gh` when available), with a self-test, surfaced on a new
  `ack-dora` Grafana dashboard.
- **(C) docs** — this file, the enriched `reference/observability` page (EN+PT),
  and a new terminal cast.

All three are mirrored into the CHILD payload under `templates/telemetry/`. The
honesty caveat holds throughout: AI cost is **offline / transcript-derived**, not
a live meter (Claude Code hooks carry no cost field —
[#11008](https://github.com/anthropics/claude-code/issues/11008)). DORA, by
contrast, is derived from git/`gh` and is exact.

*(Commit hash pending — this suite lands as one semantic commit at the end of the
sub-session.)*

---

## Current status

- **Frozen P3 contract**: intact (manifest schema untouched this session).
- **Deterministic render engine + `create-ack` CLI**: shipping.
- **Docs site** (Nextra, EN+PT): live on Vercel, a terminal cast per page.
- **Spec-first methodology** (Phases A–E): the default bootstrap flow.
- **Archetypes**: minimal-core safe core + `backend-api`, `fullstack`, `saas`
  deep archetypes; orthogonal IaC subtree.
- **Telemetry**: offline cost aggregator + Prometheus/Grafana stack, now extended
  with token-usage monitoring + DORA (§8).
- `npm test` (114) and `python3 scripts/lint-frontmatter.py` (0 errors) are the
  green gates the session held throughout.

## Open items

- **npm publish** of `@arthurghz/create-ack@0.1.0` is wired (CI/CD, `f52dc39`)
  but **pending an npm Automation token** before the first real publish.
- **Discovery engine** (`/discover`, propose-never-adopt) remains **roadmap**
  (P7), shape-only — not built.
- The observability suite (§8) lands as its own semantic commit; its hash is not
  yet in `git log` at the time this entry was written.
