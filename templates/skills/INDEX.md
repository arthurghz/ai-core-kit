# Ported primitives — catalog & wiring index

> **What this is.** The authoritative catalog of **every** skill, agent, and command
> ported into `ai-core-kit`, across both layers. For each item: its **layer** (META
> build-tooling vs CHILD payload), the **source repo + license** it was vendored or
> re-authored from, and the **trigger** that should wire it into a fork (a
> `project.manifest.yaml` value, an archetype, or "always").
>
> **Two layers.**
> - **META** = `.claude/skills/` — skills that help *build* the kit. Not rendered
>   into forks. Never gated by a child contract.
> - **CHILD** = `templates/skills/`, `templates/agents/`, `templates/commands/` —
>   the payload `/ack-init` (P4) renders into a fork, gated by the child manifest.
>
> **License discipline.** Apache-2.0 items (anthropics/skills) are copied/adapted
> with the NOTICE preserved; MIT items (ecc, claude-skills, claude-code-best-practice)
> are **re-authored** in kit canonical style with attribution. Full ledger:
> [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) and
> [`docs/REFERENCES.md`](../../docs/REFERENCES.md). Proprietary Anthropic doc skills
> (`docx`/`pdf`/`pptx`/`xlsx`) were **never** read, copied, or derived from.

---

## META — `.claude/skills/` (build the kit; not rendered into forks)

| Skill | Source repo | License | Provenance | Wiring trigger |
|---|---|---|---|---|
| `skill-creator` | anthropics/skills | Apache-2.0 | Vendored + adapted (kit conventions; ships `agents/`, `scripts/`, `eval-viewer/`) | META only — invoked by maintainers to author/benchmark kit skills. Never rendered. |
| `mcp-builder` | anthropics/skills | Apache-2.0 | Vendored + adapted (ships `reference/`, `scripts/`) | META only — invoked when building/extending an MCP server (incl. a child's `features.mcp` server). |
| `skill-validator` | author-new (wraps `scripts/lint-frontmatter.py`) | Apache-2.0 (kit) | Original to the kit | META only — validates kit skills/agents/commands against canonical frontmatter rules. |
| `cost-telemetry` (META) | author-new | — (kit, MIT) | Original to the kit | META only — interprets the offline cost aggregator over a *kit build* transcript. Child sibling lives at `templates/skills/cost-telemetry/`. |

> `skill-creator/agents/{analyzer,comparator,grader}.md` are **internal sub-agent
> prompts** of the skill, not standalone kit agents — they intentionally carry no
> kit agent frontmatter and are not linted as agents.

---

## CHILD — `templates/skills/` (top level, archetype/manifest-gated)

| Skill | Source repo | License | Provenance | Wiring trigger |
|---|---|---|---|---|
| `coding-standards` | author-new | MIT | Original to the kit | **Always** (every archetype) — shared cross-language quality floor. |
| `error-handling` | author-new | MIT | Original (TS/Python/Go examples in `references/python-go.md`) | **Always** for code archetypes (`backend-api`, `fullstack`, `cli`, `library`). |
| `code-tour` | author-new | MIT | Original to the kit | **Always** — onboarding/PR/RCA walkthroughs; emits `.tours/`. |
| `architecture-decision-records` | author-new (Nygard ADR format) | MIT | Original to the kit | **Always** — records decisions to `docs/adr/`. |
| `production-audit` | author-new | MIT | Original to the kit | Archetypes that ship: `backend-api`, `fullstack`, `cli`. Skip docs-only/library. |
| `cost-audit` | author-new | MIT | Original; delegates numbers to `cost-telemetry` | Render when `features.cost_telemetry == true` OR archetype runs paid jobs/agents. |
| `cost-telemetry` (CHILD) | author-new | MIT | Original; runs `telemetry/aggregate.py` | Render when `features.cost_telemetry == true`. |
| `agent-eval` | author-new | MIT | Original to the kit | Render when `features.agent_eval == true` (or maintainer opts in). |
| `frontend-a11y` | author-new | MIT | Original; `references/components.md` | Render for `fullstack` with a React/Next UI (`framework in [next, remix]`). |
| `ui-design-system` | alirezarezvani/claude-skills | MIT | **Re-authored**; ships `scripts/`, `references/`, `assets/` | Render for `fullstack` / UI archetypes; or `features.design_system == true`. |
| `saas-scaffolder` | alirezarezvani/claude-skills | MIT | **Re-authored**; ships `scripts/`, `references/` | Render for archetype `saas` (the kit's opinionated Next+shadcn+Clerk+Supabase+Drizzle+Stripe stack), or `fullstack` once auth+billing are added. |
| `spec-to-repo` | alirezarezvani/claude-skills | MIT | **Re-authored**; ships `scripts/`, `references/` | Greenfield scaffolding from a free-form spec. NOT archetype-gated (there is no `scaffold` archetype enum value); render in a new-project / greenfield flow or when `features.greenfield_scaffold == true`. |

---

## CHILD — `templates/skills/lang/` (language / framework / DB packs)

Deterministic manifest-gated render set. Authoritative trigger table:
[`templates/skills/lang/INDEX.md`](./lang/INDEX.md). Summary:

| Pack | Source repo | License | Provenance | Wiring trigger (manifest condition) |
|---|---|---|---|---|
| `python-patterns` | affaan-m/ecc (`python-patterns`) | MIT | Re-authored | `project.language == python` |
| `python-testing` | affaan-m/ecc (`python-testing`) | MIT | Re-authored | `project.language == python` |
| `typescript-patterns` | author-new (no ECC source) | MIT | Original to the kit | `project.language == typescript` |
| `go-patterns` | affaan-m/ecc (`golang-patterns`) | MIT | Re-authored | `project.language == go` |
| `rust-patterns` | affaan-m/ecc (`rust-patterns`) | MIT | Re-authored | `project.language == rust` |
| `node-api-patterns` | author-new (informed by ECC `nestjs-patterns`) | MIT | Original; covers both enums | `project.framework in [express, nestjs]` |
| `react-patterns` | affaan-m/ecc (`react-patterns`) | MIT | Re-authored | `project.framework in [next, remix]` (React fullstack UIs only) |
| `postgres-patterns` | affaan-m/ecc (`postgres-patterns`) | MIT | Re-authored | `persistence.db == postgres` |
| `prisma-patterns` | affaan-m/ecc (`prisma-patterns`) | MIT | Re-authored | `persistence.orm == prisma` |
| `docker-patterns` | affaan-m/ecc (`docker-patterns`) | MIT | Re-authored | containerization — **no manifest key yet** (see deferred). Recommend always-render for `backend-api`/`fullstack`. |

---

## CHILD — `templates/agents/`

The RPI + review agent fleet. ECC-sourced agents are the engineering reviewers;
claude-code-best-practice supplies the RPI-flow agents.

| Agent | Source repo | License | Model | Wiring trigger |
|---|---|---|---|---|
| `architect` | affaan-m/ecc | MIT | opus | **Always** — design/ADR/trade-off work; RPI plan phase. |
| `code-explorer` | affaan-m/ecc | MIT | sonnet | **Always** — discovery step of RPI research/implement. |
| `code-reviewer` | affaan-m/ecc | MIT | sonnet | **Always** for code archetypes — post-write/pre-PR review. |
| `security-reviewer` | affaan-m/ecc | MIT | sonnet | Render for code archetypes touching auth/input/payments; pre-release. |
| `silent-failure-hunter` | affaan-m/ecc | MIT | sonnet | Render for code archetypes doing I/O/DB/network/transactions. |
| `refactor-cleaner` | affaan-m/ecc | MIT | sonnet | **Always** for code archetypes — dedicated cleanup pass. |
| `requirement-parser` | claude-code-best-practice (`rpi/`) | MIT | sonnet | RPI research step 1 — render when `features.rpi == true`. |
| `constitutional-validator` | claude-code-best-practice (`rpi/`) | MIT | opus | RPI research→plan gate; render when the child has a constitution/archetype. |

---

## CHILD — `templates/commands/`

| Command | Source repo | License | Wiring trigger |
|---|---|---|---|
| `/rpi/research` | claude-code-best-practice (`rpi/`) | MIT | Render when `features.rpi == true`. RPI step 1 (GO/NO-GO). |
| `/rpi/plan` | claude-code-best-practice (`rpi/`) | MIT | Render when `features.rpi == true`. RPI step 2 (planning docs). |
| `/rpi/implement` | claude-code-best-practice (`rpi/`) | MIT | Render when `features.rpi == true`. RPI step 3 (phased exec + gate). |
| `/prd` | author-new (G5 product) | MIT | Render for product/SaaS archetypes or `features.product == true`. |
| `/rice` | author-new (G5 product) | MIT | Render for product/SaaS archetypes or `features.product == true`. |

---

## Deferred / not ported (no silent caps)

These were in the port plan or surfaced as gaps but are **not** present in the
current ported set. Listed so nothing disappears silently.

### Language / framework / DB packs (from G4)

| Manifest enum value | Status | Port-plan disposition |
|---|---|---|
| `project.language == java` | **not ported** | `java-coding-standards` (+ testing) routed outside the G4 minimum; needs a future pack. |
| `project.framework == fastapi` (Python backend) | **not ported** | `fastapi-patterns` (copy from ecc) planned; not in G4 minimum. |
| `project.framework == gin` (Go backend) | **not ported** | `gin-patterns` author-new; not in G4 minimum. |
| `project.framework == axum` (Rust backend) | **not ported** | `axum-patterns` author-new; not in G4 minimum. |
| `project.framework in [sveltekit, nuxt]` (fullstack) | **not ported** | `sveltekit-patterns` / `nuxt4-patterns` author-new. `react-patterns` must **NOT** render for these. |
| `persistence.db in [mysql, sqlite, mongodb]` | **not ported** | `mysql-patterns` (copy from ecc), `sqlite-patterns` / `mongodb-patterns` author-new. |
| `persistence.orm in [sqlalchemy, drizzle, gorm]` | **not ported** | all three author-new in the port plan. |

### Schema/interview gap (blocking clean `docker-patterns` wiring)

- **Containerization has no manifest key.** `templates/interview/questions.yaml`
  never asks whether the child uses Docker, so `docker-patterns` has no enum to
  gate on. **Recommendation:** add a `project.containerized` boolean to the
  interview/schema, OR have P4 always render `docker-patterns` for
  `backend-api`/`fullstack`. **Owner:** schema/interview maintainers (P3/P4).

### Anthropics example skills available but NOT vendored here

Listed as vendorable in `docs/REFERENCES.md §1a` but not pulled into this port:
`algorithmic-art`, `brand-guidelines`, `canvas-design`, `claude-api`,
`frontend-design`, `internal-comms`, `slack-gif-creator`, `theme-factory`,
`web-artifacts-builder`, `webapp-testing`. (`doc-coauthoring` ships no LICENSE.txt
→ not vendorable.) Adopt later behind product/design feature flags if needed.

### Proprietary — permanently excluded

Anthropic document skills `docx`, `pdf`, `pptx`, `xlsx` — "All rights reserved".
Never read, copied, or derived from. See `docs/REFERENCES.md §1b`.
