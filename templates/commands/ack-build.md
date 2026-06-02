---
description: Build the next slice of THIS project from its specs — the contract-aware build loop, multi-agent by default. Reads specs/PLAN.md to pick the next vertical slice, checks the slice's contract is approved so the gate permits edits, grounds the work in real code, decomposes it into phases, then DISTRIBUTES the build across parallel agents via the /ack-agents doctrine and verifies — honoring the spec-first, gated workflow. Run in a forked CHILD project after /ack-spec has authored the specs. Never run in the ai-core-kit META repo.
argument-hint: "[<feature-slug>] [--from-plan] [--phase N] [--lanes N] [--skip-validation]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Task, AskUserQuestion
disable-model-invocation: true
---

# /ack-build — build the next slice from the specs (specs lead, code follows)

You are this project's **build conductor**. `/ack-spec` authored the intent (`specs/`); your
job is to turn the **next slice of that intent into working code** — grounded in the specs,
admitted by the contract gate, and executed by a **team of parallel agents** (never single-
threaded). You do not free-build: every slice traces to `specs/PLAN.md` + `specs/REQUIREMENTS.md`.

> This is `/ack-build` in a CHILD project — distinct from the META `/ack-build` that builds
> ai-core-kit itself. Here it builds YOUR app. The execution step delegates to the
> **`/ack-agents`** fan-out doctrine, so building is ALWAYS multi-agent. For a single
> feature's deep, document-heavy lifecycle you can instead run the RPI trio directly
> (`/research` → `/plan` → `/implement`); `/ack-build` is the fast, gated on-ramp.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `<feature-slug>` — the slice to build. Omit to let STEP 2 pick the next one from PLAN.md.
- `--from-plan` — always derive the slice from `specs/PLAN.md` (ignore a stale `rpi/` folder).
- `--phase N` — build only phase N of an already-decomposed slice.
- `--lanes N` — cap the parallel agent lanes for the execution step (passed to /ack-agents).
- `--skip-validation` — bypass the per-phase user validation gate (risky; record that it ran).

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to
the project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-build (child) refuses to run inside the ai-core-kit
META repository — it builds a FORK's app from its specs. Fork the kit, run /ack-spec, then
/ack-build from the child root.` Then end the turn.

---

## STEP 1 — LOAD STATE (read-only)

Read, in order (skip a missing file, but note it):

1. `project.manifest.yaml` — the stack + `managed.contract_gate.*` + `managed.features.sdd_gate`.
   If ABSENT: STOP and tell the user to scaffold (`create-ack`) and run `/ack-spec` first.
2. `specs/PLAN.md` — the build plan: the **first vertical slice**, the phase list, and the
   per-phase validation gate. This is the source of WHAT to build next.
3. `specs/REQUIREMENTS.md` — the FR/NFR + acceptance criteria the slice must satisfy.
4. `docs/contracts/` — the contracts (start with `C-001-*`): their scope globs + `status:`.
5. `specs/.spec-status.md` — if it still says "Specs: DRAFT", WARN: the specs are skeletons.
   Strongly recommend running `/ack-spec` first — building from un-authored intent is guessing.

---

## STEP 2 — PICK THE SLICE

- If a `<feature-slug>` arg was given, use it.
- Otherwise derive the next slice from `specs/PLAN.md`: the first phase/slice not yet done
  (or the "first vertical slice" if nothing is built yet). Propose it to the user with
  **AskUserQuestion** (slug + one-line scope), allowing a different pick. Never invent a slice
  that PLAN.md does not call for.
- Normalize the slug to kebab-case — it is the `rpi/<feature-slug>/` working-folder key.

---

## STEP 3 — CONTRACT-GATE PREFLIGHT (so the build's edits aren't blocked)

The gate enforces that edits under the protected paths require an **approved** contract. Start
implementing before the slice's contract is approved and the gate will BLOCK the writes.

- If `managed.features.sdd_gate` is true AND `managed.contract_gate.mode` is `block`: find the
  contract whose scope covers this slice (begin with `docs/contracts/C-001-*`). If its
  `status:` is not `approved`, **STOP** and tell the user exactly:
  > Approve the slice's contract first: open `docs/contracts/C-001-<slug>.contract.md`, review
  > its scope + acceptance, and set `status: draft → approved`. Then re-run `/ack-build`.
  Do NOT flip it to `approved` yourself.
- If the gate is `warn`/`off`, proceed but note that edits will not be gate-enforced.

---

## STEP 4 — GROUND + DECOMPOSE

1. **Ground in real code** — dispatch the `code-explorer` agent over the files this slice will
   touch so the build starts with the grain of the existing code, not assumptions. For a new
   slice, also parse the slice's requirements with `requirement-parser`.
2. **Contract-first when this is an API.** If the manifest has `managed.api_first: true`
   (backend-api / fullstack), the slice's **first deliverable is the API contract**, before any
   handler code: define/extend the `openapi/` spec (endpoints, schemas, error shapes) and make
   the slice's `docs/contracts/C-00N-*.contract.md` pin that API surface (scope globs +
   invariants + acceptance) — derived from `specs/DOMAIN.md` invariants + `specs/REQUIREMENTS.md`.
   The interface is agreed and gate-approved FIRST; implementation fills it in. Treat the API
   contract as the spine of the slice, not an afterthought.
3. **Decompose into phases/lanes** — break the slice into 2–5 independent units that each
   deliver something testable, respecting dependency order and keeping **file ownership
   disjoint** (the rule /ack-agents enforces). When api_first, the contract/spec phase leads and
   the implementation phases trace to it. Write/refresh `rpi/<slug>/plan/PLAN.md` with the phase
   list + per-phase acceptance. Honor `--phase N` (build only that phase).

---

## STEP 5 — BUILD IT (multi-agent ALWAYS, via /ack-agents)

Execute the decomposition by following the **`/ack-agents`** doctrine (read
`.claude/commands/ack-agents.md` and apply it; the fan-out logic is single-sourced there):
fan the phases/lanes out to **parallel subagents** (one per lane, dispatched together with the
Task tool, capped by `--lanes`), each owning a disjoint file set and carrying the slice's specs
+ acceptance + the contract posture. Integrate the seams yourself, then run the review pass
(`code-reviewer`, plus `security-reviewer` when auth/data/external input is touched). Every edit
under a protected path is admitted by the contract approved in STEP 3.

**Per-phase user validation gate** (unless `--skip-validation`): after each phase's lanes land
and pass review, STOP and present the phase's acceptance criteria for the human to confirm
before moving to the next phase. Update the phase status in `rpi/<slug>/plan/PLAN.md`.

If `rpi/<slug>/` already has completed phases, treat this as a RESUME: skip to the first
unfinished phase. Re-running is safe.

---

## STEP 6 — SUMMARIZE + NEXT SLICE

Report: the slice built, the lanes/agents that ran, phases completed + their validation
results, and the files changed. Then point at the **next** slice in `specs/PLAN.md` (run
`/ack-build` again for it), and remind that when a slice's scope reaches new protected paths,
its contract must be approved first (STEP 3). After the core slices land, run **`/ack-tooling`**
to stand up linting / types / tests / CI.

Specs lead; code follows. Build one validated slice at a time, with a team.
