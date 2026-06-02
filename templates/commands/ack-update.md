---
description: Check whether a newer ai-core-kit is published and tell THIS fork how to update — it runs `create-ack update` (or `npx @arthurghz/create-ack@latest update`) to report the fork's current kit version vs the latest released one, and, if you are behind, points you to /ack-sync (or `create-ack sync`) to pull the new commands/agents/skills. It reads version state and reports; it never applies the update itself. Run in a forked CHILD project. Never run in the ai-core-kit META repo.
argument-hint: "[--sync]"
allowed-tools: Read, Glob, Bash(npx *), Bash(create-ack *)
disable-model-invocation: true
---

# /ack-update — is this fork on the latest kit? (check, then point to /ack-sync)

You are this fork's **version-awareness face**. Tell the human whether the **ai-core-kit** standard
has moved on since this fork last synced: report the **current** kit version baked into the fork
versus the **latest** published one, and — if behind — hand off to `/ack-sync` to actually pull the
new payload. This command CHECKS and POINTS; it does not mutate `.claude/`.

> The kit ships as `@arthurghz/create-ack` on npm. `create-ack update` compares the version
> recorded in this fork against the latest release. The CLI equivalent is `create-ack update`
> (and, with `--sync`, `create-ack sync`). `/ack-update` decides whether you are stale;
> `/ack-sync` is what applies the change.

Arguments (parsed from `$ARGUMENTS`, all optional):
- `--sync` — if a newer version exists, also pull it now via `npx @arthurghz/create-ack@latest sync`
  (the `/ack-sync` action), instead of only reporting. Default: report-only.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to the
project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-update refuses to run inside the ai-core-kit META
repository — it checks a FORK's kit version, not the kit itself.` Then end the turn.

---

## STEP 1 — CHECK CURRENT vs LATEST

Run the kit's version check with the **Bash** tool:

```bash
npx @arthurghz/create-ack@latest update
```

(If `create-ack` is already on PATH and you prefer the installed binary, run `create-ack update`
instead.) It reports the fork's **current** kit version and the **latest** published version, and
whether you are up to date or behind.

Read the output and classify into exactly one of:
- **Up to date** — current == latest. Nothing to do.
- **Behind** — a newer version exists. Note the current → latest jump.
- **Unknown** — the command could not determine a version (offline, no network, no recorded
  version in the fork). Report what it said; do not guess.

---

## STEP 2 — IF BEHIND, HAND OFF TO /ack-sync

If (and only if) a newer version exists:

- **Default (report-only):** tell the user to run **`/ack-sync`** (or `create-ack sync`) to pull
  the new commands, agents, and skills into `.claude/`. Remind them that sync overwrites the
  KIT-OWNED payload only — their specs, code, contracts, and `project.manifest.yaml` are untouched.
- **With `--sync`:** run the pull now:

  ```bash
  npx @arthurghz/create-ack@latest sync
  ```

  with the Bash tool, then report the per-area counts it prints. (This is the `/ack-sync` action;
  for the full diff-and-review flow, defer to `/ack-sync` itself.)

After any sync, remind the user to **re-read `CLAUDE.md` and the command list** (`.claude/commands/`)
so they pick up new doctrine and any new `/ack-*` capabilities, and to commit the sync as its own
change (e.g. `chore: sync ai-core-kit payload`) so the update is auditable.

If you are already up to date, say so plainly and stop — there is nothing to sync.

---

## STEP 3 — SUMMARIZE

Close with a one-line verdict the human can act on:
- the **current → latest** versions and the status (up to date / behind / unknown);
- if behind, the exact next step (`/ack-sync`, or note that `--sync` already pulled it);
- if up to date, confirm no action is needed.

Keep it thin: this is a version probe, not a build — don't fan out agents, don't edit files, and
don't apply the update yourself; that is `/ack-sync`'s job.

---

A fork that knows when it is stale stays current; check with `/ack-update`, apply with `/ack-sync`.
