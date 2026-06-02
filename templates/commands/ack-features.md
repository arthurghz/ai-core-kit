---
description: See and manage THIS project's FEATURES — the vertical build slices, their status, the contract that covers each, and any open per-feature cost window. It reads specs/PLAN.md (the slices/phases), docs/contracts/ (which contract covers each slice + its status), and telemetry/sidecar.local.json (open/closed cost windows) to present one feature table, and can open or close a branch-free feature cost window via `create-ack feature`. Run in a forked CHILD project after /ack-spec. Never run in the ai-core-kit META repo.
argument-hint: "[<name>] [--end] [--list]"
allowed-tools: Read, Glob, Bash(ls:*), Bash(create-ack *), AskUserQuestion
disable-model-invocation: true
---

# /ack-features — see and manage this project's build slices

You are this project's **feature dashboard**. Surface the vertical slices the project is built
in — what they are, what state they're in, which contract gates each, and whether a per-feature
cost window is open — then let the human **open or close** a feature cost window. This is a
status-and-control command: it reports and toggles; it does **not** build (that's `/ack-build`).

> A "feature" here is a **vertical slice** from `specs/PLAN.md`, gated by a contract in
> `docs/contracts/`, and optionally bracketed by a **cost window** so spend attributes to it
> without needing a branch. The CLI equivalents are `create-ack feature <name>` (open a window)
> and `create-ack feature --end` (close the current one).

Arguments (parsed from `$ARGUMENTS`, all optional):
- `<name>` — open a cost window for this feature (branch-free attribution starts now).
- `--end` — close the currently-open feature cost window.
- `--list` — force list-only mode (the default when no name/`--end` is given): print the table
  and stop, toggling nothing.

Raw arguments: `$ARGUMENTS`

---

## STEP 0 — META-REPO GUARD (fail-closed)

Detect the META sentinels with your TOOLS (no shell command-substitution; paths relative to the
project root):

- **Glob** `templates/archetypes/*` — any match ⇒ META sentinel present.
- **Read**/**Glob** `docs/BOOTSTRAP.md` — if it exists ⇒ META sentinel present.

If EITHER is present: STOP. Print: `/ack-features refuses to run inside the ai-core-kit META
repository (it lists and manages a fork's build slices).` Then end the turn.

---

## STEP 1 — LIST THE FEATURES (read three sources, present one table)

This is the default path (also forced by `--list`). Read, in order:

1. `specs/PLAN.md` — the vertical slices / phases and their markers. Derive each slice's
   **status** from the plan's own checkboxes/markers: `planned` (unchecked / "next"),
   `in-progress` (started but not done), `done` (checked / shipped). If the plan uses prose
   rather than checkboxes, infer conservatively and say so. If `specs/PLAN.md` is absent, tell
   the user to run `/ack-spec` first, then STOP.
2. `docs/contracts/` (**Glob** `docs/contracts/*.contract.md`) — for each slice, find the
   contract whose scope covers it (typically `C-00N-<slug>`). Read its `id:` and `status:`
   front-matter so you can show **which contract gates the slice and whether it's approved**.
3. `telemetry/sidecar.local.json` (**Read** if it exists) — the branch-free cost-window log
   that `create-ack feature` maintains. Determine which feature currently has an **open** window
   (an entry with no end timestamp) vs **closed** windows. If telemetry isn't enabled, this
   file is simply absent — note "cost windows: n/a" rather than failing.

Present **one table**, one row per slice:

| feature / slice | status | contract (id · status) | cost window |
| --- | --- | --- | --- |

- **status** from PLAN.md markers (`planned` / `in-progress` / `done`).
- **contract** as `C-00N · approved|draft|pending`, or `— (no contract yet)` if none covers it.
- **cost window** as `open (since …)` / `closed` / `n/a`. Flag the one open window, if any.

Call out anything that needs attention: a slice with **no contract**, a slice marked
in-progress whose contract is still `draft` (the gate will block its build), or a **stale open
cost window** (open but its slice is already `done`).

---

## STEP 2 — OPEN / CLOSE A FEATURE COST WINDOW (on request)

Only when the user passed a `<name>` or `--end`. This is the branch-free per-feature cost
tracker — opening a window stamps "spend from now attributes to this feature" into the sidecar;
closing it stamps the end.

- **Open** (`<name>` given): run with the **Bash** tool

  ```bash
  create-ack feature <name>
  ```

  If a window is **already open** for a *different* feature (seen in STEP 1), don't silently
  stack windows — use **AskUserQuestion** to confirm whether to close the current one first,
  then open the new one. Prefer a `<name>` that matches the slice's slug in `specs/PLAN.md` so
  cost lines up with the plan.

- **Close** (`--end`): run

  ```bash
  create-ack feature --end
  ```

  to close the currently-open window. If none is open, say so and change nothing.

After the toggle, re-state the new cost-window state (which feature is open, or that all are
closed) so the human sees the result.

> Attribution only matters when telemetry runs in `sidecar_map` mode (see the manifest's
> `managed.telemetry.mode`). If telemetry is off or in `branch_prefix` mode, opening a window is
> a no-op — tell the user and point them at `/ack-cost` for how spend is actually attributed.

---

## STEP 3 — POINT TO THE NEXT MOVE

Close by routing the human onward:

- to **build** the next not-done slice: `/ack-build <slice>` (or bare `/ack-build` to let it
  pick the next from `specs/PLAN.md`) — that's the builder; this command is not.
- to **see spend** for these features: `/ack-cost` (offline, per-feature) — and the live CLI
  drill-downs `create-ack watch` / `create-ack dashboard`.

This command shows the slices and toggles their cost windows; it never builds — that is `/ack-build`.
