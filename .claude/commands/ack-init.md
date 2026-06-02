---
description: Scaffold (or safely re-scaffold) an ai-core-kit CHILD project from this kit. Asks the archetype first, runs an archetype-scoped interview, writes project.manifest.yaml (the single source of truth), renders the template set, and wires opt-in hooks/MCP/telemetry/discovery. Re-entrant and idempotent via managed-block merge. Run this in a forked CHILD repo, never in the ai-core-kit META repo.
argument-hint: "[--non-interactive] [--answers <answers-file.yaml>] [--archetype <name>] [--migrate] [--force|--skip]"
allowed-tools: Read, Write, Edit, Bash(yq *), Bash(jq *), Bash(git rev-parse *), Bash(git config *), Bash(test *), Bash(ls *), Bash(cat project.manifest.yaml), Bash(sha256sum *), Bash(shasum *), AskUserQuestion
disable-model-invocation: true
---

# /ack-init — initialize an ai-core-kit CHILD project

You are running the ai-core-kit initializer. Your job: produce a valid
`project.manifest.yaml` (the SINGLE SOURCE OF TRUTH), render the template set
against it, wire the opted-in integrations, and emit a minimal child
`CLAUDE.md` pointer — all **idempotently** and **re-entrantly**.

> Command name: this is `/ack-init`, NOT `/init`. The built-in `init` skill owns
> `/init`; do not collide with it. Never delegate to the built-in init.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--non-interactive` — QA / CI mode. No AskUserQuestion calls. Requires `--answers`.
- `--answers <path>` — answers file (YAML) that fully specifies the interview.
- `--archetype <name>` — pre-select the branch axis, skipping the first question.
- `--migrate` — opt in to upgrading an EXISTING child manifest whose
  `schema_version` MAJOR is older than the current contract (e.g. v2 → v3). Without
  this flag a major-mismatched manifest is REFUSED, not silently rewritten. See
  STEP 1.5.
- `--force` — re-render conflict policy: overwrite ack-owned regions even if
  hand-edited inside the managed block (still never touches unmanaged files/regions).
- `--skip` — re-render conflict policy: keep existing on any conflict (CI default).

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed, runs before anything else)

This command ships *inside* the ai-core-kit META repo but must only ever EXECUTE
in a forked CHILD. Refuse if EITHER sentinel is present in the project root:

- `templates/archetypes/` directory exists, OR
- `docs/BOOTSTRAP.md` exists.

Detect with bundled-safe checks (these are dynamic-context preprocessing; their
output is injected before you act):

- templates/archetypes present? !`test -d "${CLAUDE_PROJECT_DIR}/templates/archetypes" && echo PRESENT || echo absent`
- docs/BOOTSTRAP.md present? !`test -f "${CLAUDE_PROJECT_DIR}/docs/BOOTSTRAP.md" && echo PRESENT || echo absent`

If EITHER reports `PRESENT`: **STOP IMMEDIATELY.** Write nothing. Render nothing.
Print exactly:

> `/ack-init refuses to run inside the ai-core-kit META repository`
> (sentinel detected: `templates/archetypes/` or `docs/BOOTSTRAP.md`). This
> command is meant to run in a forked CHILD project. Fork the kit first, then
> run `/ack-init` from the child repo root.

Then end the turn. This guard is non-negotiable and has no override flag.

---

## STEP 1 — DETECT MODE & RE-ENTRANCY STATE

1. **Mode**: parse `$ARGUMENTS`.
   - If `--non-interactive` is present, you are in **QA mode**: you MUST NOT call
     AskUserQuestion at all. `--answers <path>` is then REQUIRED; if missing,
     abort with: `--non-interactive requires --answers <file>`.
   - Otherwise you are in **interactive mode**: AskUserQuestion is permitted, and
     free-text follow-ups may also arrive via `$ARGUMENTS`.
   - NOTE on headless: a `/ack-init` slash command cannot be invoked by name under
     `claude -p`. QA mode is reached by *inlining this task* and piping the answers
     file on stdin; see "QA / NON-INTERACTIVE MODE" at the end.

2. **Re-entrancy probe**: does a manifest already exist?
   - manifest present? !`test -f "${CLAUDE_PROJECT_DIR}/project.manifest.yaml" && echo PRESENT || echo absent`
   - current manifest (if any): !`cat "${CLAUDE_PROJECT_DIR}/project.manifest.yaml" 2>/dev/null || echo "<<none>>"`

   If PRESENT this is a **RE-RUN**. You are in MERGE / idempotent territory:
   - Read the existing `managed.rendered_files` ledger — it is authoritative about
     what ack owns. Anything NOT listed there is USER TERRITORY and is off-limits.
   - The existing `user:` subtree is HUMAN-OWNED. You seed it ONCE on first run and
     NEVER overwrite it thereafter. Carry it through verbatim.
   - You will regenerate the entire `managed:` subtree from answers, recompute
     `managed.manifest_hash`, and only touch files via managed-block merge
     (see STEP 6). Never blind-overwrite.

---

## STEP 1.5 — MAJOR-VERSION GUARD + OPT-IN MIGRATION (`--migrate`)

The current contract is `schema_version: 3`. On a RE-RUN, read the existing
manifest's top-level `schema_version`:

- **Match (== 3):** proceed normally (STEP 2 onward).
- **Older MAJOR (e.g. 2) and `--migrate` NOT passed:** **REFUSE, write nothing.**
  Print exactly:
  > `manifest schema_version <N> is older than the current contract (3). This is a
  > one-way migration; re-run with --migrate to upgrade. Without it, /ack-init will
  > not silently rewrite your manifest.`
  Then end the turn. (Consumers also degrade safely: the gate falls back to `off` +
  stderr; the telemetry aggregator ignores the manifest's defaults + warns.)
- **Older MAJOR and `--migrate` passed:** perform the **one-way, opt-in migration**:
  1. Carry the existing `user:` subtree verbatim (never overwritten).
  2. Reuse the existing `managed:` answers as the migration inputs, then DEFAULT all
     v3-new keys to "off" so the migration is render-neutral:
     - `features.iac` → omitted (treated as `false`); NO `iac` block is added.
     - `auth` / `hosting` / `billing` → added ONLY if the archetype is `saas`
       (with the opinionated defaults: clerk / vercel / stripe); otherwise omitted.
     - `persistence.db` → unchanged (no auto-switch to `supabase`).
     - `design_system` → unchanged.
  3. Set `schema_version: 3`, re-validate against the frozen JSON-Schema, recompute
     `manifest_hash` LAST, and write. The new keys defaulting to "off" means the
     deterministic render is unchanged — only the version + any saas stack defaults
     differ. This is a **one-way** migration (no v3 → v2 downgrade path).

A fresh first run (no manifest present) is always authored at `schema_version: 3`;
`--migrate` is a no-op there.

---

## STEP 2 — FREEZE THE CONTRACT, THEN ASK ARCHETYPE FIRST

The manifest schema is FROZEN at `templates/manifest/project.manifest.schema.json`
(JSON-Schema draft 2020-12, `additionalProperties:false` everywhere). It is the
single source of truth: the interview WRITES it, the renderer/gate/telemetry READ
it. You do not invent keys. Treat `schema_version: 3` as a hard constant.

**Author-time integrity check (invariant I1):** every entry in
`templates/interview/questions.yaml` carries a `writes_to` JSON-pointer that MUST
resolve to a property in the schema. Before asking anything, cross-check that every
question's `writes_to` resolves. On any orphan key, HARD-REFUSE:
`interview/manifest divergence: writes_to '<ptr>' has no schema target`. Fail closed.

**Archetype is the BRANCH AXIS and is asked FIRST** (invariant I3). It selects
(a) the question subset, (b) the template set, and (c) which conditional schema
block becomes required.

- If `--archetype <name>` was passed (or `managed.archetype` exists on re-run and
  no new value is supplied / answers-file overrides it), use it without asking.
- Else, **interactive mode**: ask via AskUserQuestion, single-select:
  - **backend-api** — service/API project (v1: rendered DEEP)
  - **fullstack** — app + UI + API tier (v1: rendered DEEP)
  - **monorepo** — schema-known, minimal-core render
  - **library-sdk** — schema-known, minimal-core render
  - **infra-iac** — schema-known, minimal-core render
- Else, **QA mode**: read `managed.archetype` from the answers file; required.

v1 ships **backend-api** and **fullstack** with full question subsets and template
sets. The other three are schema-known and render only a minimal core; if selected,
warn that depth is v1-partial and proceed with the core.

---

## STEP 3 — LOAD ONLY THE ARCHETYPE'S QUESTION SUBSET

Load `templates/interview/questions.yaml` and select ONLY the entries whose
`applies_to` includes the chosen archetype. This is the *deterministic-interview
guarantee* (invariant I4): the subset is computed from `applies_to`, not left to
model judgement. Concretely:

- `persistence.*` questions are tagged `applies_to: [backend-api, fullstack]` only.
  **infra-iac NEVER asks DB questions** — do not ask them, period.
- `design_system.*` questions apply ONLY to `fullstack` (the block is schema-
  REQUIRED for fullstack and schema-FORBIDDEN for backend-api).
- `api_first`, `contract_gate.*`, `contracts[]` defaults are archetype-scoped.
- `project.framework` enum is archetype-scoped:
  backend-api → `fastapi|express|nestjs|gin|axum`; fullstack → `next|remix|sveltekit|nuxt`.

Never present a question that is not in the selected subset.

---

## STEP 4 — RUN THE INTERVIEW → WRITE THE MANIFEST

Collect answers for the selected subset, then assemble `project.manifest.yaml`
strictly per schema. The interview is the **ONLY writer** of the manifest.

Sourcing answers:
- **Interactive**: prefer AskUserQuestion for enumerated choices (archetype,
  language, framework, db, orm, modes, feature toggles). Use $ARGUMENTS free-text
  and targeted AskUserQuestion `Other` free-text for open fields (`project.name`,
  `project.description`, contract ids/paths, budgets).
- **QA**: take every value from the `--answers` file. No prompting.

Writing rules:
- Write each answer to its schema target using the question's `writes_to` pointer.
- `managed:` is regenerated WHOLESALE from answers (machine-owned). Emit keys in
  **schema order** with no timestamps inside `managed` so re-runs are byte-stable.
- `user:` is seeded ONCE on first run (`notes: ""`, `overrides: {}`) and carried
  through verbatim on re-runs — NEVER overwritten (invariant I2).
- `generator.*` is provenance only and is EXCLUDED from the hash. Set
  `generator.tool: ai-core-kit`, `tool_version` read from the kit's package.json
  `"version"` (the ack install root's package.json — extract with the already-allowed
  `jq -r .version <ack-root>/package.json`); if unreadable, write `"0.0.0-dev"`.
  This is provenance only — it is EXCLUDED from `manifest_hash`, so its value never
  affects the no-op fast path or byte-stability (even across kit version bumps). Set
  `rendered_at` to an ISO-8601 UTC stamp (informational, outside the hash).

Apply the PER-ARCHETYPE schema rules while assembling (enforced by the schema's
`allOf` if/then; you must produce conformant data):
- `archetype == fullstack` ⟹ `design_system` REQUIRED (with `install`, `source`).
- `archetype == backend-api` ⟹ `design_system` FORBIDDEN (omit it); `contracts`
  seeded with one stub entry (quality default, NOT schema-required). Seed exactly:
  `{id: "C-001-<project-slug>", scope: ["src/**"], status: draft}`. `contracts` is
  an optional property (`default: []`) for all archetypes; it is no longer
  schema-required for backend-api (schema_version 3).
- ALWAYS: `contract_gate.protected_paths` has `minItems: 1` — the gate can never
  be vacuous (invariant I4 / finding 44). Write archetype-appropriate defaults:
  - backend-api: protected `src/** migrations/** openapi/**`, scope `src/**`.
  - fullstack: protected `app/** api/** src/** prisma/schema.prisma`, scope `app/** api/**`.
- `contract_gate.exempt` WINS over scope/protected_paths; include test/snapshot/
  migration globs by default.
- `persistence.enabled: false` ⟹ omit DB sub-fields' render later; keep block valid.
- `discovery.enabled` defaults **false** (forkability, invariant I7).

**Seed non-interview structures (machine-owned defaults; not driven by any
question):** the interview has no `writes_to` for these, so `/ack-init` writes them
itself when assembling `managed:`:
- `contracts[]`: backend-api seeds exactly one stub entry (see the per-archetype
  rule above); fullstack and minimal-core seed `[]` (empty list allowed).
- `telemetry.budgets[]`: seed `[]` (empty) unless the answers-file supplies entries;
  budgets are advisory and optional.
- `design_system.tokens`: fullstack only, seed `{}` (empty object) unless the
  answers-file supplies tokens. Omitted entirely for non-fullstack (block
  forbidden/absent).
These seeds are part of the wholesale `managed:` regeneration and therefore
participate in `manifest_hash`.

**Validate before doing anything irreversible (invariant I6 — author-time
fail-closed):** validate the assembled instance against
`templates/manifest/project.manifest.schema.json`. If invalid, ABORT and write
NOTHING — report the validation error(s). Do not partially render.

**Compute the hash LAST:** `managed.manifest_hash` = `sha256:` + sha256 of the
canonicalized `managed:` subtree with the `manifest_hash` field itself omitted and
with `generator.*` excluded. Pattern `^sha256:[0-9a-f]{64}$`.

**Idempotency short-circuit:** on a re-run, if recomputed hash == stored hash AND
every `rendered_files[].path` is unchanged on disk, print `nothing to do` and
exit 0 without rewriting. Absent/garbled hash ⟹ treat as changed and proceed.

**Expression evaluation (deterministic, matches questions.yaml grammar):** When
evaluating an `ask_if`/`skip_if` whose operand references a prior question id: if
that id was not asked (gated out by `applies_to`, or skipped by its own predicate),
its value is the UNKNOWN SENTINEL. Against the sentinel: `==` ⟹ false, `in` ⟹
false, `!=` ⟹ true, `not_in` ⟹ true (fail-safe: skip rather than ask). Concretely
the persistence cascade (`migrations_tool`/`migrations_dir` `ask_if
migrations_enabled==true`) is skipped whenever `migrations_enabled` is itself
skipped (because `persistence_enabled` was false), since `unknown == true` is false.
A skipped question writes NOTHING to its `writes_to` target (the key is omitted from
`managed:`, not written as null).

---

## STEP 5 — RENDER VIA THE RENDER ENGINE

Render the archetype's template set against the manifest. The engine is the kit's
tiny `${VAR}`/`{{VAR}}` substitution renderer + a per-target JSON manifest whose
`when:{...}` guards decide conditional inclusion (conditionals live in the manifest
layer, NOT inside templates). `.tpl.<ext>` files render and drop the `.tpl` suffix;
plain files copy static.

- Render inputs are read ONLY from `managed:` (`project.*`, `archetype`,
  `persistence.*`, `contract_gate.*`, `contracts[]`, `ci_cd.target`, etc.).
  `user.overrides` MAY be consulted but is never required.
- v1-deep archetypes (backend-api, fullstack) render their full set under
  `templates/archetypes/<archetype>/`; minimal-core archetypes render the core only.
- Rendered CHILD paths MUST use `${CLAUDE_PROJECT_DIR}` and child-relative paths —
  NEVER `templates/` or absolute ack paths (forkability, invariant I7). The META
  discovery engine is NEVER copied into a child.
- For `fullstack` with `design_system.install: true`, copy
  `templates/archetypes/fullstack/design-system/` (Apache-2.0 example skills WITH
  NOTICE only — never docx/pdf/pptx/xlsx-derived content).

---

## STEP 6 — WIRE INTEGRATIONS PER OPT-IN TOGGLES (managed-block merge)

Read `managed.features` and the related blocks; wire ONLY what is opted in. Every
write into a FOREIGN file (one ack does not wholly own) happens inside a delimited
**managed block** so re-runs merge instead of clobber.

- **hooks** (`features.hooks` and/or `features.sdd_gate`):
  - If `features.sdd_gate: true`, install the contract-gate hook at
    `.claude/hooks/contract-gate` (whole file is ack-owned ⟹ `managed_block: null`)
    and register the matcher `Edit|Write|MultiEdit|NotebookEdit` in
    `.claude/settings.json` INSIDE the `ack:managed` block. Hook contract (frozen):
    runtime `python3` pinned, `glob_dialect: fnmatch` with `**`, reads
    `tool_input.file_path` from stdin and scopes in-script; precedence exempt >
    scope/protected_paths; unmatched ⟹ ALLOW; modes block(exit 2 + permissionDecision
    deny) / warn(exit 0, stderr, never blocks) / off(exit 0, no output, early-return);
    FAIL-OPEN if manifest missing/unparseable at hook time (behave as off + stderr).
  - If `features.sdd_gate: false`, OMIT the gate hook entirely (mode is moot).
- **mcp** (`features.mcp: true`): render `.mcp.json` with an `ack:managed` block.
- **agent_teams** (`features.agent_teams: true`): set
  `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in the settings `ack:managed` block.
- **telemetry** (`telemetry.enabled: true`): wire the OFFLINE attribution hooks per
  `telemetry.attribution` + `pricing_ref`. NO live cost is recorded; the aggregator
  computes spend offline. `enabled: false` ⟹ skip.
- **discovery** (`discovery.enabled: true`, default OFF): wire only the CHILD opt-in
  surface; never copy the META discovery engine.

**Merge mechanics (two-run safe, never blind-overwrite):**
- For each foreign file, edit ONLY between its `ack:managed` markers (e.g.
  `# >>> ack:managed` … `# <<< ack:managed`, comment syntax per file type).
  Content OUTSIDE the markers is the user's and is preserved byte-for-byte.
- Files with `managed_block: null` in the ledger are wholly ack-owned and may be
  rewritten in full.
- Conflict policy when a managed region was hand-edited: default and `--skip` ⟹
  KEEP EXISTING (CI-safe default = keep existing); `--force` ⟹ overwrite the
  managed region (still never touches unmanaged regions/files).
- Before writing, reconcile the `rendered_files` ledger: a file ack rendered last
  run but no longer in scope should have its managed block removed (not the whole
  file deleted unless `managed_block: null`).

---

## STEP 7 — EMIT CHILD CLAUDE.md (minimal pointer) + FINALIZE

- Write/refresh a MINIMAL child `CLAUDE.md` whose ack-owned content lives in an
  `ack:managed` block: a short pointer to `project.manifest.yaml` as the source of
  truth, the chosen archetype, and the contract-gate posture. Keep it minimal; do
  not dump the manifest into it. User prose outside the block is preserved.
- Ensure `project.manifest.yaml` is written (it is BOTH the artifact and the ledger).
- Update `managed.rendered_files` to list every path ack wrote this run, each with
  its `managed_block` (or `null` for wholly-owned files). This ledger is what makes
  the NEXT run authoritative and second-run-safe.
- Print a concise summary: archetype, files written/merged/skipped, gate mode, and
  whether this was a first run or an idempotent re-run.

---

## QA / NON-INTERACTIVE MODE (answers-file, for CI)

Because user-invoked slash commands are unavailable under `claude -p`, QA does NOT
call `/ack-init` by name. Instead, inline this task and feed the answers file, e.g.:

```bash
cat answers.yaml | claude -p "Initialize this ai-core-kit child non-interactively \
  using the piped answers as the full interview input. Follow .claude/commands/ack-init.md \
  steps 0-7 exactly. Do not ask questions." \
  --allowedTools "Read,Write,Edit,Bash" --permission-mode acceptEdits --bare \
  --output-format json
```

Answers-file shape: a YAML doc supplying one value per applicable question
`writes_to` pointer for the chosen `managed.archetype`. In this mode you MUST NOT
call AskUserQuestion; any unanswered REQUIRED field is a hard error (abort, write
nothing). `--bare` is recommended for deterministic CI (skips auto-discovery of
hooks/skills/MCP/CLAUDE.md). The same META-repo guard, schema validation, and
idempotent managed-block merge from STEPS 0/4/6 apply unchanged.
