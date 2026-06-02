---
description: Author (or refresh) this project's moment-0 SPECS. Runs a deep, narrative discovery interview, then WRITES the filled Markdown specs into specs/ (PRD, ARCHITECTURE, DOMAIN, REQUIREMENTS, PLAN, ROADMAP, NON-GOALS — plus DESIGN for design-bearing archetypes) and refreshes the lean CLAUDE.md — all model-authored prose, idempotent via managed blocks. Emits CONTEXT, not code. Run once after create-ack / ack-init, before the first contract gate.
argument-hint: "[--from <prd-or-spec-path>] [--only <doc[,doc...]>] [--review] [--non-interactive --answers <file.yaml>]"
allowed-tools: Read, Write, Edit, Glob, Bash(ls:*), AskUserQuestion
disable-model-invocation: true
---

# /ack-spec — author the moment-0 SPECS (specs lead, code follows)

You are running this project's SPEC author. Your job: turn intent into the
project's **narrative source of truth** — the Markdown specs under `specs/` and the
lean `CLAUDE.md`. This is **moment 2** of the bootstrap (after the manifest exists,
before the first contract is approved).

> **You emit CONTEXT, not boilerplate code.** This repo's whole thesis is that the
> highest-leverage artifact at moment-0 is *well-structured intent* — specs the
> model reads on every future turn — not generated scaffolding. Write prose, fill
> tables, name invariants. Do NOT generate application code, frameworks, or files
> the specs do not call for. Code comes later, downstream of an approved contract.

> Command name: this is `/ack-spec`, distinct from `/ack-init` (which owns the
> deterministic MANIFEST) and the built-in `/init`. `/ack-init` writes the machine
> source of truth (`project.manifest.yaml`); `/ack-spec` writes the human source of
> intent (`specs/`). They are complementary: the manifest is the *stack*, the specs
> are the *why/what*. Never write or mutate `project.manifest.yaml` here.

> **Terminal entry (CLI).** `create-ack spec` is the CLI's terminal entry into this
> exact authoring flow: it launches Claude Code and runs this command. The behavior
> is identical whether you typed `/ack-spec` in Claude Code or `create-ack spec` in a
> shell — this file is the single source of the procedure. The always-available
> `spec-first` skill is the surrounding *method*; this command is the *action*.

> **Where `/ack-spec` sits in the spec-first bootstrap (the ordered flow).** This is
> the **REQUIRED, headline** step of the docs-first bootstrap — the LLM island between
> two deterministic bookends. The order is:
>
> 1. **interview + scaffold** — `create-ack` / `/ack-init` wrote the manifest + the
>    structural scaffold + spec SKELETONS + a `specs/.spec-status.md` "Specs: DRAFT"
>    marker. The design system, if installed, shows the DEFAULT brand for now.
> 2. **author (you are here)** — run the narrative interview and AUTHOR the complete
>    intent set BEFORE any code: the filled specs + PLAN + a best-in-class `CLAUDE.md`,
>    and — for design-bearing archetypes — CONFIRM the product's brand color (STEP 5.4),
>    recording it in `specs/DESIGN.md#Brand Palette`.
> 3. **finalize** — the user re-runs `/ack-init`, which merges the confirmed brand
>    token into `managed:` and re-renders the design system from it, deterministically.
>    You do NOT perform that merge or re-render here.
>
> Specs lead; code follows. Nothing downstream should write application code until the
> specs are authored and the first contract is reviewed.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--from <path>` — seed the interview from an existing PRD / requirements doc.
  Read it FIRST and pre-fill every answer you can; only ask about real gaps.
- `--only <doc[,doc...]>` — author only the named spec docs (e.g. `PRD,DOMAIN`).
  Doc names are the spec basenames without extension. Default: all applicable.
- `--review` — do not interview; re-read the current specs and report what is still
  a skeleton / stale / contradictory, then stop. No writes.
- `--non-interactive` — QA / CI mode. No AskUserQuestion calls. Requires `--answers`.
- `--answers <path>` — answers file (YAML) keyed by the discovery question ids.

Raw arguments: `$ARGUMENTS`

---

## STEP 1 — LOAD THE MANIFEST (read-only) + DETECT STATE

The manifest is the machine source of truth and the **archetype oracle**. Read it;
never mutate it. Detect state with your TOOLS — do NOT embed shell command-substitution
in this prompt. Paths are relative to the project root (your working directory):

- **Manifest** — use the **Read** tool on `project.manifest.yaml`. A "file not found"
  result means the manifest is ABSENT (handle per item 1 below); otherwise parse it.
- **Specs** — use **Glob** (`specs/*`) or `ls specs` (Bash) to see whether spec docs
  already exist (this is what distinguishes a first author from a REFRESH).
- **Discovery bank** — use **Read**/**Glob** to look for the narrative question set at
  `.claude/interview/spec-questions.yaml`, then `specs/.discovery/spec-questions.yaml`
  (STEP 3 covers the fallback when neither exists).

1. If the manifest is **absent**, STOP and instruct the user to scaffold first:
   > No `project.manifest.yaml` found. Run `create-ack` (new repo) or `/ack-init`
   > (existing) to write the manifest, then re-run `/ack-spec`.
2. Read `project.manifest.yaml`. Extract `managed.archetype` (the branch axis),
   `managed.project.*` (name, description, language, framework, architecture),
   `managed.contract_gate.*`, and `managed.features.*`. These are CONTEXT for your
   authoring — they are already substituted into the spec skeletons by the renderer,
   so do not re-derive the stack; author the *intent* on top of it.
3. **Re-entrancy**: if `specs/` already holds filled docs, this is a REFRESH. Treat
   any prose a human wrote as authoritative — you ENRICH and RECONCILE, you do not
   clobber. The skeletons carry inline `<!-- ... -->` author prompts; a section that
   still contains only its prompt is unfilled and is yours to write. A section with
   real prose is reviewed-and-improved, never silently overwritten.

If `specs/` does not exist yet (e.g. a minimal-core scaffold that skipped the spec
lay-down, or a hand-made repo), create the doc set yourself from the project's intent:
the universal docs are `PRD.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `REQUIREMENTS.md`,
`PLAN.md`, `ROADMAP.md`, `NON-GOALS.md` (+ an `adr/` dir for decision records), plus
`DESIGN.md` for the design-bearing archetypes (`fullstack`, `saas`) only.

---

## STEP 2 — MODE: --review, --from, or interview

Parse `$ARGUMENTS` and pick the path:

- **`--review`**: read every spec under `specs/`, classify each section as
  `filled | skeleton | stale | contradictory`, and print a tight report (doc →
  section → status → one-line note). Make NO writes. End the turn. This is the
  pre-gate sanity check.
- **`--from <path>`**: Read the referenced PRD/spec FIRST. Map its content onto the
  discovery questions; pre-fill every answer it covers. Then interview ONLY the
  genuine gaps (do not re-ask what the document already answers).
- **`--non-interactive`** (QA): you MUST NOT call AskUserQuestion. `--answers` is
  REQUIRED; take every answer from it. Any question with no answer is left as its
  skeleton prompt (never invent facts in CI).
- otherwise **interactive**: run the discovery interview (STEP 3).

---

## STEP 3 — RUN THE DISCOVERY INTERVIEW (narrative, model-led)

Load the project's **moment-0 discovery bank** — the narrative, free-text question
set that drives this interview. Look for it, in order, at:

- `.claude/interview/spec-questions.yaml` (rendered by `/ack-init`), or
- `specs/.discovery/spec-questions.yaml` (alternate lay-down).

If neither exists, conduct the interview from the doc set's own section prompts
instead (each `specs/*.md` skeleton's inline `<!-- ... -->` prompts ARE the question
bank of last resort) — never block on a missing file.

The discovery bank is the SPEC-domain interview and is deliberately distinct from the
manifest bank: it has **no `writes_to`**, no schema, no determinism guarantee. Each
question carries `prompt`, `type` (`text|longtext|list|select|multiselect`), optional
`options`, a `feeds` pointer (`<DOC>#<Section>`), and `guidance`.

Conduct the interview like a thoughtful product+architecture partner:

1. Walk the bank in order (vision → users → use-cases → non-goals → domain →
   architecture → constraints/NFRs → integrations → metrics → milestones → risks →
   **DESIGN & UX** → **PLAN & SEQUENCING**). The `DESIGN & UX` section feeds
   `specs/DESIGN.md` and the `PLAN & SEQUENCING` section feeds `specs/PLAN.md`.
2. For `select`/`multiselect` questions, prefer **AskUserQuestion** (the enumerated
   `options` are the choices; always allow a free-text `Other`). For `text`/
   `longtext`/`list`, ask open-ended — batch related questions so the human is not
   nickel-and-dimed, and use their `--from` document / earlier answers to avoid
   re-asking. Use `guidance` to judge how deep to probe and what a good answer holds.
3. **Tailor by archetype** (from `managed.archetype`): an SDK's "users" are
   integrating developers; IaC's "domain entities" are resources/modules; a
   library has consumers, not personas. The questions are universal; the emphasis
   is yours to set. Skip a line of questioning only when it is genuinely N/A for the
   archetype — and say so, rather than fabricating an answer. **The `DESIGN & UX`
   section is the one with hard archetype gating**: fire it fully only for the
   design-bearing archetypes (`fullstack`, `saas`); for `backend-api`,
   `library-sdk`, `infra-iac` (and a `monorepo` with no UI surface), skip it and
   record `N/A — no UI surface` instead of authoring `specs/DESIGN.md`. The
   `PLAN & SEQUENCING` section fires for every archetype.
4. You are the **synthesiser**: terse human answers become well-formed spec prose.
   Never paste raw answers; turn them into the document each `feeds` names.

---

## STEP 4 — AUTHOR THE FILLED SPECS (model-authored Markdown)

Now write the specs. Each doc under `specs/` is a SKELETON whose every section
carries an inline `<!-- ... -->` author prompt describing exactly what belongs
there. Your task is to **replace the prompts with real prose while preserving the
headings** (other specs, the CLAUDE.md, and the contract gate link to these headings
by name — renaming or dropping a heading breaks those links).

> **API-CONTRACT-FIRST (when `managed.api_first: true`).** The API is the product's
> primary contract with its consumers, so author it **FIRST** — right after the
> interview, before the rest of the spec set is fleshed out. In order:
> 1. **Pin the API surface** in `specs/REQUIREMENTS.md` (each endpoint/operation as an
>    FR-NN with request/response shapes + error contracts + auth) and in
>    `specs/ARCHITECTURE.md` (the boundary + data flow), drawing the invariants from
>    `specs/DOMAIN.md`.
> 2. **Populate the machine-readable interface** the archetype ships — e.g.
>    `openapi/openapi.yaml` — with those operations + schemas (this IS context, not app
>    code: it is the agreed interface, the thing every later slice traces to).
> 3. **Draft the first contract** so its scope pins that API surface (STEP 6, brought
>    forward): `docs/contracts/C-001-*` with the API operations as its interface +
>    invariants + acceptance. The interface is agreed and gate-bound FIRST.
>
> THEN author the remaining items (NFRs, the rest of ARCHITECTURE/DOMAIN, PLAN, ROADMAP,
> NON-GOALS, DESIGN). Specs still lead code — this only orders the **API contract to the
> front** of the authoring. For non-API projects (`api_first` false), author in the
> normal doc order below.

Doc set and what each holds (see each file's own header comment for the contract):

- **`specs/PRD.md`** — the product: problem, vision, why-now, personas, goals &
  success metrics (with a north-star), scope pointers, open product questions.
- **`specs/ARCHITECTURE.md`** — system shape: overview, key decisions (each a
  candidate ADR), external integrations, data flow, boundaries.
- **`specs/DOMAIN.md`** — entities, relationships, the ubiquitous-language glossary,
  and the **invariants that must never break** (these become the strongest
  acceptance + contract clauses).
- **`specs/REQUIREMENTS.md`** — numbered functional requirements (FR-NN), numbered
  non-functional requirements (NFR-NN, each with a measurable target + verification),
  constraints, and the testable acceptance criteria.
- **`specs/DESIGN.md`** — the product's visual + UX intent (from the DESIGN & UX
  interview): platform/density/tone, the brand palette + its rationale, key screens
  & flows, the component inventory, the a11y target, and **design-acceptance
  criteria (DA-NN)** the gate can trace. Points at the materialised
  `design-system/` tokens. **GATED**: author it ONLY for the design-bearing
  archetypes (`managed.archetype` ∈ {`fullstack`, `saas`}). For a no-UI archetype
  (`backend-api`, `library-sdk`, `infra-iac`, or a `monorepo` with no UI surface),
  do NOT fabricate a design — write a single line, `N/A — no UI surface`, or omit
  the doc entirely. Never invent screens or a palette where there is no product UI.
- **`specs/PLAN.md`** — the build plan (from the PLAN & SEQUENCING interview):
  phase-by-phase deliverables tracing to FR/NFR + the ROADMAP phases, the thinnest
  first vertical slice, the validation gate per phase, the explicit "specs lead,
  code follows" sequencing, and the first-contract proposal (scope globs +
  acceptance) that STEP 6 turns into `C-001-<slug>`. Authored for **every**
  archetype — a plan is universal.
- **`specs/ROADMAP.md`** — phases/milestones (MVP → … → GA), the MVP definition,
  risks & mitigations, assumptions, and technical open questions.
- **`specs/NON-GOALS.md`** — what is explicitly OUT of scope and WHY (deferred vs.
  never), with the rationale that keeps the contract gate honest.

Authoring rules:

- **Honor `--only`**: when set, write only the named docs; leave the rest untouched.
- **Surgical, idempotent edits.** Prefer `Edit` to replace a single section's prompt
  with its prose. Keep every heading. Never reorder or delete sections. On a REFRESH,
  enrich existing prose; do not regress a human's words. If the skeletons carry
  managed-block markers (e.g. `<!-- ack:managed ... -->`), edit only INSIDE them and
  leave the markers in place — that is what keeps re-runs idempotent.
- **Be concrete.** Name real personas, real metrics with baselines/targets, real
  invariants. "Improve engagement" / "fast" / "secure" are not specs — give numbers,
  units, and verification methods.
- **No `${...}` and no fabricated stack.** The renderer already substituted the
  manifest values (`${project.name}`, `${archetype}`, gate mode, etc.) into the
  skeletons. You write narrative; never reintroduce `${...}` placeholders and never
  contradict the manifest's stack.
- **Cross-link, don't duplicate.** PRD points to REQUIREMENTS for functional detail,
  to NON-GOALS for exclusions, to ROADMAP for phasing, to DOMAIN for language. Keep
  each fact in one home.
- **Seed an ADR.** If `specs/adr/` exists and the architecture interview surfaced a
  load-bearing decision, write `specs/adr/0001-record-architecture-decisions.md`
  (the meta-ADR) if absent, then `specs/adr/0002-<slug>.md` for the most
  consequential decision (context → decision → alternatives rejected → consequences).

---

## STEP 5 — REFRESH THE LEAN CLAUDE.md (managed-block aware)

`CLAUDE.md` is the entry point Claude reads every turn. It must stay a **lean
pointer** to the specs + contracts, not a knowledge dump. It has two regions split by
a `---` rule and a "House notes" heading:

1. The **pointer body** (everything above the `---`) — project header, "how to work
   here", the `@specs/*` and `@docs/contracts/` pointers, the contract-gate posture
   (mode + protected paths from the manifest), and conditional design-system / MCP
   pointers — is **kit-shaped**. `create-ack`/`/ack-init` render it from the manifest;
   keep its structure and the `@`-imports intact. Refresh stale pointers if the spec
   set or gate posture changed; do not turn it into a knowledge dump.
2. The **House notes** section below the `---` is the human's (and your) territory:
   a handful of project-specific reminders — the one invariant reviewers must always
   check, how to run tests, the deploy posture. Enrich it from the interview; keep it
   short; deep material lives in `specs/` and `.claude/skills/`. Never bloat it.
3. Do NOT inline spec content into CLAUDE.md. Token economy is the point: CLAUDE.md
   is a few hundred tokens of pointers; the @-imports pull the specs in on demand.
4. **Surface the brand-colour token for approval** (design-bearing archetypes only —
   `managed.archetype` ∈ {`fullstack`, `saas`}). The brand color is the ONE discovery
   answer with a deterministic destination: its confirmed hex becomes the manifest
   token `design_system.tokens.color_brand`, from which the renderer materialises the
   theme. Because it is the only design value that crosses from model-authored prose
   into the deterministic scaffold, you MUST surface it back to the human verbatim and
   get an explicit confirmation, e.g.:

   > I'll set `design_system.tokens.color_brand: #0B5FFF`; the renderer materialises
   > your theme (`design-system/theme/`, `globals.css` `:root`) from it. Confirm or
   > give a different hex.

   Use `#0066CC` as the default if the human skipped or declined the question. Record
   the confirmed value in `specs/DESIGN.md#Brand Palette` — that is where the FINALIZE
   re-render reads it from. Do NOT write `project.manifest.yaml` yourself in this
   command (STEP 1's read-only rule stands): the confirmed token is merged into
   `managed:` by the deterministic FINALIZE re-render (`/ack-init`), which recomputes
   the hash and re-materialises `design-system/theme/` from the confirmed hex. Your
   job here is only to elicit and CONFIRM the value and record it in DESIGN.md; then
   tell the user (STEP 7) to re-run `/ack-init` to finalize.

If `CLAUDE.md` does not exist (e.g. a minimal-core scaffold that skipped the
lay-down), author it fresh in this same lean, spec-first shape.

If a `.claude/conventions.md` is referenced but absent, you MAY seed a short stub
(commit format, review checklist, naming) — this is convention CONTEXT, still not code.

---

## STEP 6 — PROPOSE THE FIRST CONTRACT (the API contract leads when api_first)

The specs are the source the first contract is drawn from. **When `managed.api_first`
is true, do this step FIRST (per STEP 4's API-contract-first ordering) — the C-001 you
draft here is the API contract, authored before the rest of the spec set.** If the
project has a contract gate (`managed.features.sdd_gate: true`) and no approved contract yet:

- Read `docs/contracts/CONTRACT.template.md` for the contract shape.
- Draft `docs/contracts/C-001-<project-slug>.contract.md` with `status: draft`:
  a scope (the globs the first slice touches — anchored on `specs/PLAN.md#First
  Contract` and tracing to REQUIREMENTS.md), the interface + invariants (from
  DOMAIN.md), and acceptance (from REQUIREMENTS.md acceptance + PLAN.md validation
  gates).
- Leave it at `status: draft`. Tell the user that a human must review and set it to
  `approved` before the gate will permit edits under the protected paths. Do NOT
  flip a contract to `approved` yourself, and do NOT edit `project.manifest.yaml`.

---

## STEP 7 — SUMMARIZE + NEXT STEPS

Print a concise summary:
- which spec docs you authored vs. enriched vs. left as skeleton (and why),
- whether `CLAUDE.md` was created or its managed block refreshed,
- whether an ADR and/or `C-001` contract was seeded,
- the **next steps**, in order:
  1. **FINALIZE the design system** — for design-bearing archetypes where you
     confirmed a brand color, tell the user to re-run **`/ack-init`** now: it merges
     the confirmed `design_system.tokens.color_brand` (from `specs/DESIGN.md#Brand
     Palette`) into `managed:` and re-materialises `design-system/theme/` from it,
     idempotently. This is the deterministic close of the loop.
  2. **review the specs** and get `C-001` approved (`status: draft -> approved`) so the
     contract gate will permit edits under the protected paths.
  3. **implement against the spec** (specs lead, code follows).
  If the stack later changes, re-run `/ack-init` to re-render the manifest-derived
  scaffold; re-run `/ack-spec` to keep the specs current. Both are idempotent.

---

## QA / NON-INTERACTIVE MODE (answers-file, for CI)

User-invoked slash commands are unavailable under `claude -p`, so QA inlines this
task and feeds an answers file keyed by the discovery question ids:

```bash
cat spec-answers.yaml | claude -p "Author this project's specs non-interactively \
  from the piped answers. Follow .claude/commands/ack-spec.md steps 1-7. Do not ask \
  questions; leave unanswered sections as their skeleton prompt." \
  --allowedTools "Read,Write,Edit,Bash" --permission-mode acceptEdits
```

In this mode you MUST NOT call AskUserQuestion. The read-only treatment of
`project.manifest.yaml` and the heading-preserving, idempotent edit discipline from
STEPS 1/4/5 all apply unchanged. Never fabricate facts to fill a section in CI — an
unanswered section stays a skeleton.
