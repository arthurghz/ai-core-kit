# SPEC-FIRST-BOOTSTRAP.md — the docs-first bootstrap + archetype matrix expansion

> **Status:** PROPOSAL (design + phased implementation plan). Not yet built.
> **Layer:** META — this designs CHILD-facing behavior. Nothing here edits the frozen
> contract directly; it specifies the edits a follow-up team must make, the order to
> make them, and the validators that must stay green.
> **Companions (read first):** `docs/RENDER-ENGINE.md` (the P4 render contract),
> `templates/manifest/project.manifest.schema.yaml` (the FROZEN manifest contract),
> `templates/interview/questions.yaml` (deterministic manifest bank),
> `templates/interview/spec-questions.yaml` (narrative discovery bank),
> `.claude/commands/ack-init.md`, `.claude/commands/ack-spec.md`.

---

## 0. The headline goal, stated precisely

Every fork's bootstrap should **first** produce the COMPLETE set of human-readable
intent artifacts — tech specs (PRD, ARCHITECTURE, DOMAIN, REQUIREMENTS, NON-GOALS,
ROADMAP), a **PLAN**, a best-in-class **CLAUDE.md**, and a **clear DESIGN SYSTEM +
requirements** for the product — via an **interactive interview/chat plus an LLM
generation step**. Only **after** those artifacts exist does the deterministic engine
render the structural scaffold.

This must reconcile with the kit's load-bearing promise: **the render loop is
zero-LLM and byte-deterministic** (RENDER-ENGINE §8, invariant I2). The reconciliation
is the same one the kit already half-implements (`spec-questions.yaml:9-14`):

> **The LLM authors PROSE during the interview. The render of STRUCTURAL files stays
> deterministic.** Two artifact classes, two pipelines, one ordering.

- **Class A — narrative artifacts** (specs, PLAN, design spec, CLAUDE.md House notes):
  model-authored Markdown. Same answers do **not** guarantee byte-identical output;
  these are human-reviewed.
- **Class B — structural artifacts** (manifest, scaffold, hooks, settings.json,
  design-system token files): rendered by `scripts/render.mjs` from `managed:`. Same
  answers ⇒ byte-identical output (invariant I2). **No LLM ever touches Class B.**

The design-system is the one place these classes meet, and the meeting is clean: the
human's brand color is captured as a **deterministic manifest token** (Class B input)
that the renderer substitutes into `globals.css`/`theme.tokens.json`; the *narrative*
design rationale is authored into a Class A `DESIGN.md`. The token VALUE flows through
determinism; the WHY flows through the LLM.

---

## 1. The docs-first bootstrap FLOW (ordered pipeline)

### 1.1 What exists today (the audited baseline)

`create-ack` (`bin/create-ack.mjs`) already runs this sequence on a fresh fork:

1. parse args → resolve kit root → meta-guard target
2. resolve archetype (first question) → `filterQuestions()` → collect answers
   (`lib/manifest.mjs`)
3. `buildManifest()` assembles `managed:`, validates against the frozen JSON-Schema
   (invariant I6), computes `manifest_hash` last
4. write `project.manifest.yaml`
5. `renderTree()` renders `templates/archetypes/<archetype>/` → target (Class B)
6. `renderSpecsScaffold()` renders `templates/specs/**` → `specs/**` as **skeletons**
   with inline author-prompt comments (only when `project.framework` +
   `project.architecture` are bound, i.e. deep archetypes; minimal-core skips)
7. render `templates/CLAUDE.child.md.tmpl` → `CLAUDE.md` (lean pointer)
8. render `templates/docs-site/` → `docs/`
9. print **Next steps: run `/ack-spec`**

So today the order is: **manifest + scaffold + spec SKELETONS first, then a SEPARATE,
MANUAL, post-init `/ack-spec`** authors the prose. The LLM step is real and good
(`ack-spec.md` STEP 3-4 synthesizes `spec-questions.yaml` answers into the six docs),
but it is **not part of the bootstrap** — it is an optional follow-up the user must
remember to run, and it runs *after* the scaffold, not *before* it. Two real gaps
versus the headline goal:

- the spec/PLAN/design prose is **not produced first** (scaffold lands before intent);
- there is **no PLAN artifact and no DESIGN spec** in the doc set at all (§4, §5).

### 1.2 The proposed FLOW (where the LLM is, where determinism is preserved)

We do **not** invert the engine. The deterministic render still needs the manifest,
and the manifest is cheap, deterministic, and the *archetype oracle* everything else
keys off. Instead we make the **intent phase a first-class, gated stage of the
bootstrap that runs as early as possible**, and we feed its few deterministic outputs
(design tokens, plan-derived contract scope) back into the manifest before the
structural render. Concretely, the bootstrap becomes a **five-stage pipeline** with a
single LLM island in the middle:

```
 STAGE 0  ARCHETYPE + STACK INTERVIEW            (deterministic; questions.yaml)
          archetype-first → archetype-scoped stack Qs → answers map
              │  no LLM. AskUserQuestion only for enumerated selects.
              ▼
 STAGE 1  MANIFEST DRAFT (pre-design)            (deterministic; lib/manifest.mjs)
          assemble managed: MINUS design tokens → validate → (no hash yet)
              │  This is the archetype oracle the LLM stage needs.
              ▼
╔═════════ STAGE 2  THE INTENT / "SPEC AUTHOR" PHASE  (LLM ISLAND) ═════════╗
║  2a  DISCOVERY INTERVIEW   narrative; spec-questions.yaml + NEW design     ║
║      + plan + product banks (§2). AskUserQuestion + free-text.            ║
║  2b  LLM SYNTHESIS         author Class-A prose:                          ║
║        specs/PRD,ARCHITECTURE,DOMAIN,REQUIREMENTS,ROADMAP,NON-GOALS       ║
║        specs/DESIGN.md            (NEW — the product design spec)         ║
║        specs/PLAN.md             (NEW — the build plan)                   ║
║        CLAUDE.md House notes      (enriched)                              ║
║      + EMIT a tiny DETERMINISTIC sidecar: design tokens (brand hex →      ║
║        snake_case manifest tokens) + proposed first-contract scope.       ║
║      Class-A bytes are NOT in manifest_hash and never gate the render.   ║
╚═══════════════════════════════════════════════════════════════════════════╝
              │  sidecar.tokens (Class B input)  +  reviewed prose (Class A)
              ▼
 STAGE 3  MANIFEST FINALIZE                      (deterministic; lib/manifest.mjs)
          merge design_system.tokens from the sidecar → re-validate →
          compute manifest_hash LAST → write project.manifest.yaml
              │  manifest is now FROZEN for this run.
              ▼
 STAGE 4  DETERMINISTIC RENDER (zero-LLM)        (scripts/render.mjs)
          renderTree(managed) → scaffold + hooks + settings.json +
          design-system/ with tokens MATERIALIZED from manifest →
          rendered_files[] ledger written back. Byte-identical per I2.
```

**Where the LLM is:** Stage 2 only — and it touches **only Class-A prose** plus a
**small, schema-shaped, human-reviewed sidecar** of deterministic values. **Where
determinism is preserved:** Stages 0/1/3/4. The hash is computed *after* the sidecar
merges (Stage 3), so identical interview answers + identical reviewed tokens ⇒
identical `managed:` ⇒ identical scaffold (I2 intact). The LLM never writes a Class-B
byte; it *proposes* token values that a human confirms, and only then do they enter
`managed:` through the normal deterministic path.

**Critical sequencing nuance (and the honest reconciliation):** the manifest must
exist as a *draft* before Stage 2 because `/ack-spec` reads `managed.archetype` and the
stack as authoring context (`ack-spec.md` STEP 1). So "docs first" means **intent prose
is authored before the structural scaffold renders** (Stage 2 before Stage 4), not
before the manifest draft. The manifest draft (Stage 1) carries no behavior the user
sees — it is the cheap deterministic skeleton the LLM needs to know what kind of thing
it is describing. The user-visible promise — *you see and approve your specs, PLAN, and
design system before any code/scaffold is written* — holds exactly.

### 1.3 How this is wired (no new orchestration engine)

Two clean options, decided in §6. The recommended one (**Option A**):

- `create-ack` runs Stages 0/1/3/4 (it already runs 0/1/3 as one fused step and 4).
- Stage 2 stays the **`/ack-spec` command**, but the bootstrap **calls it as the
  headline, defaulted next step**, and `create-ack` runs Stage 1 *without* the design
  tokens and *defers* the `manifest_hash` + structural render until `/ack-spec` has
  produced the sidecar. In practice: `create-ack` writes a **provisional** manifest
  (hash over the token-free `managed:`), lays the spec SKELETONS + a "design pending"
  marker, and prints `/ack-spec` as **the required next step**; `/ack-spec` authors the
  prose, writes the sidecar, then **invokes the render finalize** (`/ack-init --finalize`
  or a re-run) which merges tokens, recomputes the hash, and renders the design-system
  with real tokens.

This keeps every existing test green (the provisional manifest is still schema-valid;
the re-run path is the existing idempotent `/ack-init` re-render) and adds the LLM
island without a new long-lived orchestrator.

### 1.4 The artifact set + quality bar (per generated doc)

| Artifact | Class | Producer | Quality bar (acceptance for "good") |
|---|---|---|---|
| `specs/PRD.md` | A | LLM (Stage 2) | Problem stated before solution; named personas with the job each hires the product for; vision = one outcome sentence; ≥3 success metrics each with a baseline + target; one north-star. No `${...}`, no fabricated stack. |
| `specs/ARCHITECTURE.md` | A | LLM | Boxes-and-arrows overview; each load-bearing decision has context→decision→rejected-alternatives→consequence; external integrations list direction + failure mode; ≥1 seeded ADR (`specs/adr/0002-*`). |
| `specs/DOMAIN.md` | A | LLM | Ubiquitous-language glossary (term→precise meaning); entities with attributes + relationships/cardinality; ≥3 named INV-NN invariants that map to acceptance + the first contract. |
| `specs/REQUIREMENTS.md` | A | LLM | Atomic numbered FR-NN (MoSCoW) + NFR-NN each with number+unit+verification; constraints; acceptance criteria as given/when/then seeded from invariants; traceability table. Reject "fast"/"secure". |
| `specs/ROADMAP.md` | A | LLM | Ordered phases MVP→GA each with a single completion outcome; MVP definition; risk register (likelihood/impact/mitigation); assumptions with a validation moment; open questions with owner + decide-by. |
| `specs/NON-GOALS.md` | A | LLM | Each exclusion tagged deferred-vs-never with rationale (the trade-off that makes it deliberate). |
| **`specs/DESIGN.md`** (NEW) | A | LLM | §4. Product visual + UX intent: platform/density/tone, brand palette rationale, key screens/flows, component inventory, a11y target (WCAG 2.2 AA floor or higher), and **design acceptance criteria** (DA-NN) that the gate can trace. Points at the materialized `design-system/` tokens. |
| **`specs/PLAN.md`** (NEW) | A | LLM | §5. The build plan: phase-by-phase deliverables tracing to FR/NFR + ROADMAP phases, the first-contract proposal (scope globs + acceptance), the test/validate gate per phase, and the explicit "specs lead, code follows" sequencing. |
| `CLAUDE.md` (pointer body) | B | renderer | §4 upgrade. Lean pointer; `@specs/*` imports incl. DESIGN.md + PLAN.md; design + requirements front-and-center; conditional design/MCP blocks. ≤ ~400 tokens of pointers. |
| `CLAUDE.md` (House notes) | A | LLM | Enriched from the interview: the one invariant reviewers must check, test command, deploy posture. A handful of lines. |
| `design_system.tokens` (sidecar) | B | LLM proposes → human confirms → deterministic merge | snake_case `^[a-z][a-z0-9_]*$` scalar tokens (schema already supports, `schema.json:150-155`). Materialized into `globals.css` + `theme.tokens.json` by the renderer. |
| `docs/contracts/C-001-*.contract.md` | A | LLM (existing `ack-spec` STEP 6) | Drafted from REQUIREMENTS acceptance + DOMAIN invariants; left at `status: draft`; never auto-approved. |

---

## 2. The interview design (eliciting enough to generate great artifacts)

The narrative bank `templates/interview/spec-questions.yaml` is already strong for
PRD/ARCHITECTURE/DOMAIN/REQUIREMENTS/ROADMAP/NON-GOALS (vision, personas, use-cases,
non-goals, domain, decisions, NFRs, integrations, metrics, milestones, risks). It is
**archetype-agnostic** by design (its SCOPE NOTE). Two gaps versus the headline goal:
it asks **zero design/UX/brand questions**, and it has **no plan-shaping questions**.

### 2.1 NEW: a `## DESIGN & UX` section (additions to `spec-questions.yaml`)

These feed the new `specs/DESIGN.md` and, for `design_brand_color`, the deterministic
token sidecar. They are conversation scaffolding (no `writes_to`, no schema) except
`design_brand_color`, whose confirmed value becomes a manifest token in Stage 3.

| id | type | feeds | guidance |
|---|---|---|---|
| `design_platform` | multiselect (web, responsive-web, mobile-web, native-ish PWA) | `DESIGN.md#Platform & Targets` | Which surfaces ship in v1; drives breakpoint + density emphasis. |
| `design_product_kind` | select (marketing-site, data-dense-app, dashboard, content/editorial, design-system-as-product, mixed) | `DESIGN.md#Design Maturity` | Replaces today's binary install yes/no with intent: a marketing site and a data-dense app want different defaults. |
| `design_tone` | select (minimal/neutral, bold/expressive, warm/friendly, technical/precise, playful) | `DESIGN.md#Voice & Tone` | Maps to the `ui-design-system` style preset (modern/classic/playful) AND brand-guidelines voice. |
| `design_brand_color` | text (hex `#RRGGBB`) | `DESIGN.md#Brand Palette` **+ token sidecar** | The ONE deterministic design input. Confirmed hex → `design_system.tokens.color_brand`; renderer derives `globals.css` `:root`. Default `#0066CC` if skipped. |
| `design_density` | select (comfortable, compact, dense) | `DESIGN.md#Density` | 8pt vs 4pt base emphasis; reconciles the two design-stack scales (§4.3). |
| `design_key_screens` | list | `DESIGN.md#Key Screens & Flows` | The handful of screens that define the product; each a name + the job it does. |
| `design_components` | list | `DESIGN.md#Component Inventory` | The components v1 needs (table, form, chart, nav, modal…); seeds the shadcn copy-in list + DoD per component. |
| `design_references` | list | `DESIGN.md#References` | Competitor/aspirational products + what to borrow; keeps intent concrete. |
| `design_a11y_target` | select (WCAG 2.2 AA — floor, WCAG 2.2 AAA, plus motion/contrast prefs) | `DESIGN.md#Accessibility` | Becomes DA-NN acceptance; defaults to the AA floor already in `frontend-design-guidelines`. |

### 2.2 NEW: a `## PLAN & SEQUENCING` section

These feed the new `specs/PLAN.md`. Most reuse existing answers (milestones, MVP,
acceptance) — the new questions only add the *sequencing + first-slice* framing the
plan needs.

| id | type | feeds | guidance |
|---|---|---|---|
| `plan_first_slice` | longtext | `PLAN.md#First Slice` | The thinnest vertical slice that proves the thesis end-to-end; becomes phase 1 + the first contract scope. |
| `plan_sequencing` | list | `PLAN.md#Build Order` | Ordered build steps with the dependency reason for each ("auth before billing because…"). |
| `plan_validation_per_phase` | longtext | `PLAN.md#Validation Gates` | How each phase is proven done (the test/observe gate); mirrors `saas-scaffolder`'s validate-at-each-gate discipline. |
| `plan_contract_scope` | list | `PLAN.md#First Contract` **+ contract sidecar** | The globs the first slice touches; the LLM proposes `C-001-<slug>` scope from this (existing `ack-spec` STEP 6, now plan-anchored). |

### 2.3 Interview behavior

- **Archetype tailoring** (existing `ack-spec` STEP 3.3): the DESIGN section only
  fully fires for `fullstack` and the new `saas` archetype; for `backend-api`/SDK/IaC it
  is skipped or reduced to "N/A — no UI surface" and `DESIGN.md` is omitted. The PLAN
  section fires for every archetype.
- **Batch + reuse**: the interviewer batches related questions and reuses `--from` and
  earlier answers (existing discipline) so the human is not nickel-and-dimed.
- **The brand-color question is the ONLY one with a deterministic destination** — the
  command MUST surface the confirmed hex back to the user ("I'll set
  `design_system.tokens.color_brand: #0B5FFF`; the renderer will materialize your
  theme from it") so the human approves the one value that crosses into Class B.

---

## 3. The ARCHETYPE MATRIX expansion

This is the largest change and it mutates the **frozen contract**, so it is gated on a
deliberate `schema_version` bump.

### 3.0 The schema_version bump (frozen-contract migration note)

The manifest is `schema_version` **const 2** in lockstep across the contract and its
consumers. Adding the `saas` enum value, relaxing the design-system `if/then`, adding a
new managed `iac` object, and adding the `features.iac` toggle each mutate an
`additionalProperties:false` contract whose major is refused on mismatch. Therefore:

**Bump `schema_version` 2 → 3 in lockstep, in ONE commit, across:**

- `templates/manifest/project.manifest.schema.yaml` — `schema_version` block (`:58`),
  the I3 comment (`:36`), the header (`:2`).
- `templates/manifest/project.manifest.schema.json` — `const` + `description`
  (`:11-13`).
- `templates/interview/questions.yaml` — `schema_target: 2` → `3` (`:61`).
- `templates/interview/spec-questions.yaml` — header note if it cites the major.
- `lib/manifest.mjs` — the two hard-coded `schema_version: 2` literals (`:505`, `:524`)
  → `3`, and the `MANAGED_KEY_ORDER` list (`:46`+) to insert the new keys in canonical
  order.
- `scripts/manifest.test.mjs` + `scripts/render.test.mjs` — any `schema_version`
  assertion and the `I6: every archetype` loop (`manifest.test.mjs:203`) to include
  `saas`.
- **Consumer guards** that refuse a mismatched major: the contract-gate hook
  (`templates/archetypes/*/.claude/hooks/contract-gate`) and the telemetry aggregator
  (`telemetry/aggregate.py`) — bump their accepted major to 3.

**Migration note for existing v2 forks:** a v2 manifest is NOT auto-upgraded. `/ack-init`
re-run on a v2 child detects the major mismatch and either (a) refuses with a clear
"re-run with `--migrate`" message, or (b) under `--migrate`, rewrites `managed:` to v3
shape (new keys defaulted: `features.iac=false`, no `iac` block, `design_system`
unchanged) and recomputes the hash. The render is unaffected because the new keys
default to "off". This is a one-way, opt-in migration; document it in
`docs/BOOTSTRAP-CONFIG.md`.

### 3.1 (a) SaaS = Vercel + Next.js + React + shadcn + Supabase

**Design decision (recommended): `saas` is a NEW archetype enum value**, not a
fullstack flag. Rationale: archetype is the documented branch axis (I3); SaaS has a
materially different template tree (auth route groups, billing routes, Supabase client,
marketing + dashboard + auth layouts) than a generic fullstack app, and modeling it as
a flag would weaken the branch-axis model and scatter SaaS logic across `ask_if`
chains. The cost is one more deep tree to maintain — acceptable, and we reuse the
fullstack design-system payload wholesale (§3.1d). An existing
`templates/skills/saas-scaffolder/` skill already encodes the Next+shadcn+Drizzle+Stripe
defaults; we reconcile its stack toward Supabase (§3.1f).

**3.1a Schema changes** (both `schema.json` AND `schema.yaml`, additionalProperties:false
forces every new key to be declared or it is a hard validation error):

1. `managed.archetype.enum`: add `"saas"` → `["backend-api","fullstack","saas","monorepo","library-sdk","infra-iac"]` (`schema.json:64`, `schema.yaml:130-132`, I3 comment).
2. **design-system `allOf` if/then** (`schema.json:218-239`): the `if` for design-system
   REQUIRED must match archetype `in [fullstack, saas]`. Use
   `{"if":{"properties":{"archetype":{"enum":["fullstack","saas"]}},"required":["archetype"]},"then":{"required":["design_system"]}}`.
   The backend-api `design_system:false` branch is unchanged.
3. **New manifest fields SaaS needs that are not expressible today** — each declared in
   BOTH schema files under `managed:`:
   - `auth`: `{ provider: enum [supabase-auth, nextauth, clerk, none] }`.
   - `hosting`: `{ target: enum [vercel, netlify, fly, aws, gcp, none] }` (distinct from
     `ci_cd.target`, which is CI only).
   - `billing`: `{ provider: enum [stripe, lemonsqueezy, none] }`.
   - `persistence.db` enum: **add `"supabase"`** (`schema.json:84-87`) so Supabase is a
     first-class backend, OR map Supabase to `postgres` + record it via
     `auth.provider/hosting.target`. **Recommended:** add `supabase` to the `db` enum
     (clearest), and pair it with `orm` `drizzle|prisma|none` (no SQLAlchemy/GORM for
     SaaS). Document that `supabase` implies a managed Postgres.

**3.1b Interview branches** (`questions.yaml`; every `writes_to` MUST resolve to a
declared schema property or `/ack-init` hard-refuses, invariant I1):

- Add `{ value: saas, label: "SaaS web app (Vercel+Next+shadcn+Supabase) (deep)" }` to
  the archetype select (`:71-77`).
- Add a `framework_saas` select (or extend `framework_fullstack`'s `applies_to` to
  include `saas` and pin `next` as default). Recommended: a dedicated
  `framework_saas` pinned to `next` (React App Router) — the SaaS stack is opinionated
  on purpose.
- Add `applies_to:[saas]` questions writing the new fields:
  `auth_provider` → `auth.provider` (default `supabase-auth`);
  `hosting_target` → `hosting.target` (default `vercel`);
  `billing_provider` → `billing.provider` (default `stripe`).
- Extend `applies_to` lists on persistence + design-system questions to include `saas`
  (`:228,241,255,263,277,285,440,453`).
- Add SaaS rows to the per-archetype gate defaults
  (`gate_protected_paths_*`/`gate_scope_*`/`gate_exempt_*`): default protected
  `app/** lib/** db/** src/**`, scope `app/** db/**`, exempt
  `**/*.test.* **/*.stories.tsx supabase/migrations/** **/__snapshots__/**`.

**3.1c `_when.*` dirs + template tree** — new `templates/archetypes/saas/`:

```
templates/archetypes/saas/
  CLAUDE.md.tpl                         (the §4 upgraded pointer)
  .claude/settings.json.tpl
  .claude/hooks/contract-gate           (whole-file; gated by features.sdd_gate)
  .mcp.json.tpl                         (shadcn MCP; + Supabase MCP under #ack:if)
  docs/contracts/CONTRACT.template.md.tpl
  app/.gitkeep.tpl                       (App Router root; route groups documented)
  lib/.gitkeep.tpl
  _when.design_system.install/
    design-system/                       (REUSE the fullstack payload; §3.1d)
  _when.persistence.enabled/
    db/.gitkeep.tpl                       (Supabase client + schema location)
    supabase/.gitkeep.tpl
  _when.billing.has/                      (derived boolean; §3.3 on the bool grammar)
    app/api/webhooks/.gitkeep.tpl
```

The `_when.design_system.install/` and `_when.persistence.enabled/` guards already work
(path-segment grammar). Billing files use a **derived boolean** `billing.has`
(= `billing.provider != none`) because path-segment guards must be boolean (§3.3).

**3.1d Design-system reuse (no duplication):** the fullstack design-system subtree
(`_when.design_system.install/design-system/**` — OKLch theme, brand-guidelines,
frontend-design-guidelines, shadcn-ui skills, NOTICE) is reused verbatim for `saas`.
The cleanest mechanism given the per-archetype tree layout: **factor the design-system
payload into a shared template source** (e.g. `templates/shared/design-system/`) that
both the `fullstack` and `saas` walks include, OR keep it physically under each tree
and assert byte-equality in a test. **Recommended:** shared source + both archetype
walks reference it; this also fixes the materialized-tokens gap (§4) in one place.

**3.1e `render.map.yaml`:** the design-system rule (`:62-65`) has
`requires_archetype: fullstack`, which is a **loud-abort assertion**, not a selector
(render.mjs:384). It MUST accept `saas` too. Change `requires_archetype` from a scalar
to a **list** `[fullstack, saas]` (update `evalRenderMap` in `render.mjs:384` to accept
an array) OR relax it to `archetype in [fullstack, saas]`. Add SaaS-specific rules:
Supabase MCP `**/.mcp.json.tpl` already covered by `when: features.mcp` (the Supabase
server is line-gated by `#ack:if` inside); add a rule for any Supabase/Vercel
config files if introduced.

**3.1f Reconcile the existing `saas-scaffolder` skill + INDEX.md drift:** the skill
(`templates/skills/saas-scaffolder/SKILL.md`) defaults to Drizzle + NextAuth + Neon. Two
moves: (1) re-point its default stack to the kit's opinionated SaaS stack
(Supabase auth + Supabase Postgres + Drizzle, shadcn, Stripe, Vercel) so the skill and
the archetype agree; keep the swap-out CUSTOMIZATION.md. (2) `templates/skills/INDEX.md`
references archetypes `saas` (`:53`) and `scaffold` (`:104`) that were not in the enum;
adding `saas` to the enum resolves `:53`. `scaffold` is still a non-enum value — change
INDEX.md:104 to gate `spec-to-repo` on a **feature flag / greenfield flow**, not a
non-enum archetype, so a future `render.map` `requires_archetype: scaffold` cannot
loud-abort.

### 3.2 (b) fullstack + IaC with AWS | GCP

**Design decision (recommended): IaC is an ORTHOGONAL feature toggle, not an
archetype.** Archetype is single-valued, so "fullstack + IaC" cannot be one archetype.
Modeling IaC as `features.iac: bool` + an `iac` block lets ANY archetype add IaC
(backend-api+IaC, fullstack+IaC, saas+IaC) without a combinatorial archetype
explosion, and it matches the existing `features.*` pattern. `infra-iac` stays in the
enum as the "IaC IS the product" archetype (pure infra repo).

**3.2a Schema changes** (both files):

- Add `features.iac: boolean` to `managed.features` (`schema.json:66-76`; add to the
  `required` list or leave optional with default false — recommend optional/defaulted
  to keep the migration trivial).
- Add a NEW managed object `iac`:
  ```
  iac:
    type: object
    additionalProperties: false
    required: [provider, tool]
    properties:
      provider: { enum: [aws, gcp, none] }
      tool:     { enum: [terraform, pulumi, cloudformation, cdk, none] }
  ```
  Add an `allOf` if/then: `if features.iac == true then required: [iac]` (and a sane
  rule that `iac.provider != none` when `features.iac`).

**3.2b Interview branches** (`questions.yaml`):

- `feat_iac` (bool, `applies_to: [backend-api, fullstack, saas, monorepo, infra-iac]`,
  default false) → `features.iac`. (For `infra-iac` it defaults true.)
- `iac_provider` (select aws|gcp, `ask_if: "feat_iac == true"`) → `iac.provider`.
- `iac_tool` (select terraform|pulumi|cloudformation|cdk, `ask_if: "feat_iac == true"`)
  → `iac.tool`.
- Pull `terraform/** infra/**` into the protected-paths/exempt defaults for IaC-enabled
  archetypes (they already exist as options in `gate_protected_paths_core:358-360`).

**3.2c `_when.*` dirs + IaC's boolean constraint (called out explicitly):** the
path-segment guard grammar is `_when.<dotted.bool.path>/` and `render.map.yaml` `when`
is **boolean-only** (no equality, render.mjs evaluates truthiness). **Per-provider file
selection (aws vs gcp) is NOT a single boolean**, so we cannot write
`_when.iac.provider==aws/`. Two compliant mechanisms:

1. **Derived booleans in `managed:`** — `/ack-init` writes `iac.is_aws` / `iac.is_gcp`
   (derived from `iac.provider`) so the tree can use
   `_when.iac.is_aws/infra/aws/...` and `_when.iac.is_gcp/infra/gcp/...`. These derived
   keys must be **declared in the schema** (else additionalProperties:false rejects
   them). This is the cleanest, fully-deterministic path.
2. **Line-directive `#ack:if`** inside a single shared file for small per-provider
   differences — but `#ack:if` is also boolean-only, so it still needs the derived
   `iac.is_aws`/`iac.is_gcp` booleans.

**Recommendation: declare `iac.is_aws` and `iac.is_gcp` as derived booleans in the
schema and use path-segment guards.** This keeps provider selection inside the
deterministic conditional-inclusion layer (no new grammar). New tree:

```
templates/archetypes/<any-deep>/_when.features.iac/
  infra/
    _when.iac.is_aws/aws/.gitkeep.tpl        (e.g. main.tf / stacks)
    _when.iac.is_gcp/gcp/.gitkeep.tpl
    README.md.tpl                             (tool = ${iac.tool})
```

Since IaC is orthogonal, the `_when.features.iac/` subtree lives under each deep
archetype that opts in (or a shared source like the design-system, §3.1d) rather than
a dedicated tree.

### 3.3 Summary of the frozen-contract delta

| Change | schema.json | schema.yaml | questions.yaml | render.map.yaml | lib/manifest.mjs | tests |
|---|---|---|---|---|---|---|
| schema_version 2→3 | const+desc | block+I3+hdr | schema_target | — | two literals + key order | assertions |
| `saas` enum | `:64` | `:130-132`+`:36` | archetype select | `requires_archetype`→list | seed/branch logic | I6 loop |
| design-system `if` → `[fullstack,saas]` | `:218-239` | PER-ARCHETYPE block | applies_to lists | rule `:62-65` | design_system branch | fullstack+saas cases |
| `auth`/`hosting`/`billing` objects | new props | new props | 3 new selects | (mcp `#ack:if`) | assemble + order | new shape tests |
| `persistence.db += supabase` | `:84-87` | `:162` enum | persistence_db option | — | — | — |
| `features.iac` + `iac{provider,tool,is_aws,is_gcp}` | new props+allOf | new block+allOf | feat_iac+2 selects | — | assemble + derive bools | iac shape + matrix |

---

## 4. The child CLAUDE.md upgrade (design + requirements front-and-center)

The current `templates/CLAUDE.child.md.tmpl` is a genuinely good lean pointer, but its
design block (`:74-82`) appears only on `design_system.install` and merely says "honor
the tokens"; it points at house-rule skills, not at THIS product's design decisions,
and there is no requirements emphasis or pointer to a design spec (because none exists).
Upgrade, keeping it lean (token economy is the point — `ack-spec.md` STEP 5.3):

1. **Add the two new specs to the `@`-import block** (`:31-36`):
   ```
   @specs/REQUIREMENTS.md
   @specs/DESIGN.md          #ack:if design_system.install
   @specs/PLAN.md
   ```
   `DESIGN.md` is imported only when a design system is installed (fullstack/saas);
   `PLAN.md` and REQUIREMENTS are universal.
2. **Promote REQUIREMENTS in "How to work here"**: a numbered rule —
   "Before writing code, the relevant FR/NFR in `specs/REQUIREMENTS.md` and its
   acceptance criteria are your definition of done; the contract gate traces edits to
   them." Requirements move from a bullet to a load-bearing instruction.
3. **Rewrite the `## Design system` block** so it points at the **product** design spec
   first, then the house-rule skills:
   ```
   #ack:if design_system.install
   ## Design system & UX
   @specs/DESIGN.md
   @design-system/
   This product's visual + UX intent lives in `specs/DESIGN.md` (brand, key screens,
   density, a11y target, design acceptance DA-NN). The tokens are materialized in
   `design-system/theme/` from `design_system.tokens` — never introduce ad-hoc colors,
   spacing, or components outside the system. Honor the `brand-guidelines` /
   `frontend-design-guidelines` skills for HOW to apply them.
   #ack:endif
   ```
4. **Design acceptance linkage**: add a one-line pointer that design "done" is the
   DA-NN criteria in `specs/DESIGN.md` (focus-visible on every component, tokens-not-
   magic-numbers, WCAG AA verified) and, where a design path is protected, traces to a
   contract — closing the "design done is never gated" gap.
5. Keep the `---` / House notes split and the conditional `## MCP` block unchanged.

This template stays Class B (deterministic render); only the House-notes tail is
LLM-enriched.

---

## 5. PHASED, file-by-file implementation plan

Ordered so the frozen contract is never broken mid-flight and the three gates —
`npm test`, `scripts/lint-frontmatter.py`, the render smoke test (the
`render.test.mjs` T1–T6 acceptance set) — stay green after **every** phase. Baseline
today: **75 tests pass, linter 47 files / 0 errors** (verified).

### Phase A — Spec set: add DESIGN.md + PLAN.md (Class A, no contract change)

Lowest-risk, highest-headline-value, **zero schema impact**.

1. Add `templates/specs/DESIGN.md.tpl` and `templates/specs/PLAN.md.tpl` — skeletons
   with inline author-prompt comments, mirroring `REQUIREMENTS.md.tpl`'s style (atomic,
   numbered, with a traceability table). DESIGN.md carries DA-NN design acceptance.
2. Add the DESIGN/PLAN sections to `templates/interview/spec-questions.yaml` (§2.1, §2.2).
3. Update `.claude/commands/ack-spec.md` STEP 4 doc list + STEP 5 to author the two new
   docs (DESIGN gated on a design-bearing archetype) and to surface the brand-color
   token confirmation.
4. Upgrade `templates/CLAUDE.child.md.tmpl` per §4.
- **Gates:** `npm test` (Class-A templates render only when `framework`+`architecture`
  bound — DESIGN.md.tpl must use only bound vars or `#ack:if`, like the existing
  globals.css discipline, so `renderSpecsScaffold` never hits an unbound-var
  RenderError). `lint-frontmatter` (ack-spec.md is a command — keep its frontmatter
  legal). Render smoke test: add a case asserting DESIGN/PLAN render for fullstack.

### Phase B — Design-system materialization from manifest tokens (Class B)

Closes the `README.md.tpl` TODO(P4) and the "unbranded design system" gap, **still no
schema change** (`design_system.tokens` already exists).

5. Factor the design-system payload into a **shared source** (`templates/shared/
   design-system/`) referenced by the fullstack walk (and later saas) — OR keep in place
   and parameterize the OKLch `:root` from `${design_system.tokens.color_brand}` with a
   safe default. Make `globals.css.tpl` / `theme.tokens.json` substitute the brand token
   while preserving a concrete default (no unbound var).
6. Teach `/ack-spec` (or the finalize step) to write the confirmed `design_brand_color`
   into `design_system.tokens.color_brand` and trigger the deterministic re-render
   (Option A re-run, §1.3).
- **Gates:** render smoke test grows a token-materialization assertion (brand hex
  appears in rendered `globals.css`; absent token ⇒ default, never unbound).

### Phase C — schema_version 2→3 + the contract delta (the frozen-contract change)

This is the one phase that touches the frozen contract; do it as ONE atomic commit.

7. Apply §3.0 bump across all listed files.
8. Apply §3.1a/§3.2a schema changes (saas enum, design-system `if`, auth/hosting/billing,
   `persistence.db += supabase`, `features.iac` + `iac` block + derived bools).
9. Update `lib/manifest.mjs`: `MANAGED_KEY_ORDER`, `schema_version` literals, the saas
   design-system branch, derived `iac.is_aws`/`iac.is_gcp` emission, seeds.
10. Update consumer major guards (gate hook, `telemetry/aggregate.py`) + add the
    `--migrate` path to `/ack-init`.
- **Gates:** `npm test` — extend `manifest.test.mjs` I6 loop to include `saas`; add
  shape tests for auth/hosting/billing/iac; assert v3 byte-stability + hash determinism.
  This phase is RED until tests are updated in the same commit — that is expected and
  must not be split across commits.

### Phase D — Interview branches + SaaS template tree

11. Add the §3.1b SaaS questions + §3.2b IaC questions to `questions.yaml`; verify the
    I1 `writes_to` integrity (every new `writes_to` resolves to a v3 schema property).
12. Author `templates/archetypes/saas/` (§3.1c), reusing the shared design-system source.
13. Author the `_when.features.iac/` subtree (§3.2c) under each opting-in deep tree (or
    shared).
14. Update `templates/archetypes/render.map.yaml`: `requires_archetype` → list
    `[fullstack, saas]`; update `evalRenderMap` (`render.mjs:384`) to accept an array.
- **Gates:** render smoke test — add a `saas` branch-matrix case (design-system present,
  Supabase MCP gated, billing webhook present iff billing); add an `iac` matrix case
  (aws files vs gcp files by derived bool). `npm test` for the I1 integrity check.

### Phase E — Skill reconciliation + bootstrap wiring (Option A)

15. Reconcile `templates/skills/saas-scaffolder/SKILL.md` stack defaults + INDEX.md
    drift (§3.1f). Keep `lint-frontmatter` green (SKILL frontmatter: only
    name/description/license/allowed-tools).
16. Wire the FLOW (§1.3): `create-ack` writes the provisional (token-free) manifest +
    spec skeletons + "design pending" marker and prints `/ack-spec` as the required next
    step; `/ack-spec` authors prose + sidecar then invokes the finalize re-render.
- **Gates:** all three green; add a bootstrap-order test (provisional manifest is
  schema-valid; finalize re-run is idempotent and merges tokens).

### Phase ordering rationale

A and B ship user-visible value (specs + branded design) with **zero contract risk**.
C is the single contract-mutating commit, fully test-covered in the same commit. D/E
build on the new contract. At no phase boundary are all three gates red except the
intentional, same-commit RED→GREEN of Phase C.

---

## 6. Open decisions for the user

1. **Where does the LLM step live — inside `/ack-init` only, or also standalone
   `/ack-spec`?** Recommended: **keep both** (Option A, §1.3). `/ack-spec` stays the
   reusable, idempotent prose author (run it again any time intent changes);
   `create-ack`/`/ack-init` make it the headline, defaulted bootstrap step and own the
   deterministic finalize. The alternative — fold spec authoring *into* `/ack-init` so
   one command does everything — is simpler to explain but couples the deterministic
   manifest writer to the non-deterministic LLM island and makes re-authoring specs
   mean re-running init. **Decision needed:** accept Option A, or prefer the single
   fused command?

2. **How opinionated should the SaaS stack be?** Recommended: **strongly opinionated
   default, swappable at the edges** — Next.js App Router + React + shadcn + Supabase
   (auth + Postgres) + Drizzle + Stripe + Vercel, with `auth_provider`/`billing_provider`/
   `hosting_target` selects offering the documented alternatives (clerk/nextauth,
   lemonsqueezy/none, netlify/fly/aws/gcp). **Decision needed:** is Supabase-auth (vs
   Clerk) the default? Drizzle (vs Prisma) the default ORM for SaaS?

3. **`saas` as an archetype vs a fullstack flag** (§3.1). Recommended: new archetype
   (preserves the branch-axis model). **Decision needed:** accept the extra tree to
   maintain, or model SaaS as `fullstack` + a `saas` feature flag to avoid it?

4. **`supabase` as a `persistence.db` enum value vs map-to-postgres** (§3.1a). Recommended:
   add the enum value for clarity. **Decision needed:** add it, or keep `db: postgres` +
   record Supabase only via `hosting`/`auth`?

5. **IaC as orthogonal `features.iac` vs a `fullstack-iac` archetype** (§3.2). Strongly
   recommended: orthogonal toggle (avoids combinatorial archetype explosion; any
   archetype can add IaC). **Decision needed:** confirm orthogonal, or insist on
   dedicated combined archetypes?

6. **Provider selection mechanism for aws/gcp** (§3.2c): declare derived booleans
   `iac.is_aws`/`iac.is_gcp` in the schema (keeps the boolean-only guard grammar intact),
   vs introducing an equality operator into the conditional-inclusion layer (a larger,
   riskier engine change). Recommended: derived booleans. **Decision needed:** confirm.

7. **Determinism of the brand token**: the brand hex is the only design value crossing
   into Class B. Recommended: the LLM *proposes*, the human *confirms*, and only the
   confirmed value enters `managed:` — so identical confirmed answers still yield
   identical scaffolds (I2 intact). **Decision needed:** is a single confirmed
   `color_brand` enough for v1, or should more tokens (radius, font) be deterministic
   inputs from the start?

8. **Migration posture for existing v2 forks** (§3.0): one-way opt-in `--migrate` that
   defaults new keys to "off". **Decision needed:** is opt-in acceptable, or should
   re-run auto-migrate silently (riskier but smoother)?
