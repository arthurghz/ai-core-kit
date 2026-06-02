---
description: Author (or refresh) the moment-0 SPECS of an ai-core-kit CHILD project. Runs the deep, narrative discovery interview from templates/interview/spec-questions.yaml, then WRITES the filled Markdown specs into specs/ (PRD, ARCHITECTURE, DOMAIN, REQUIREMENTS, ROADMAP, NON-GOALS) and refreshes the lean child CLAUDE.md — all model-authored prose, idempotent via managed blocks. This emits CONTEXT, not code. Run it in a forked CHILD repo after create-ack/ack-init, before the first contract gate. Never run in the ai-core-kit META repo.
argument-hint: "[--from <prd-or-spec-path>] [--only <doc[,doc...]>] [--review] [--non-interactive --answers <file.yaml>]"
allowed-tools: Read, Write, Edit, Bash(test *), Bash(ls *), Bash(cat project.manifest.yaml), AskUserQuestion
disable-model-invocation: true
---

# /ack-spec — author the moment-0 SPECS (specs lead, code follows)

You are running the ai-core-kit SPEC author. Your job: turn intent into the
project's **narrative source of truth** — the Markdown specs under `specs/` and the
lean child `CLAUDE.md`. This is **moment 2** of the bootstrap (after the manifest
exists, before the first contract is approved).

> **You emit CONTEXT, not boilerplate code.** The kit's whole thesis is that the
> highest-leverage artifact at moment-0 is *well-structured intent* — specs the
> model reads on every future turn — not generated scaffolding. Write prose, fill
> tables, name invariants. Do NOT generate application code, frameworks, or files
> the specs do not call for. Code comes later, downstream of an approved contract.

> Command name: this is `/ack-spec`, distinct from `/ack-init` (which owns the
> deterministic MANIFEST) and the built-in `/init`. `/ack-init` writes the machine
> source of truth (`project.manifest.yaml`); `/ack-spec` writes the human source of
> intent (`specs/`). They are complementary: the manifest is the *stack*, the specs
> are the *why/what*. Never write or mutate `project.manifest.yaml` here.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--from <path>` — seed the interview from an existing PRD / requirements doc.
  Read it FIRST and pre-fill every answer you can; only ask about real gaps.
- `--only <doc[,doc...]>` — author only the named spec docs (e.g. `PRD,DOMAIN`).
  Doc names are the spec basenames without extension. Default: all applicable.
- `--review` — do not interview; re-read the current specs and report what is still
  a skeleton / stale / contradictory, then stop. No writes.
- `--non-interactive` — QA / CI mode. No AskUserQuestion calls. Requires `--answers`.
- `--answers <path>` — answers file (YAML) keyed by `spec-questions.yaml` ids.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed, runs before anything else)

This command ships *inside* the ai-core-kit META repo but must only ever EXECUTE in
a forked CHILD. Refuse if EITHER sentinel is present in the project root:

- `templates/archetypes/` directory exists, OR
- `docs/BOOTSTRAP.md` exists.

Detect with bundled-safe checks (their output is injected before you act):

- templates/archetypes present? !`test -d "${CLAUDE_PROJECT_DIR}/templates/archetypes" && echo PRESENT || echo absent`
- docs/BOOTSTRAP.md present? !`test -f "${CLAUDE_PROJECT_DIR}/docs/BOOTSTRAP.md" && echo PRESENT || echo absent`

If EITHER reports `PRESENT`: **STOP IMMEDIATELY.** Write nothing. Print exactly:

> `/ack-spec refuses to run inside the ai-core-kit META repository`
> (sentinel detected: `templates/archetypes/` or `docs/BOOTSTRAP.md`). This command
> is meant to run in a forked CHILD project. Fork the kit and run create-ack /
> `/ack-init` first, then run `/ack-spec` from the child repo root.

Then end the turn. This guard is non-negotiable and has no override flag.

---

## STEP 1 — LOAD THE MANIFEST (read-only) + DETECT STATE

The manifest is the machine source of truth and the **archetype oracle**. Read it;
never mutate it.

- manifest present? !`test -f "${CLAUDE_PROJECT_DIR}/project.manifest.yaml" && echo PRESENT || echo absent`
- specs dir present? !`test -d "${CLAUDE_PROJECT_DIR}/specs" && ls "${CLAUDE_PROJECT_DIR}/specs" || echo "<<no specs/ dir>>"`

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
lay-down, or a hand-made repo), create the doc set yourself from the kit's intent:
the six docs are `PRD.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `REQUIREMENTS.md`,
`ROADMAP.md`, `NON-GOALS.md` (+ an `adr/` dir for decision records).

---

## STEP 2 — MODE: --review, --from, or interview

Parse `$ARGUMENTS` and pick the path:

- **`--review`**: read every spec under `specs/`, classify each section as
  `filled | skeleton | stale | contradictory`, and print a tight report (doc →
  section → status → one-line note). Make NO writes. End the turn. This is the
  pre-gate sanity check.
- **`--from <path>`**: Read the referenced PRD/spec FIRST. Map its content onto the
  `spec-questions.yaml` fields; pre-fill every answer it covers. Then interview ONLY
  the genuine gaps (do not re-ask what the document already answers).
- **`--non-interactive`** (QA): you MUST NOT call AskUserQuestion. `--answers` is
  REQUIRED; take every answer from it. Any question with no answer is left as its
  skeleton prompt (never invent facts in CI).
- otherwise **interactive**: run the discovery interview (STEP 3).

---

## STEP 3 — RUN THE DISCOVERY INTERVIEW (narrative, model-led)

Load `templates/interview/spec-questions.yaml` — the **moment-0 discovery bank**.
It is the SPEC-domain interview and is deliberately distinct from the manifest bank
(`questions.yaml`): it has **no `writes_to`**, no schema, no determinism guarantee.
Each question carries `prompt`, `type` (`text|longtext|list|select|multiselect`),
optional `options`, a `feeds` pointer (`<DOC>.tpl#<Section>`), and `guidance`.

Conduct the interview like a thoughtful product+architecture partner:

1. Walk the bank in order (vision → users → use-cases → non-goals → domain →
   architecture → constraints/NFRs → integrations → metrics → milestones → risks).
2. For `select`/`multiselect` questions, prefer **AskUserQuestion** (the enumerated
   `options` are the choices; always allow a free-text `Other`). For `text`/
   `longtext`/`list`, ask open-ended — batch related questions so the human is not
   nickel-and-dimed, and use their `--from` document / earlier answers to avoid
   re-asking. Use `guidance` to judge how deep to probe and what a good answer holds.
3. **Tailor by archetype** (from `managed.archetype`): an SDK's "users" are
   integrating developers; IaC's "domain entities" are resources/modules; a
   library has consumers, not personas. The questions are universal; the emphasis
   is yours to set. Skip a line of questioning only when it is genuinely N/A for the
   archetype — and say so, rather than fabricating an answer.
4. You are the **synthesiser**: terse human answers become well-formed spec prose.
   Never paste raw answers; turn them into the document each `feeds` names.

---

## STEP 4 — AUTHOR THE FILLED SPECS (model-authored Markdown)

Now write the specs. Each doc under `specs/` is a SKELETON whose every section
carries an inline `<!-- ... -->` author prompt describing exactly what belongs
there. Your task is to **replace the prompts with real prose while preserving the
headings** (other specs, the CLAUDE.md, and the contract gate link to these headings
by name — renaming or dropping a heading breaks those links).

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
- **`specs/ROADMAP.md`** — phases/milestones (MVP → … → GA), the MVP definition,
  risks & mitigations, assumptions, and technical open questions.
- **`specs/NON-GOALS.md`** — what is explicitly OUT of scope and WHY (deferred vs.
  never), with the rationale that keeps the contract gate honest.

Authoring rules:

- **Honor `--only`**: when set, write only the named docs; leave the rest untouched.
- **Surgical, idempotent edits.** Prefer `Edit` to replace a single section's prompt
  with its prose. Keep every heading. Never reorder or delete sections. On a REFRESH,
  enrich existing prose; do not regress a human's words.
- **Be concrete.** Name real personas, real metrics with baselines/targets, real
  invariants. "Improve engagement" / "fast" / "secure" are not specs — give numbers,
  units, and verification methods.
- **No `${...}` and no fabricated stack.** The renderer already substituted the
  manifest values (`${project.name}`, `${archetype}`, gate mode, etc.). You write
  narrative; never reintroduce `${...}` placeholders and never contradict the
  manifest's stack.
- **Cross-link, don't duplicate.** PRD points to REQUIREMENTS for functional detail,
  to NON-GOALS for exclusions, to ROADMAP for phasing, to DOMAIN for language. Keep
  each fact in one home.
- **Seed an ADR.** If `specs/adr/` exists and the architecture interview surfaced a
  load-bearing decision, write `specs/adr/0001-record-architecture-decisions.md`
  (the meta-ADR) if absent, then `specs/adr/0002-<slug>.md` for the most
  consequential decision (context → decision → alternatives rejected → consequences).

---

## STEP 5 — REFRESH THE LEAN CHILD CLAUDE.md (managed-block aware)

`CLAUDE.md` is the entry point Claude reads every turn. It must stay a **lean
pointer** to the specs + contracts, not a knowledge dump. Its shape is the kit's
child template `templates/CLAUDE.child.md.tmpl`, which has two regions split by a
`---` rule and a "House notes" heading:

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

If `CLAUDE.md` does not exist (e.g. a minimal-core scaffold that skipped the
lay-down), author it fresh in this same lean, spec-first shape.

If a `.claude/conventions.md` is referenced but absent, you MAY seed a short stub
(commit format, review checklist, naming) — this is convention CONTEXT, still not code.

---

## STEP 6 — PROPOSE THE FIRST CONTRACT (optional, from the filled specs)

The specs are the source the first contract is drawn from. If the project has a
contract gate (`managed.features.sdd_gate: true`) and no approved contract yet:

- Read `docs/contracts/CONTRACT.template.md` for the contract shape.
- Draft `docs/contracts/C-001-<project-slug>.contract.md` with `status: draft`:
  a scope (globs the first slice touches, tracing to REQUIREMENTS.md), the interface
  + invariants (from DOMAIN.md), and acceptance (from REQUIREMENTS.md acceptance).
- Leave it at `status: draft`. Tell the user that a human must review and set it to
  `approved` before the gate will permit edits under the protected paths. Do NOT
  flip a contract to `approved` yourself, and do NOT edit `project.manifest.yaml`.

---

## STEP 7 — SUMMARIZE + NEXT STEPS

Print a concise summary:
- which spec docs you authored vs. enriched vs. left as skeleton (and why),
- whether `CLAUDE.md` was created or its managed block refreshed,
- whether an ADR and/or `C-001` contract was seeded,
- the **next steps**: review the specs, get `C-001` approved, then implement against
  the spec (specs lead, code follows). If the stack later changes, re-run `/ack-init`
  to re-render the manifest-derived scaffold; re-run `/ack-spec` to keep the specs
  current. Both are idempotent.

---

## QA / NON-INTERACTIVE MODE (answers-file, for CI)

User-invoked slash commands are unavailable under `claude -p`, so QA inlines this
task and feeds an answers file keyed by `spec-questions.yaml` ids:

```bash
cat spec-answers.yaml | claude -p "Author this ai-core-kit child's specs \
  non-interactively from the piped answers. Follow .claude/commands/ack-spec.md \
  steps 0-7. Do not ask questions; leave unanswered sections as their skeleton \
  prompt." --allowedTools "Read,Write,Edit,Bash" --permission-mode acceptEdits
```

In this mode you MUST NOT call AskUserQuestion. The META-repo guard, the
read-only treatment of `project.manifest.yaml`, and the heading-preserving,
idempotent edit discipline from STEPS 0/4/5 all apply unchanged. Never fabricate
facts to fill a section in CI — an unanswered section stays a skeleton.
