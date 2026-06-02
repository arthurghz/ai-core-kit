---
description: Distribute a unit of work across MULTIPLE parallel subagents — the kit's default execution engine. It decomposes the work (a feature/slice, a plan's phases, a set of files, or an inline checklist) into INDEPENDENT, non-conflicting lanes, dispatches one subagent per lane via the Task tool IN PARALLEL, then aggregates and runs a review pass. /ack-build and /ack-tooling delegate to this so work is ALWAYS fanned out, never single-threaded. Run in a forked CHILD project. Never run in the ai-core-kit META repo.
argument-hint: "<feature-slug | plan-path | inline list> [--lanes N] [--no-review] [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Task, AskUserQuestion
disable-model-invocation: true
---

# /ack-agents — fan a unit of work out to a team of parallel agents

You are this project's **work distributor**. Given a chunk of work, your job is to split it
into independent lanes and run them **concurrently** as subagents, then stitch the results
back together and review them. This is the kit's default execution doctrine: **build with a
team, always** — single-threaded work is the exception, not the rule.

> This command exists so the other `ack-*` commands never have to re-explain fan-out:
> `/ack-build` and `/ack-tooling` follow THIS procedure for their execution step. Run it
> directly when you want to parallelize anything — a plan's phases, a batch of files, a
> checklist of independent tasks.

> **Drive by TEAMS (recommended).** For real concurrency, enable Claude Code's experimental
> agent teams BEFORE you launch the session:
> ```bash
> export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
> ```
> With teams on (the scaffold also wires it into `.claude/settings.json` when you enabled
> `features.agent_teams`), the lanes below run as a real team of subagents instead of
> sequentially. If teams are off, recommend the user set the flag and re-launch — then fan out.
> The doctrine is the same either way: **always distribute; never single-thread the build.**

Arguments (parsed from `$ARGUMENTS`):
- `<work spec>` (required) — what to distribute. One of: a `<feature-slug>` (reads its
  `rpi/<slug>/plan/PLAN.md`), a path to a plan/markdown file, or an inline list of tasks.
- `--lanes N` — cap the number of parallel lanes (default: as many independent lanes as the
  work has, clamped to a sensible max — typically 3–6).
- `--no-review` — skip the final review pass (default: review is ON).
- `--dry-run` — print the lane decomposition + the dispatch plan, spawn nothing, stop.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

This command ships inside ai-core-kit but must only EXECUTE in a forked CHILD. Detect the
META sentinels with your TOOLS (no shell command-substitution; paths are relative to the
project root, your working directory):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-agents refuses to run inside the ai-core-kit META
repository (it distributes a fork's app work).` Then end the turn.

---

## STEP 1 — DECOMPOSE INTO INDEPENDENT LANES

Read the work spec and break it into **lanes** — units that can run at the same time without
stepping on each other. The cardinal rule: **two lanes must never edit the same file.**
Good seams, in rough priority:

1. by **plan phase** (when the spec is a `PLAN.md`: each phase is a lane, respecting the
   phase dependency order — only fan out phases that have no unmet dependency this round);
2. by **module / directory / layer** (e.g. `api/` vs `app/` vs `lib/db/`);
3. by **file or component** (one lane per file when they are genuinely independent);
4. by **functional requirement** (one lane per FR-NN that touches disjoint code).

Read the relevant `specs/` + the manifest (archetype, stack, conventions) so each lane
carries enough context to work in isolation. If lanes would collide on a shared file, either
(a) merge them into one lane, or (b) sequence the shared file in its own pre-lane. Record the
**file ownership** of every lane — it is the contract that keeps parallel work conflict-free.

If `--dry-run`: print the lanes (id · scope · owned files · depends-on) and STOP.

---

## STEP 2 — DISPATCH THE LANES IN PARALLEL (Task tool)

Spawn one subagent per lane with the **Task** tool, **all in a single message** so they run
concurrently (respect `--lanes N` — queue the rest and dispatch them as lanes free up). Give
each subagent:

- its lane scope + the EXACT files it owns ("edit only these; do not touch any other file");
- the relevant spec excerpts + acceptance criteria + the project conventions (CLAUDE.md);
- the contract posture: edits under protected paths require the approved contract — stay in
  scope and respect the gate;
- a crisp deliverable + a "report what you changed and any cross-lane assumptions" close.

When lanes edit files concurrently, prefer **worktree isolation** for each Task so their
writes can't interleave; otherwise keep ownership strictly disjoint. Pick the lane agent by
fit — a shipped specialist (`code-explorer` to map first, `code-reviewer`/`security-reviewer`
to judge) or a general implementation agent for the build itself.

---

## STEP 3 — AGGREGATE + INTEGRATE

Collect every lane's result. Reconcile the seams the lanes left open (shared interfaces, a
new import, a wiring point) — that integration is YOURS, not a lane's. If any lane failed or
returned out of scope, re-dispatch just that lane with a tighter brief. Never silently drop a
lane: report it.

---

## STEP 4 — REVIEW PASS (unless --no-review)

Fan out a verification pass over the merged result: dispatch `code-reviewer` (and
`security-reviewer` when the change touches auth, data, or external input) across the changed
surface. Treat NEEDS-REVISION verdicts as work: fix and re-review before declaring done.

---

## STEP 5 — REPORT

Print: the lanes (id · scope · agent · status), the files each changed, the integration you
performed, the review verdicts, and anything still open. Hand back a clean summary the caller
(`/ack-build`, `/ack-tooling`, or the human) can act on.

Build with a team. Keep lanes' file ownership disjoint. Always end with a review.
