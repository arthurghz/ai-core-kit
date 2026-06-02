---
description: Stand up THIS project's engineering tooling — linter/formatter, type-checking, test runner, pre-commit hooks, CI, and editor config — matched to the manifest's stack, with multi-agent fan-out. It reads the manifest to derive the right tool matrix (TS → eslint/prettier/tsc/vitest; Python → ruff/mypy/pytest; plus husky/pre-commit + the CI target), distributes one agent per tooling area via the /ack-agents doctrine, then runs them once to verify. Run in a forked CHILD project after /ack-spec. Never run in the ai-core-kit META repo.
argument-hint: "[--only lint,format,types,test,hooks,ci,editor] [--lanes N] [--dry-run]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(ls:*), Bash(npx *), Bash(pnpm *), Bash(npm *), Bash(uv *), Bash(python3 *), Task, AskUserQuestion
disable-model-invocation: true
---

# /ack-tooling — stand up the engineering tooling (stack-matched, multi-agent)

You are this project's **tooling installer**. Your job: give the repo the guardrails a
production project needs — a linter, a formatter, type-checking, a test runner, pre-commit
hooks, CI, and editor config — chosen to fit THIS project's stack, installed by a **team of
parallel agents**, and verified by actually running them once.

> Distinct from the META `/ack-build` toolchain. This configures a FORK's app tooling. Like
> `/ack-build`, the execution step delegates to the **`/ack-agents`** fan-out doctrine — one
> agent per tooling area — so setup is multi-agent by default.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--only <areas>` — comma list from `lint,format,types,test,hooks,ci,editor`. Default: all
  areas that fit the stack.
- `--lanes N` — cap the parallel agent lanes (passed to /ack-agents).
- `--dry-run` — print the derived tool matrix + the per-area plan, change nothing, stop.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to
the project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-tooling refuses to run inside the ai-core-kit META
repository (it configures a fork's app tooling).` Then end the turn.

---

## STEP 1 — DERIVE THE TOOL MATRIX FROM THE MANIFEST

Read `project.manifest.yaml` — `managed.project.{language,package_manager,framework}`,
`managed.ci_cd.target`, `managed.features.*`, `managed.archetype` — and read `CLAUDE.md` +
`docs/CONVENTIONS.md` (if present) so the tooling matches the project's stated conventions.
Derive the matrix by language (do not ask what the manifest already answers):

- **TypeScript / pnpm (fullstack, saas):** `eslint` (+ `eslint-config-next` for Next.js),
  `prettier`, `tsc --noEmit` (strict), `vitest` (or the framework's test runner), `husky` +
  `lint-staged` for pre-commit, a `${ci_cd.target}` workflow running lint+types+test+build.
- **Python / uv (backend-api & co.):** `ruff` (lint + format), `mypy` (or `pyright`),
  `pytest` (+ coverage), `pre-commit` with ruff/mypy hooks, the same CI shape.
- **Always:** `.editorconfig`, sensible `.gitignore` additions, and the `npm`/`uv` scripts
  (or Makefile targets) that wrap each tool. The Dockerfile + docker-compose already exist —
  reference them from CI rather than re-adding.

Map `--only` onto this matrix. If `--dry-run`: print the matrix + per-area plan and STOP.

---

## STEP 2 — DISTRIBUTE THE SETUP (multi-agent ALWAYS, via /ack-agents)

Execute by following the **`/ack-agents`** doctrine (read `.claude/commands/ack-agents.md`):
make **one lane per tooling area** — `lint`, `format`, `types`, `test`, `hooks`, `ci`,
`editor` — and dispatch them as **parallel subagents** with the Task tool (capped by
`--lanes`). Keep file ownership disjoint per lane (the cardinal /ack-agents rule):

- each lane adds ONLY its own config + the `scripts`/targets that invoke it, and a one-line
  note in `CLAUDE.md`'s House-notes (how to run it) — coordinate so lanes don't both edit
  `package.json`/`CLAUDE.md` at once: assign config files to lanes, and let YOU apply the
  shared `package.json` scripts + CLAUDE.md note during integration (STEP 3).

Respect the contract gate: most tooling config sits OUTSIDE the protected paths, but if a lane
must write under a protected path, surface it and route it through a contract instead.

---

## STEP 3 — INTEGRATE + VERIFY (run it once)

Apply the shared edits the lanes deferred (the `package.json` scripts / `pyproject.toml`
`[tool.*]` blocks / Makefile targets, and the CLAUDE.md House-notes). Then **run each tool
once** to prove it works on this repo (`<pm> run lint`, `… typecheck`, `… test`; `ruff check`,
`mypy`, `pytest`). Fix the easy failures the tools surface (formatting, obvious type holes);
for anything that needs a real code change, note it for `/ack-build` rather than hand-coding it
here.

---

## STEP 4 — SUMMARIZE

Report: the tools installed per area, the config files added, the scripts/targets wired, and
the result of the verification run (pass / the failures you left for a build slice). Point the
user at `/ack-build` for the next feature slice and at the CI workflow for the gate on every PR.

Guardrails first, then speed. Install with a team; verify by running.
