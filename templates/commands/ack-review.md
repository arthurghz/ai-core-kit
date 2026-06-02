---
description: Multi-agent review of THIS project's current change (working tree / staged / branch-vs-base diff) BEFORE a PR or merge — the discoverable "review my work with a team" command. It reads the change surface from git + the manifest's contract-gate posture and protected paths, fans PARALLEL reviewers (code-reviewer always; security-reviewer + silent-failure-hunter conditionally) over the changed files via the /ack-agents doctrine, traces edits under protected paths to an approved contract, then aggregates deduped BLOCKER / NEEDS-REVISION / NIT verdicts (each with file:line + a fix) and gates the merge on zero unresolved blockers. Run in a forked CHILD project. Never run in the ai-core-kit META repo.
argument-hint: "[--staged] [--base <ref>] [<path>]"
allowed-tools: Read, Glob, Grep, Bash(git status*), Bash(git diff*), Bash(git log*), Task
disable-model-invocation: true
---

# /ack-review — review this change with a team, before the PR

You are this project's **pre-merge review lead**. Given the current change, your job is to
dispatch a TEAM of specialist reviewers over exactly the files that changed, aggregate their
verdicts into one deduped list, and gate the merge on no unresolved blockers. This is the
discoverable "review my work" command — it is a flagship of the kit's **build-with-a-team**
doctrine: you do not read the diff alone, you fan it out.

> This command REVIEWS; it does not edit. Treat the diff as evidence, not as a worklist —
> every finding is a verdict with `file:line` + a concrete fix the author can apply, not a
> patch you make. The merge decision is the deliverable.

> **Drive by TEAMS (recommended).** For real concurrency, enable Claude Code's experimental
> agent teams BEFORE you launch the session:
> ```bash
> export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
> ```
> With teams on, the reviewers below run as a real team of subagents in parallel instead of
> sequentially. If teams are off, recommend the user set the flag and re-launch, then fan out.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--staged` — review only the STAGED diff (`git diff --staged`) — the about-to-commit surface.
- `--base <ref>` — review the whole branch against `<ref>` (`git diff <ref>...HEAD`) — the
  about-to-PR surface. When both a base and a path are given, narrow to that path.
- `<path>` — a file or directory to narrow the review to (a positional, non-`--` argument).

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

This command ships inside ai-core-kit but must only EXECUTE in a forked CHILD. Detect the META
sentinels with your TOOLS (no shell command-substitution; paths are relative to the project
root, your working directory):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-review refuses to run inside the ai-core-kit META
repository (it reviews a fork's app change, not the kit itself).` Then end the turn.

---

## STEP 1 — DETERMINE THE REVIEW SURFACE + GATE POSTURE

Establish exactly what changed, then load the contract context that the review must enforce.

1. **Pick the diff** from `$ARGUMENTS`, with the **Bash** git tools:
   - `--staged` → `git diff --staged --stat` then per-file `git diff --staged`.
   - `--base <ref>` → `git diff <ref>...HEAD --stat` (the branch surface vs the base).
   - otherwise → `git status --short` + `git diff --stat` (the unstaged working-tree change).
   - a `<path>` arg narrows ANY of the above to that path. If nothing changed in the chosen
     surface, say so and stop — there is nothing to review.
2. **Read `project.manifest.yaml`** (Read tool). Extract `managed.contract_gate.mode` (the
   posture: e.g. `block` vs `warn`) and its protected-path globs, plus `managed.archetype` and
   `managed.project.*` for stack context. A "file not found" means no manifest — proceed
   without gate checks and note it. NEVER reintroduce `${...}` placeholders; read live values.
3. **Classify the changed files** so STEP 2 can pick reviewers: which touch auth / input
   handling / data / payments (→ security), which touch I/O / DB / network / external calls
   (→ silent-failure), and which fall under a protected-path glob (→ contract-gate check). Use
   **Grep**/**Glob** over the changed paths to sharpen the classification.

---

## STEP 2 — FAN OUT THE REVIEW TEAM (the /ack-agents doctrine)

Read `.claude/commands/ack-agents.md` and follow its fan-out procedure — one lane per reviewer,
all dispatched in a single message so they run in PARALLEL via the **Task** tool. Each reviewer
gets: the changed file list (its lane), the relevant diff excerpts, the project conventions
(`CLAUDE.md` + `specs/`), and a crisp "return BLOCKER / NEEDS-REVISION / NIT findings, each with
`file:line` + a fix" brief. Dispatch:

- **code-reviewer** — ALWAYS. Correctness, regressions, dead code, contract/spec drift across
  the whole changed surface.
- **security-reviewer** — WHEN the change touches auth, user input, data access, secrets, or
  payments. Authz/authn, injection, secret handling, unsafe deserialization.
- **silent-failure-hunter** — WHEN the change touches I/O, DB, network, or external calls.
  Swallowed errors, ignored return values, empty `catch`, missing timeouts/retries.
- **CONTRACT-GATE COMPLIANCE** — WHEN any changed file falls under a protected-path glob:
  dispatch a lane (use `constitutional-validator`) to verify each such edit traces to an
  **approved** contract under `docs/contracts/` whose scope covers it. An edit under a
  protected path with no approving contract is a **BLOCKER** when the gate mode is `block`.

Keep lanes' file sets disjoint where you can; reviewers may overlap on reading but must not
edit anything. Add a lane only when the change actually warrants it — do not spawn idle agents.

---

## STEP 3 — AGGREGATE THE VERDICTS (dedupe, severity-rank)

Collect every reviewer's findings and merge them into ONE list:

- **De-duplicate** findings that multiple agents raised on the same `file:line` — keep the
  sharpest statement and note which reviewers concurred (agreement raises confidence).
- **Severity-rank** each into exactly one bucket:
  - **BLOCKER** — must fix before merge (correctness bug, security hole, swallowed failure,
    protected-path edit with no approved contract).
  - **NEEDS-REVISION** — should fix; not a hard stop but the author must address or justify.
  - **NIT** — optional polish.
- Every finding carries `file:line`, a one-line problem statement, and a **concrete fix**.
  Drop anything a reviewer returned without a location or a fix — vague findings are noise.

If reviewers disagree on severity, take the stricter bucket and say why.

---

## STEP 4 — SUMMARIZE + GATE THE MERGE

Print one clean report the author and a human can act on:

- the review surface (which diff, how many files, the reviewers you dispatched);
- the deduped findings grouped by severity, each `file:line → problem → fix`;
- the **gate verdict**: `READY TO MERGE` only when there are ZERO unresolved BLOCKERs;
  otherwise `BLOCKED — N blocker(s)` and the shortest path to green.
- If any protected-path edit lacks an approving contract, name it and point the author at
  `/ack-spec` (to draft `C-NNN`) — a human approves it; you do not flip a contract to approved.

> **CLI parity.** A human can run the project's review locally; `create-ack report` surfaces the
> delivery view, and `create-ack watch` can keep an eye on the branch. This command is the
> team-driven, pre-PR gate; the CLI entries are the reporting siblings.

Review with a team, dedupe to truth, and never wave a BLOCKER through.
