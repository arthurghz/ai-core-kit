# Canonical frontmatter & structure schema

The authoritative source is `scripts/lint-frontmatter.py`. This reference mirrors
its rules so you can explain findings without re-reading the code, and so an author
can self-check before running the linter.

## How files are classified

`lint-frontmatter.py` decides which ruleset applies purely from the path:

- basename `SKILL.md` anywhere → **skill** rules (covers both META
  `.claude/skills/**/SKILL.md` and CHILD `templates/**/SKILL.md`).
- `*.md` under any `/.claude/agents/` directory → **agent** rules.
- `*.md` under any `/.claude/commands/` directory → **command** rules.
- anything else → out of scope (ignored).

Helper docs that live *inside* a skill (e.g. `skill-creator/agents/grader.md`,
`references/*.md`) are NOT under `/.claude/agents/`, so they are not linted as
agents. They may have no frontmatter at all — that is fine.

The frontmatter parser is intentionally tiny: it reads only top-level
`key: value` lines between the opening and closing `---`. It checks for the
*presence* of keys; it does not deep-parse nested YAML.

## SKILL.md rules

- **Required:** `name`, `description` (both non-empty).
- **Allowed (the complete set):** `name`, `description`, `license`,
  `allowed-tools`. Anything else is an ERROR.
- **Forbidden (explicit ERROR):** `version`, `author`, `category`, `triggers`,
  `updated`.
- **`name`** must match `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase-hyphenated). The
  containing directory should use the same name.
- **`description`** is third person and packs three things: what it does, when to
  use it (with concrete trigger phrases), and when NOT to use it (the SKIP clause
  that separates it from neighbouring skills). All triggering lives here — never in
  a `triggers` key, never only in the body.
- **`license`** (optional) is a short SPDX-style string, e.g. `Apache-2.0`,
  `MIT`. Do not point it at a bundled `LICENSE.txt`; record the upstream source +
  license in the port manifest so synthesis writes the THIRD_PARTY_NOTICES entry.
- **`allowed-tools`** (optional, rare) restricts the skill to a tool subset.
- **Body ≤ 500 lines** is advisory (WARNING when exceeded). Push overflow into
  `references/*.md` (one level deep), `scripts/`, and `assets/`.

## Agent rules (`.claude/agents/*.md`)

- **Required:** `name`, `description`.
- **`name`** lowercase-hyphenated (same regex as skills).
- **`model`** (optional) must be one of `haiku`, `sonnet`, `opus`, `inherit`;
  any other value is an ERROR. Omit to inherit.
- **`description`** for an agent reads "use proactively when …" — it tells the
  orchestrator when to delegate.
- **Allowed keys (recognized; others WARN):** `name`, `description`, `model`,
  `tools`, `allowedTools`, `color`, `maxTurns`, `permissionMode`, `memory`,
  `skills`, `hooks`.
- The SKILL forbidden set (`version`/`author`/`category`/`triggers`/`updated`) is
  ALSO an ERROR on agents.

## Command rules (`.claude/commands/*.md`)

- **Required:** `description`.
- **`name`** optional; if present, must be lowercase-hyphenated.
- **Allowed keys (recognized; others WARN):** `description`, `argument-hint`,
  `allowed-tools`, `disable-model-invocation`, `model`, `name`.
- The SKILL forbidden set is also an ERROR on commands.

## Severity & exit code

- **ERROR** → counted toward the non-zero exit code; the gate fails.
- **WARNING** → printed and counted, but the exit code stays 0. A clean exit with
  warnings is "conforms, with advisories" — report the warnings, don't bury them.

The summary line is always: `scanned N file(s), E error(s), W warning(s)`.

## CHILD-payload template conventions (not enforced by the linter, but required)

Skills under `templates/` are rendered into a fork by `/ack-init`. They use:

- `${dotted.path}` substitution variables in snake_case
  (e.g. `${project.name}`, `${stack.backend}`).
- `${CLAUDE_PROJECT_DIR}` for any in-repo path — never a hardcoded absolute path.

The linter will not catch a hardcoded `/Users/...` path or a malformed variable,
so check these by eye when validating a CHILD template, and call them out even
though they are not lint errors.
