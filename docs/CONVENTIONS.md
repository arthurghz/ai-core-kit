# CONVENTIONS — the ai-core-kit Claude Code standard

> **Status:** canonical (the BOOTSTRAP §2 conventions, expanded and verified
> against `code.claude.com/docs`).
> **Role:** the single source of truth for how Claude Code primitives are shaped in
> this kit — frontmatter, the `.claude/` layout, the Command → Agent → Skill spine,
> the agent contract, the hook exit-code contract, and the minimal-`CLAUDE.md` rule.
> **Enforcement:** `scripts/lint-frontmatter.py` mechanically checks the frontmatter
> rules below over `.claude/agents`, `.claude/commands`, `.claude/skills/**/SKILL.md`,
> and `templates/**/SKILL.md`. CI runs it; a violation exits non-zero.

---

## 0. Two layers — read this first

`ai-core-kit` is **not a project; it is the standard every new project forks.** Two
layers live in this repo and must never be conflated:

| Layer | What it is | Where it lives |
|---|---|---|
| **META** | building the kit itself | root docs, `.claude/`, `scripts/`, `telemetry/`, `bootstrap/` |
| **CHILD** | what `/ack-init` renders into a fork | everything under `templates/` |

These conventions apply to **both** layers — a skill is shaped the same whether it
ships in the META `.claude/` or in a child template. What differs is **policy**:

- **Design-contract-first and the contract gate are CHILD rules.** They are authored
  here as templates + hooks that ship into the child, **never** wired into the META
  repo (a META gate would only ever pass vacuously, finding 12).
- **Forkability (I7):** the META `.claude/` tree is **never** copied into a child.
  Child hook paths use the literal `${CLAUDE_PROJECT_DIR}`; child template variables
  are `${dotted.path}` (snake_case, read from the manifest's `managed:` subtree).

---

## 1. SKILL.md frontmatter (the load-bearing rule)

Skills follow the [Agent Skills](https://agentskills.io) open standard. Frontmatter is
deliberately **minimal** — only two keys are required, and a fixed set of keys is
*forbidden* so skills stay portable and machine-checkable.

```yaml
---
name: my-skill                 # REQUIRED. lowercase-hyphenated (^[a-z0-9]+(-[a-z0-9]+)*$)
description: >                  # REQUIRED. third-person — WHAT it does + WHEN to use it,
  Do X for Y. Use when the user … . Trigger when … . Do NOT use when … .
license: Apache-2.0            # OPTIONAL (or "Complete terms in LICENSE.txt")
allowed-tools: Read, Bash      # OPTIONAL (restrict the skill's tool surface)
---
```

- **`name`** — lowercase-hyphenated, matches the skill's folder name.
- **`description`** — the trigger surface. Write it in the **third person**, state
  **what it does and when to use it**, include explicit **trigger phrases** and a
  **when-NOT-to-use** clause. This is what the model reads to decide invocation.
- **REJECT** these keys in SKILL.md frontmatter — the linter errors on them:
  `version`, `author`, `category`, `triggers`, `updated`. They are noise the harness
  ignores and they drift; versioning lives in git, triggers live in `description`.
- **Allowed keys, total:** `name`, `description`, `license`, `allowed-tools`.

### Folder-per-skill layout

```
.claude/skills/<skill-id>/
├── SKILL.md          # frontmatter + body (≤ 500 lines)
├── references/*.md   # deep detail, linked ONE level deep only
├── assets/           # templates, fixtures
├── scripts/          # automation the skill calls
└── LICENSE.txt       # if any file was vendored (Apache-2.0 example skills WITH a NOTICE)
```

---

## 2. The 500-line body cap

The SKILL.md **body** (everything after the closing `---`) should stay **at or under
500 lines**. The cap is **advisory** per the Claude Code docs, so the linter emits a
**WARNING**, not an error, when a body exceeds it.

When you approach the cap, push detail out of the body:

- procedures and deep reference → `references/*.md` (linked **one level deep only**);
- templates and fixtures → `assets/`;
- automation → `scripts/`.

A skill that needs more than ~500 lines of inline instruction is usually two skills.

---

## 3. `.claude/` layout

```
.claude/
├── agents/        # subagent definitions (one .md per agent)
├── commands/      # slash commands (thin entrypoints)
├── skills/        # folder-per-skill (logic lives here)
├── hooks/         # hook scripts (portable via ${CLAUDE_PROJECT_DIR})
├── settings.json           # committed, shared config
└── settings.local.json     # GIT-IGNORED machine-local overrides
.claude-plugin/     # plugin metadata (marketplace.json) when published as a plugin
```

`settings.local.json` and `.claude/**/*.lock`, `.claude/hooks/logs/`, and
`.claude/agent-memory/` are git-ignored (see the root `.gitignore`).

---

## 4. Architecture spine: Command → Agent → Skill

**Logic lives in skills.** Commands are thin entrypoints; agents orchestrate skills;
skills hold the reusable procedure.

- **Command** (`.claude/commands/*.md`) — a thin, named entrypoint a human invokes
  (`/ack-init`). It parses arguments and delegates. It does **not** carry the heavy
  procedure inline.
- **Agent** (`.claude/agents/*.md`) — a focused worker with its own context window and
  system prompt. It orchestrates skills toward **one** objective; it does not duplicate
  skill logic.
- **Skill** (`.claude/skills/**/SKILL.md`) — the reusable, model-invoked procedure.
  This is where the real instructions live.

Rule of thumb: if you are pasting the same multi-step procedure into more than one
place, it belongs in a **skill**, not copied into a command or agent.

### Command frontmatter

```yaml
---
description: One-line, third-person summary of what the command does.   # REQUIRED
argument-hint: "[--flag] [<arg>]"          # OPTIONAL
allowed-tools: Read, Write, Bash(git status:*)   # OPTIONAL (restrict the surface)
disable-model-invocation: true             # OPTIONAL (human-only command)
---
```

Required: `description`. The linter warns on unrecognized command keys and errors on
the SKILL-forbidden keys.

---

## 5. The agent contract

Every agent is **markdown + YAML frontmatter**.

```yaml
---
name: research                  # REQUIRED. lowercase-hyphenated
description: >                  # REQUIRED. third-person, with a "use proactively when …"
  … . Use this agent proactively when … . Trigger when …
model: sonnet                   # OPTIONAL. one of: haiku | sonnet | opus | inherit
tools: Read, Grep, Bash         # OPTIONAL. allowlist (omit ⟹ inherit the session's tools)
---
```

- **`name`** — lowercase-hyphenated, matches the file stem.
- **`description`** — third-person, includes a **"use proactively when …"** clause and
  concrete **trigger** phrases so the orchestrator selects it correctly.
- **`model`** — `inherit` is the default if omitted. Assign by cognitive load:
  `haiku` for mechanical scans, `sonnet` for authoring/extraction, `opus` for
  adversarial QA / load-bearing judgement.
- **`tools`** — least-privilege allowlist; omit to inherit.

**Body structure** (every agent): a **single objective**, an explicit **output format**,
the **tool/source scope**, **done-criteria**, and a **META/CHILD boundary** reminder.

**One agent per focused task.** Agents orchestrate skills; they do not re-implement them.
The kit's META build team (`research`, `template`, `contract`, `infra`, `qa`,
`discovery`, `design-system`) follows this contract and is **report-back subagents** —
there is no `teams.json` (the build is driven by the Workflow tool, not experimental
agent teams).

---

## 6. The hook exit-code contract (load-bearing)

Hooks communicate with the harness through **exit codes** and, for `PreToolUse`, an
optional `hookSpecificOutput` JSON object on stdout.

| Exit code | Meaning |
|---|---|
| `0` | OK — allow / proceed (any stdout that is not the decision object is informational). |
| `2` | **Block.** The hook's **stderr is fed back to the model.** |
| other | **Non-blocking.** Treated as a soft error; does not block the tool. |

### `PreToolUse` — the blocking footgun

To **block** a tool call you must do **both**:

1. exit with code **`2`** (not `1`), **and**
2. emit `hookSpecificOutput.permissionDecision: "deny"` on stdout.

```json
{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny" } }
```

`permissionDecision` values: `"allow"`, `"deny"`, `"ask"`, `"defer"`. A **top-level
`decision` field is the wrong form and silently no-ops the guard** — use
`hookSpecificOutput.permissionDecision`. This is baked into the CHILD contract-gate
template; get it wrong and the gate fails open without warning.

### `PostToolUse` — never exit non-zero

`PostToolUse` runs **after** the tool has executed; it cannot block it. Exit code `2`
there is a **non-blocking error whose stderr leaks to the model**, so a `PostToolUse`
hook (e.g. telemetry capture) must **always exit `0`** and write only to its own sink.

### Portability

Hook commands use **`${CLAUDE_PROJECT_DIR}`** for project-relative paths (the harness
sets it to the project root for both hooks and MCP servers). In a project- or
user-scoped `.mcp.json`, `${VAR}` expansion **requires a default**, e.g.
`${CLAUDE_PROJECT_DIR:-.}`. Plugin-provided servers may also use
`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`.

### Hooks are opt-in

Hooks are **opt-in, not baseline** — two of the four reference repos ship zero hooks,
and a misconfigured blocking hook wedges a session. In the CHILD payload they are gated
through the interview, ship conservative matchers, and document `disableAllHooks`. The
**META** repo wires **no** contract-gate / `PreToolUse`-deny hook (finding 12).

### Telemetry caveat (issue #11008)

Hooks **cannot read token count or cost today** — there are no token/cost fields in hook
input. `PostToolUse` JSONL is **activity/metadata only**. Real cost attribution comes
from an **offline transcript aggregator** over `~/.claude/projects/**/*.jsonl` joined to
a **versioned `pricing.json`**, never from a live hook.

---

## 7. CLAUDE.md = minimal pointer file

`CLAUDE.md` is loaded into **every turn**, so bloat is a **permanent per-turn token
tax.** Keep it a minimal **pointer**:

- a one-paragraph orientation + the two-layer reminder;
- pointers to on-demand docs (`build.md` / `testing.md` / `conventions.md`) the model
  reads only when relevant;
- **no** dumped manifests, no long checklists, no duplicated skill bodies.

The CHILD `CLAUDE.md` that `/ack-init` emits follows the same rule: a short pointer to
`project.manifest.yaml` (the source of truth), the chosen archetype, and the gate
posture — inside an `ack:managed` block, with user prose preserved outside it.

---

## 8. License discipline (when vendoring)

- **Apache-2.0 example skills** (`anthropics/skills`, e.g. `claude-api`, `theme-factory`)
  — vendorable **with** an accompanying `NOTICE`; carry `LICENSE.txt` for any copied file.
- **MIT reference repos** (`claude-skills`, `claude-code-best-practice`, `ecc`) —
  re-author attributed; retain the MIT notice on any copied file.
- **Proprietary source-available doc skills** (`docx`, `pdf`, `pptx`, `xlsx`) —
  **NEVER read, copy, paraphrase, or derive from them.** Reference only.

Ship a root `THIRD_PARTY_NOTICES.md` and keep attributions for anything vendored.
