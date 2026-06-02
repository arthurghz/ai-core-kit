---
name: skill-validator
description: Validates ai-core-kit skills, agents, and slash commands against the kit's canonical frontmatter and structure rules by running scripts/lint-frontmatter.py and interpreting every finding. Use to check a SKILL.md / agent / command before committing, to audit a freshly ported or authored primitive, to explain why the linter flagged a file, or to learn the required vs forbidden frontmatter keys. TRIGGER on "validate/lint/check this skill", "does this SKILL.md follow the kit conventions", "why is lint-frontmatter failing", "audit the skills", "is this agent frontmatter valid". SKIP when authoring or iterating on a skill's content (use skill-creator) or building an MCP server (use mcp-builder) — this skill judges conformance, it does not write the primitive.
license: Apache-2.0
---

# Skill Validator

Conformance gate for the kit's Claude Code primitives. It runs the repo's
stdlib-only linter, `scripts/lint-frontmatter.py`, and turns its `path: LEVEL: msg`
lines into a verdict plus concrete fixes. Use it as the last step before
committing a new or ported `SKILL.md`, agent, or slash command — and whenever a
lint failure needs explaining.

This skill judges conformance; it does not author content. To draft or improve a
skill, use `skill-creator`. To build an MCP server, use `mcp-builder`.

## What the linter checks

The linter classifies files by path and applies the matching ruleset:

| File | Path pattern | Required | Notes |
|------|-------------|----------|-------|
| Skill | `**/SKILL.md` (META or `templates/`) | `name`, `description` | only `name`/`description`/`license`/`allowed-tools` allowed |
| Agent | `**/.claude/agents/*.md` | `name`, `description` | `model` ∈ {haiku, sonnet, opus, inherit} if present |
| Command | `**/.claude/commands/*.md` | `description` | `name` optional; if present must be lowercase-hyphenated |

`name` (when present) must be **lowercase-hyphenated** (`^[a-z0-9]+(-[a-z0-9]+)*$`).

**Forbidden on a SKILL.md (hard error):** `version`, `author`, `category`,
`triggers`, `updated`. Any frontmatter key outside the allowed set is an error.

**Body ≤ 500 lines** is advisory — over the cap is a WARNING, never an error.

The exit code is non-zero only when at least one ERROR is present; WARNINGs do not
fail the lint. See `references/canonical-schema.md` for the full rule reference,
including the agent/command frontmatter allowlists and template-variable
conventions for CHILD-payload skills.

## Procedure

1. **Locate the linter.** It lives at `scripts/lint-frontmatter.py` in the kit
   repo root. It needs only `python3` (no install step, no PyYAML).

2. **Pick the scope.**
   - One file: pass the path directly.
   - A skill/agent directory: pass the directory — it walks recursively and skips
     `.git`, `node_modules`, `__pycache__`, `.venv`, `venv`.
   - The whole repo: run with no arguments (it scans the repo the script lives in,
     covering both `.claude/` META primitives and `templates/` CHILD payload).

3. **Run it** (Bash):
   ```bash
   python3 scripts/lint-frontmatter.py .claude/skills/<name>/SKILL.md
   # directory:
   python3 scripts/lint-frontmatter.py templates/skills/<name>
   # whole repo:
   python3 scripts/lint-frontmatter.py
   ```
   The tail line reports `scanned N file(s), E error(s), W warning(s)`.

4. **Interpret every finding** using the message-by-message guide below. Quote the
   `path: LEVEL: msg` line, state whether it is an error or warning, and give the
   exact edit.

5. **Re-run after fixes** until errors are zero. Report warnings honestly — a clean
   exit code with outstanding warnings (e.g. an over-cap body) is a "passes the
   gate, but" result, not a silent pass.

## Reading the findings

Errors block; warnings inform. Common messages and their fixes:

- **`frontmatter missing required key 'name'` / `'description'`** — add the key.
  Every SKILL.md and agent needs both; a command needs `description`.
- **`name '<x>' must be lowercase-hyphenated`** — rename to `kebab-case`
  (`MyTool` → `my-tool`). The directory name should match.
- **`SKILL.md frontmatter must not carry '<k>'`** — delete the forbidden key
  (`version`/`author`/`category`/`triggers`/`updated`). Provenance like author and
  version belongs in the port manifest / THIRD_PARTY_NOTICES.md, not the
  frontmatter. Triggering belongs *inside* the `description` text.
- **`SKILL.md frontmatter key '<k>' is not allowed`** — only
  `name`, `description`, `license`, `allowed-tools` are permitted. Move anything
  else into the body or drop it.
- **`model '<m>' must be one of [...]`** (agent) — set `model` to one of
  `haiku`, `sonnet`, `opus`, `inherit`, or remove it to inherit.
- **`missing or unterminated YAML frontmatter`** — the file must open with `---`
  on line 1 and have a closing `---`.
- **`unrecognized agent/command frontmatter key '<k>'`** (WARNING) — likely a typo
  of a documented key; check it against the allowlist in
  `references/canonical-schema.md`.
- **`body is N lines (> 500 cap)`** (WARNING) — split detail into `references/*.md`
  (one level deep), `scripts/`, or `assets/`.

## What the linter does NOT check

It is a frontmatter + structure gate, not a quality grader. It does not judge
whether a `description` triggers well, whether the body is good, or whether the
skill actually works. For triggering quality and behavioural evals, hand off to
`skill-creator`. Don't claim a skill is "good" just because lint is clean — say it
"conforms to the kit frontmatter rules."
