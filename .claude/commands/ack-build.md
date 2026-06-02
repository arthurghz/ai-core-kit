---
description: Orchestrate the ai-core-kit META self-build from bootstrap/ack.bootstrap.yaml. Validates the config against its JSON-Schema, then drives the build phase-by-phase with a multi-agent team per phase (ground-truth -> author -> adversarial QA), surfacing per-phase status and cumulative OFFLINE cost, and STOPPING at every gate for approval. This is the data-driven evolution of docs/BOOTSTRAP.md §6. Run ONLY inside the ai-core-kit META repo.
argument-hint: "[--phase <P1..P8>] [--from <P1..P8>] [--dry-run] [--no-stop] [--rebuild]"
allowed-tools: Read, Write, Edit, Task, Bash(python3 *), Bash(yq *), Bash(jq *), Bash(git rev-parse *), Bash(git describe *), Bash(git status *), Bash(ls *), Bash(test *), Bash(find *), AskUserQuestion
---

# /ack-build — orchestrate the ai-core-kit META self-build

You are the **lead orchestrator** for building `ai-core-kit` itself. Your job is
to read the data-driven build config, validate it, and drive the build
**phase-by-phase** with a multi-agent team per phase, **stopping at every gate**
for human approval. This command is the config-driven evolution of
`docs/BOOTSTRAP.md §6` (the TEAMS execution command): the phase plan, roster,
budgets, and acceptance tests now live as DATA in `bootstrap/ack.bootstrap.yaml`
rather than as prose, so re-planning the build is an edit to that file, not to a
prompt.

> **Two-layer discipline (never conflate).** `/ack-build` builds the **META**
> repo — the machine that stamps out the standard. It does NOT define or run a
> child contract gate, and it never writes a `project.manifest.yaml` at the META
> root (findings 12 / 35 / 54). The CHILD payload is only what lives under
> `templates/` and is rendered by `/ack-init`. Building the kit ≠ initializing a
> child.

> **Cost is OFFLINE, never live.** There is no live token/cost API in hooks
> (finding 8 / issue #11008). Cumulative spend is computed by the OFFLINE
> aggregator `telemetry/aggregate.py` over `~/.claude/projects/**/*.jsonl` × a
> versioned `pricing.json`. NEVER claim a live cost number; if the aggregator is
> not yet built (its phase is incomplete), report cost as `unavailable (P6
> pending)` and proceed.

Raw arguments: `$ARGUMENTS`

Arguments (all optional):
- `--phase <Pn>` — run exactly one phase (still honors its `depends_on`; aborts
  if a dependency is not `done`).
- `--from <Pn>` — start the sweep at phase `Pn` (skip already-`done` earlier
  phases, but still verify their acceptance tests as a regression gate).
- `--dry-run` — print the resolved plan (phase order, per-phase team, model and
  budget resolution, gates) and STOP. Author nothing.
- `--no-stop` — do not pause at `gate: true` phases (CI sweeps). The default is
  to STOP at every gate and ask for approval.
- `--rebuild` — re-author a phase even if it is `done: true` (overrides the
  resume-from-checkpoint skip; still runs acceptance tests after).

---

## STEP 0 — META-REPO GUARD (fail-closed, runs first)

`/ack-build` must run **only** inside the ai-core-kit META repo (the inverse of
`/ack-init`, which refuses there). Confirm BOTH META sentinels are present:

- bootstrap config present? !`test -f "${CLAUDE_PROJECT_DIR}/bootstrap/ack.bootstrap.yaml" && echo PRESENT || echo absent`
- BOOTSTRAP doc present? !`test -f "${CLAUDE_PROJECT_DIR}/docs/BOOTSTRAP.md" && echo PRESENT || echo absent`

If EITHER reports `absent`: **STOP.** Print exactly:

> `/ack-build only runs inside the ai-core-kit META repository`
> (missing sentinel: `bootstrap/ack.bootstrap.yaml` or `docs/BOOTSTRAP.md`).
> This command builds the kit itself; it is not a child-project command. If you
> forked the kit to start a project, run `/ack-init` instead.

Then end the turn.

---

## STEP 1 — LOAD & VALIDATE THE CONFIG (fail-closed)

The config is the single source of truth for the build. It is invalid to proceed
on an unvalidated or malformed config.

1. Read `bootstrap/ack.bootstrap.yaml`.
2. **Validate it against the schema** `bootstrap/schema/bootstrap.schema.json`
   (JSON-Schema draft 2020-12). Validate via the bundled-safe preprocessing
   below; its output is injected before you act:

   !`python3 - "$CLAUDE_PROJECT_DIR" <<'PY'
import json, sys, pathlib
root = pathlib.Path(sys.argv[1])
try:
    import yaml
except Exception as e:
    print("BLOCKER: PyYAML missing:", e); sys.exit(0)
try:
    from jsonschema import Draft202012Validator
except Exception as e:
    print("BLOCKER: jsonschema missing:", e); sys.exit(0)
cfg = yaml.safe_load((root/"bootstrap/ack.bootstrap.yaml").read_text())
schema = json.loads((root/"bootstrap/schema/bootstrap.schema.json").read_text())
v = Draft202012Validator(schema)
errs = sorted(v.iter_errors(cfg), key=lambda e: list(e.path))
if errs:
    print(f"INVALID: {len(errs)} error(s)")
    for e in errs[:25]:
        print("  -", "/".join(map(str, e.path)) or "<root>", ":", e.message)
    sys.exit(0)
phases = cfg["phases"]
ids = [p["id"] for p in phases]
print("VALID. phases:", ",".join(ids))
print("done:", ",".join(p["id"] for p in phases if p["done"]) or "(none)")
print("gates:", ",".join(p["id"] for p in phases if p["gate"]) or "(none)")
PY`

   If the preprocessing reports `INVALID` or `BLOCKER`, **STOP**: print the
   errors and instruct the user to fix `ack.bootstrap.yaml` (or install
   `pyyaml`/`jsonschema`). Author nothing on an invalid config.

3. **Cross-checks beyond the schema** (the schema can't express these): for
   every `phases[].team[].agent` and every `teams[].agent`, the corresponding
   `.claude/agents/<agent>.md` SHOULD exist once P2 is `done`. If a referenced
   agent file is missing AND P2 is `done`, emit a WARNING (not a hard stop) — the
   roster and the files have drifted. Also assert `depends_on` forms a DAG with
   no cycle and references only earlier-or-defined phase ids; a cycle is a hard
   STOP.

---

## STEP 2 — RESOLVE THE RUN PLAN

From the validated config, compute the ordered run list:

- **Order** = the `phases` array order (P1..P8), but a phase is only *eligible*
  once every id in its `depends_on` is `done: true` (or completed earlier in
  this same sweep). This enforces PLAN-REVIEW.md §5 sequencing as data.
- **Skip rule:** a phase with `done: true` is SKIPPED for authoring (resume from
  checkpoint) UNLESS `--rebuild` is passed or it is the explicit `--phase`
  target. Skipped phases still have their `acceptance_tests` run as a regression
  gate (STEP 4.3) so a completed phase can't silently rot.
- **Scope flags:** `--phase <Pn>` restricts the run to that single phase;
  `--from <Pn>` trims the head of the list.
- **Model & budget resolution per team member:** effective model =
  `team[].model` if set, else `models.<role>`, else `models.default`. Effective
  budget = `team[].token_budget` if set, else `budgets.per_role.<role>`, else
  `budgets.per_phase_tokens / Σcount`. Record these for the status line; budgets
  are ADVISORY (never a hard cap).

If `--dry-run`: print the resolved plan as a table
(`phase | gate | done | team(role×count@model) | deliverables | tests`) and the
gate stop points, then STOP without authoring.

---

## STEP 3 — PRECONDITIONS: GROUND-TRUTH IS MANDATORY PER PHASE

Every phase that actually authors (not skipped) MUST be grounded before writing,
exactly as BOOTSTRAP.md §6b mandates. For each such phase you will run a team
whose FIRST barrier is ground-truth, never authoring from memory:

- Clone the `meta.reference_repos` into a scratch dir (`/tmp/ack-refs/`, already
  git-ignored) for EXACT extraction — quotes + paths, not paraphrase.
- **Respect licenses from the config:** only files from `vendorable: true` repos
  may be copied, and only WITH attribution (LICENSE.txt + a THIRD_PARTY_NOTICES
  entry). Repos marked `source-available`/`proprietary` (the anthropics doc
  skills docx/pdf/pptx/xlsx) are **reference-only** — never read for derivation,
  never copied.
- Verify each `.claude/` primitive the phase authors against the live docs at
  `code.claude.com/docs/en/{hooks,sub-agents,slash-commands,skills,mcp,agent-teams}`
  before writing it.

---

## STEP 4 — DRIVE EACH ELIGIBLE PHASE (multi-agent team: ground-truth → author → QA)

For each phase in the resolved plan, run the BOOTSTRAP.md §6b workflow skeleton as
a **multi-agent team** (one team per phase). Spawn workers with the `Task` tool;
fan out in parallel where artifacts are independent, fan in at each barrier.

1. **Ground-truth barrier (parallel, then join).** Spawn the phase's `research`
   member(s) — or, if the phase has none, one ground-truth worker — to (a) clone
   + extract exact conventions/licenses from `meta.reference_repos`, and (b)
   WebFetch the relevant docs.claude.com specs for this phase's primitives.
   Collect their reports as `facts`. Do not proceed to authoring until this
   barrier returns.

2. **Author barrier (parallel/pipeline, grounded in `facts`).** For each
   `deliverables[]` path, spawn the owning team member (resolved model/budget
   from STEP 2) with a task that includes: the path, its spec from this phase's
   `goal`, the relevant `facts`, and the layer rule (META vs child-payload from
   the matching `teams[].layer`). Authors write production-quality files directly
   to their assigned paths — no stubs, no TODOs. Child-payload deliverables (under
   `templates/`) MUST use `${CLAUDE_PROJECT_DIR}` + child-relative paths and must
   never embed `templates/` or absolute ack paths (forkability, invariant I7).

3. **Adversarial QA barrier.** Spawn the phase's `qa` member to validate the
   authored (or, for a skipped `done` phase, the existing) artifacts against THIS
   PHASE'S `acceptance_tests[]` — each `{id, desc}` becomes a pass/fail check.
   QA verifies adversarially (tries to break the claim, e.g. that a gate truly
   blocks with exit 2 + `permissionDecision: deny`, that no doc-skill content
   leaked in, that META-hygiene holds). QA reports each test id as PASS / FAIL /
   N-A with evidence. A FAIL on any acceptance test makes the phase NOT complete:
   report the failures and their fixes, and do NOT mark/treat the phase as done.

4. **Phase status line.** After QA, print a concise per-phase status:
   - phase id + title, completed/blocked,
   - acceptance test results (`id: PASS/FAIL`),
   - per-member model used and an advisory budget note (effective vs spent is
     informational only),
   - **cumulative OFFLINE cost so far** via the aggregator (STEP 5).

---

## STEP 5 — CUMULATIVE OFFLINE COST (telemetry/aggregate.py)

After each phase (and in the final summary), surface cumulative spend by invoking
the OFFLINE aggregator — never a live API:

- If `telemetry/aggregate.py` exists (P6 complete), run it over
  `~/.claude/projects/**/*.jsonl` × `telemetry/pricing.json` and report the total
  plus, when available, a breakdown by feature/agent. Run it read-only, e.g.
  `python3 ${CLAUDE_PROJECT_DIR}/telemetry/aggregate.py --since <build-start>`.
- If it does NOT yet exist (P6 is still pending in this very build), report
  `cost: unavailable (P6 pending — offline aggregator not yet built)` and
  continue. The cost feature is intentionally decoupled from live orchestration
  (finding 8 / PLAN-REVIEW.md row 28): it is computed post-run from transcripts,
  so its absence never blocks earlier phases.
- NEVER fabricate a number and NEVER read a live `/usage` endpoint.

---

## STEP 6 — GATE STOP (default behavior)

After completing a phase whose `gate: true`:

- Unless `--no-stop` is set, **STOP and ask for approval** via AskUserQuestion
  before starting the next phase. Present: the phase's acceptance-test results,
  the deliverables written, and the cumulative OFFLINE cost. Offer: `approve →
  continue`, `stop here`, `re-run this phase`.
- Do NOT auto-advance past a gate. This mirrors the BOOTSTRAP.md §4 ✋ markers
  and BOOTSTRAP.md §5's "Stop at each ✋ gate for approval."
- A gate phase with FAILING acceptance tests is itself a stop: report the
  failures and halt; the build cannot proceed past an unmet gate even with
  `--no-stop`.

---

## STEP 7 — FINALIZE

When the run list is exhausted (or you stopped at a gate / on a failure):

- Print a build summary: which phases completed this run, which were skipped as
  already-`done`, which are blocked (with the blocking acceptance test ids), the
  next eligible phase, and the final cumulative OFFLINE cost (or `unavailable`).
- Remind the operator that to re-plan the build they edit
  `bootstrap/ack.bootstrap.yaml` (and re-validate via STEP 1), not this command.
- Do NOT modify `done:` flags in the config yourself unless the user explicitly
  asks — `done` is an operator-managed checkpoint. (Authoring a phase does not
  imply flipping its flag; that is a human decision after reviewing QA.)
- This command writes only META artifacts. If at any point a worker would write a
  concrete `project.manifest.yaml`, a contract instance, or a contract-gate entry
  at the META root, that is a layer violation — refuse it (findings 12/35/54).
