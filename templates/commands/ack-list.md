---
description: A fast, READ-ONLY inventory of this project's moving parts — contracts (id/status/scope), plan slices (done/in-progress), telemetry feature windows (open/closed), and the installed skills/agents/commands/contract-gate — so a human or agent can orient in seconds. It only reads docs/contracts/, specs/PLAN.md, telemetry/sidecar.local.json, .claude/{skills,agents,commands}, and project.manifest.yaml; it writes nothing and launches no agents. Run in a forked CHILD project. Never run in the ai-core-kit META repo.
argument-hint: "[contracts|slices|features|skills|agents|commands|gate|all]"
allowed-tools: Read, Glob, Grep, Bash(ls:*)
disable-model-invocation: true
---

# /ack-list — a fast inventory of this project's moving parts

You are this project's **orientation index**. Enumerate the requested subject (or everything)
from files on disk and print tight, skimmable lists. This is a status command: **READ-ONLY** —
no writes, no edits, no agents, no tool runs beyond reading and listing.

> Read state from disk; never infer it. A contract's truth is its `status:` field; a slice's
> truth is its done-marker; a feature window's truth is whether its sidecar entry's `to` is
> `null` (open) or set (closed). If a source file is absent, say so for that subject and move
> on — never fabricate rows. Equivalent CLI snapshots: `create-ack report` (summary) and
> `create-ack cost` (per-feature spend).

Arguments:
- `subject` (optional, default `all`) — one of `contracts | slices | features | skills | agents
  | commands | gate | all`. Anything else: list the valid subjects and STOP.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to the
project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-list refuses to run inside the ai-core-kit META
repository (it inventories a fork's parts, not the kit's).` Then end the turn.

---

## STEP 1 — RESOLVE SUBJECT, THEN ENUMERATE (each via tools only)

Parse the subject from `$ARGUMENTS` (default `all`). For `all`, emit every subject below as its
own short section. Gather each subject like so:

- **contracts** — **Glob** `docs/contracts/C-*.contract.md`. For each, **Read** the head and
  pull `id` (or filename), `status` (`draft | proposed | approved | rejected`), and the `scope`
  glob list. Flag any file whose `status` is missing as `unknown`.
- **slices** — **Read** `specs/PLAN.md`. List each phase/slice with its marker: a checked box
  (`- [x]`) or a `done`/`complete` note ⇒ **done**; an explicit `in progress`/`wip` note ⇒
  **in-progress**; otherwise **pending**. Keep the slice's id/title and its gate (`G1…`) if shown.
- **features** — **Read** `telemetry/sidecar.local.json` and list each `entries[]` window as
  `bucket` · `from` → (`to` or **OPEN** when `to` is `null`). Then **Read** `project.manifest.yaml`
  → `managed.telemetry.branch_prefix` / `default_bucket` and note the branch-prefix buckets in
  play. If `telemetry/` is absent, telemetry was not enabled — say so.
- **skills** — **Glob** `.claude/skills/*/SKILL.md`; **Read** each frontmatter for `name` +
  the one-line `description`.
- **agents** — **Glob** `.claude/agents/*.md`; **Read** each frontmatter for `name` + role
  (`description`).
- **commands** — **Glob** `.claude/commands/**/*.md`; for each derive `/<name>` from the path and
  pull the one-line `description` from frontmatter.
- **gate** — **Read** `project.manifest.yaml` → `managed.contract_gate`: `mode`
  (`block | warn | off`), `protected_paths`, `scope`, `exempt`. Cross-reference the **contracts**
  count above so the human sees how many approved contracts back the gate.

Use **Grep** to scan frontmatter/markers efficiently rather than reading whole large files where
you can. Never run anything beyond `ls` for listing.

---

## STEP 2 — PRINT TIGHT, SKIMMABLE LISTS

Render each subject as a compact table or bullet list — no prose padding:

- **contracts** — table: id · status · scope (first 1–2 globs, `+N more`). Count approved vs total.
- **slices** — table: # · slice · state (✓ done / … in-progress / ◦ pending) · gate.
- **features** — table: bucket · window (`from → to` or `from → OPEN`). Call out any OPEN window.
- **skills / agents / commands** — list: `name` — one-line description, sorted.
- **gate** — one line: `mode=<…>, protected=<n> globs, scope=<n>, exempt=<n>` then the globs;
  note if `mode: off` (gate inert) or if `protected_paths` is empty (vacuous — flag it).

For `all`, lead with a one-line tally (e.g. `5 contracts (2 approved) · 4 slices (1 open) ·
1 OPEN feature window · 7 skills · 9 agents · 12 commands · gate=block`), then the sections.
Close with the drill-down pointers: `/ack-cost` for spend per feature, `/ack-spec` for the
contract/spec flow. End the turn — this command changes nothing.

---

A good index is read once and trusted: report exactly what the files say, never what you expect.
