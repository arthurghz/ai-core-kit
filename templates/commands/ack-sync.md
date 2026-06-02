---
description: Sync THIS fork with the latest ai-core-kit payload — pull new/updated slash commands, agents, and skills from the published kit into .claude/. It runs `npx @arthurghz/create-ack@latest sync`, which overwrites the KIT-OWNED payload only (your specs, code, contracts, and manifest are never touched), then shows you the diff. Use it to pick up new features (commands like /ack-build, new skills, new agents) as the kit evolves. Run in a forked CHILD project. Never run in the ai-core-kit META repo.
argument-hint: "[--check]"
allowed-tools: Read, Glob, Bash(npx *), Bash(create-ack *), Bash(git status*), Bash(git diff*)
disable-model-invocation: true
---

# /ack-sync — pull the latest kit features into this fork

You keep this fork current with the upstream **ai-core-kit** standard. New commands, agents, and
skills land in the published package over time; this command pulls them into the fork's `.claude/`
so you get the new capabilities without re-scaffolding. The kit owns those files — your specs,
application code, contracts, and `project.manifest.yaml` are never touched.

> The kit ships as `@arthurghz/create-ack` on npm. `create-ack sync` (which this command runs)
> re-copies the kit's `commands/` + `agents/` + `skills/` into your `.claude/`. Pin freshness by
> running it through `@latest`.

Arguments:
- `--check` — only report whether a newer kit version exists (runs `create-ack update`); sync nothing.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to the
project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-sync refuses to run inside the ai-core-kit META
repository — it updates a FORK from the kit, not the kit itself.` Then end the turn.

---

## STEP 1 — CHECK / SYNC

- If `--check`: run `npx @arthurghz/create-ack@latest update` (or `create-ack update` if the CLI
  is installed) with the **Bash** tool, report whether a newer kit version is available, and STOP.
- Otherwise, **sync**: run

  ```bash
  npx @arthurghz/create-ack@latest sync
  ```

  with the Bash tool. It pulls the latest kit `commands/` + `agents/` + `skills/` into `.claude/`
  and prints the per-area counts. (If `create-ack` is already on PATH and you want the installed
  version instead of `@latest`, run `create-ack sync`.)

---

## STEP 2 — REVIEW THE DIFF + SUMMARIZE

Show what changed so the human can review before committing:

```bash
git status --short .claude/
git diff --stat .claude/
```

Then summarize: which commands/agents/skills are NEW vs UPDATED, and call out anything notable
(a new `ack-*` command, a new skill pack). Remind the user these files are KIT-OWNED (safe to
accept wholesale) and that their specs/code/contracts were untouched. Suggest committing the sync
as its own change (e.g. `chore: sync ai-core-kit payload`) so the update is auditable.
