# References & License Ledger

> **Scope.** This is the authoritative license ledger for every external repository
> `ai-core-kit` studied or borrows from. Each entry was **verified by opening the
> actual `LICENSE` / `LICENSE.txt` files** in a local clone (`/tmp/ack-refs/…`), not
> by trusting upstream READMEs. It supersedes the summary table in
> [`BOOTSTRAP.md §1`](./BOOTSTRAP.md) where they differ.
>
> **Golden rule.** *Patterns and conventions are free to learn from. **Files** are
> not free to copy.* Anything we vendor (copy a file from) must carry its upstream
> license + attribution in [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
> Source-available / proprietary material is **reference-only**: never copied,
> never derived from.

---

## At a glance

| Repository | SPDX | Vendorable? | What we take |
|---|---|---|---|
| [anthropics/skills](https://github.com/anthropics/skills) — *example skills* | `Apache-2.0` | ✅ with NOTICE | SKILL.md frontmatter shape, folder-per-skill layout, subagent-QA pattern |
| [anthropics/skills](https://github.com/anthropics/skills) — *doc skills* (`docx`/`pdf`/`pptx`/`xlsx`) | **Proprietary / source-available** | ❌ **never** | nothing — do not read, copy, or derive |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | `MIT` | ✅ with notice | domain-folder taxonomy, validator/scorer *patterns*, 500-line cap |
| [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) | `MIT` | ✅ with notice | hook taxonomy, Command→Agent→Skill spine, `.claude/` layout |
| [affaan-m/ecc](https://github.com/affaan-m/ecc) | `MIT` | ✅ with notice | rules hierarchy, two-stage hook loader, settings/identity JSON shape |
| [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) | `MIT` | ✅ with notice | template-renderer placeholder approach, agent YAML config shape |

> **Reality check on `anthropics/skills`.** The repo has **no single root `LICENSE`** —
> licensing is **per-skill**, declared in each skill's `LICENSE.txt`. The example
> skills are Apache-2.0; the four document skills carry a distinct **proprietary**
> notice. You must check the `LICENSE.txt` *inside the specific skill folder* before
> touching any file. The repo also ships its own
> [`THIRD_PARTY_NOTICES.md`](https://github.com/anthropics/skills) for upstream
> dependencies (imageio, etc.) — that is theirs, not ours.

---

## 1. anthropics/skills

- **Link:** https://github.com/anthropics/skills
- **License model:** *per-skill* — there is no repo-root `LICENSE`.
- **Verified locally:** `/tmp/ack-refs/skills/skills/<skill>/LICENSE.txt`

### 1a. Example skills — `Apache-2.0` (VENDORABLE, with NOTICE)

Verified Apache-2.0 (`LICENSE.txt` opens with the Apache License v2.0 header), each
with the appendix copyright line **`Copyright 2026 Anthropic, PBC.`**:

`algorithmic-art`, `brand-guidelines`, `canvas-design`, `claude-api`,
`frontend-design`, `internal-comms`, `mcp-builder`, `skill-creator`,
`slack-gif-creator`, `theme-factory`, `web-artifacts-builder`, `webapp-testing`.

> `doc-coauthoring` ships **no `LICENSE.txt`** and only a `SKILL.md`; treat it as
> reference-only unless/until upstream clarifies — do not vendor.
>
> `frontend-design/LICENSE.txt` is Apache-2.0 but ends at `END OF TERMS AND
> CONDITIONS` (its appendix/copyright block is omitted). When vendoring it, reattach
> the standard Apache appendix and the `Copyright 2026 Anthropic, PBC.` line so the
> NOTICE is complete.

**Each example skill `SKILL.md` declares:** `license: Complete terms in LICENSE.txt`.

| We adopt | We must NOT do |
|---|---|
| The **frontmatter shape** (`name`, `description`, optional `license`) and folder-per-skill layout as our canonical convention | Drop the `LICENSE.txt` when copying a skill's files |
| Vendoring a whole skill folder **as-is**, keeping its `LICENSE.txt` and recording it in `THIRD_PARTY_NOTICES.md` | Strip the `Copyright 2026 Anthropic, PBC.` line or relicense |
| Re-authoring our own skills *in the same style* (no copying needed) | Misrepresent a derived skill as Anthropic-authored |

### 1b. Document skills — **PROPRIETARY / source-available (DO NOT VENDOR)**

- **Skills:** `docx`, `pdf`, `pptx`, `xlsx`
- **Verified locally:** each `LICENSE.txt` opens with
  **`© 2025 Anthropic, PBC. All rights reserved.`** followed by a proprietary
  license that **expressly forbids**: extracting the materials from the Services,
  reproducing/copying, **creating derivative works**, distributing/sublicensing,
  and reverse-engineering.

> **Source-available ≠ open source.** You can *see* the code on GitHub, but the
> license grants **no** right to copy, adapt, or redistribute it.

| We adopt | We must NOT do |
|---|---|
| **Nothing from these folders.** | **Do not read, open, copy, paraphrase, or derive** from `docx`/`pdf`/`pptx`/`xlsx`. Do not let an agent ingest them as context. Do not reference their internal prose as a "pattern." |

If a child project needs document generation, point users at the upstream skills via
their own channels — `ai-core-kit` neither bundles nor reimplements them.

---

## 2. alirezarezvani/claude-skills — `MIT`

- **Link:** https://github.com/alirezarezvani/claude-skills
- **Verified locally:** `/tmp/ack-refs/claude-skills/LICENSE`
- **Copyright line (verbatim):** `Copyright (c) 2025 Alireza Rezvani`

| We adopt | We must NOT do |
|---|---|
| Domain-folder taxonomy; `plugin.json` schema shape; validator / scorer / auditor **patterns**; the 500-line SKILL.md body cap | Copy any file without retaining the MIT notice + the copyright line above |

---

## 3. shanraisshan/claude-code-best-practice — `MIT`

- **Link:** https://github.com/shanraisshan/claude-code-best-practice
- **Verified locally:** `/tmp/ack-refs/claude-code-best-practice/LICENSE`
- **Copyright line (verbatim):** `Copyright (c) 2025-2026 Shayan Rais`

| We adopt | We must NOT do |
|---|---|
| The hook taxonomy (`PreToolUse`/`PostToolUse`/… families), `settings.json` hook schema, the **Command → Agent → Skill** three-tier spine, `.claude/` directory layout, the subagent frontmatter superset | Vendor files without the MIT notice; copy prose tips verbatim — **re-author attributed individual tips** in our own words |

---

## 4. affaan-m/ecc — `MIT`

- **Link:** https://github.com/affaan-m/ecc
- **Verified locally:** `/tmp/ack-refs/ecc/LICENSE`
- **Copyright line (verbatim):** `Copyright (c) 2026 Affaan Mustafa`

| We adopt | We must NOT do |
|---|---|
| Rules hierarchy (common + language-specific), two-stage hook loader pattern, `settings.json` / identity JSON shape, the `SKILL.md` frontmatter examples (e.g. `brand-voice`) | Copy files without retaining the MIT notice + copyright line above |

---

## 5. gotalab/cc-sdd — `MIT`

- **Link:** https://github.com/gotalab/cc-sdd
- **Verified locally:** `/tmp/ack-refs/cc-sdd/LICENSE`
- **Copyright line (verbatim):** `Copyright (c) 2025 gotalab`
- **Role here:** *discovery seed + renderer reference* (not a baseline dependency).

| We adopt | We must NOT do |
|---|---|
| The **template-renderer approach** (placeholder substitution; cc-sdd uses `{{KEY}}` — our render engine uses `${dotted.path}`, see [`RENDER-ENGINE.md`](./RENDER-ENGINE.md)); the per-agent YAML config shape | Copy the TypeScript renderer source without the MIT notice + copyright line; assume our placeholder syntax matches theirs |

---

## Anthropic documentation & engineering (patterns, not files)

These are **specifications and guidance** — verify our `.claude/` primitives against
them, but **do not copy prose verbatim** into our docs.

- Agent Skills best practices — https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
- Skills (Claude Code) — https://code.claude.com/docs/en/skills
- Sub-agents — https://code.claude.com/docs/en/sub-agents
- Agent teams (experimental) — https://code.claude.com/docs/en/agent-teams
- Hooks — https://code.claude.com/docs/en/hooks
- MCP — https://code.claude.com/docs/en/mcp
- Slash commands — https://code.claude.com/docs/en/slash-commands
- Plugins — https://code.claude.com/docs/en/plugins
- Multi-agent research system — https://www.anthropic.com/engineering/multi-agent-research-system
- Building effective agents — https://www.anthropic.com/engineering/building-effective-agents
- Pricing — https://platform.claude.com/docs/en/about-claude/pricing
- Token/cost-in-hooks limitation (issue #11008) — https://github.com/anthropics/claude-code/issues/11008

## Discovery seed sources

Tracked for the discovery engine (`discovery/sources.yaml`) — *propose, never
auto-adopt*; each carries its own license to be checked at adoption time:

- awesome-claude-code — https://github.com/hesreallyhim/awesome-claude-code
- claude-plugins-official — https://github.com/anthropics/claude-plugins-official
- ccusage / tokscale cost tooling
- cc-sdd — https://github.com/gotalab/cc-sdd
- HumanLayer — "writing a good CLAUDE.md"

---

## Vendoring checklist (before copying ANY external file)

1. **Open the governing `LICENSE` / `LICENSE.txt`** for that exact file/folder
   (for `anthropics/skills`, the *per-skill* one).
2. Confirm SPDX is `Apache-2.0` or `MIT` (or another OSI-approved permissive
   license). If it says **"All rights reserved" / source-available / proprietary →
   STOP**, reference-only.
3. Copy the file **with** its license header / sibling `LICENSE` / `LICENSE.txt`.
4. Add an attribution entry to [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)
   (SPDX + verbatim copyright line).
5. For Apache-2.0 material, keep any upstream `NOTICE` and our combined NOTICE
   intact.

---

## Adopted (P3 port)

What was actually **vendored** (copied) or **re-authored** (rewritten in kit
canonical style) from each repo during the P3 port. Per-item layer, path, trigger,
and attribution: [`templates/skills/INDEX.md`](../templates/skills/INDEX.md).
Concrete license entries: [`THIRD_PARTY_NOTICES.md` § "P3 port"](../THIRD_PARTY_NOTICES.md).

### anthropics/skills — `Apache-2.0` (VENDORED + adapted)

- **META `.claude/skills/skill-creator/`** — vendored whole skill (SKILL.md,
  `agents/`, `scripts/`, `eval-viewer/`, `references/`, `assets/`), adapted to kit
  conventions. Build-tooling: authors + benchmarks kit skills.
- **META `.claude/skills/mcp-builder/`** — vendored whole skill (SKILL.md,
  `reference/`, `scripts/`), adapted. Builds MCP servers, incl. a child's
  `features.mcp` server.
- **Outstanding:** restore each skill's upstream `LICENSE.txt` into its folder when
  the vendored copy is finalized (see §1a and THIRD_PARTY_NOTICES action note).
- **Not vendored** (available, deferred): `algorithmic-art`, `brand-guidelines`,
  `canvas-design`, `claude-api`, `frontend-design`, `internal-comms`,
  `slack-gif-creator`, `theme-factory`, `web-artifacts-builder`, `webapp-testing`.
- **Never touched:** `docx`/`pdf`/`pptx`/`xlsx` (proprietary, §1b).

### affaan-m/ecc — `MIT` (RE-AUTHORED)

- **CHILD `templates/skills/lang/`** — re-authored language/framework/DB packs:
  `python-patterns`, `python-testing`, `go-patterns` (← `golang-patterns`),
  `rust-patterns`, `react-patterns`, `postgres-patterns`, `prisma-patterns`,
  `docker-patterns`; plus `node-api-patterns` (synthesized, informed by
  `nestjs-patterns`). `typescript-patterns` is kit-original (no ECC source).
- **CHILD `templates/agents/`** — re-authored engineering reviewers: `architect`,
  `code-explorer`, `code-reviewer`, `security-reviewer`, `silent-failure-hunter`,
  `refactor-cleaner`.
- Adopted the ECC **rules hierarchy** (common + language-specific) as the lang-pack
  taxonomy and the **agent frontmatter** shape.

### alirezarezvani/claude-skills — `MIT` (RE-AUTHORED)

- **CHILD `templates/skills/`** — re-authored product skills (each with `scripts/`
  + `references/`, ui-design-system also `assets/`): `saas-scaffolder`,
  `spec-to-repo`, `ui-design-system`.
- Adopted the **domain-folder taxonomy**, the **validator/scorer** script pattern,
  and the 500-line SKILL.md body cap.

### shanraisshan/claude-code-best-practice — `MIT` (RE-AUTHORED)

- **CHILD `templates/commands/rpi/`** — re-authored RPI command trio:
  `/rpi/research`, `/rpi/plan`, `/rpi/implement`.
- **CHILD `templates/agents/`** — re-authored RPI-flow agents: `requirement-parser`,
  `constitutional-validator`.
- Adopted the **Command → Agent → Skill** three-tier spine and the
  research → plan → implement (RPI) workflow as the kit's feature-delivery loop.
  See [`PATTERNS.md`](./PATTERNS.md).

### gotalab/cc-sdd — `MIT` (PATTERN only; nothing vendored)

- No files copied. The **template-renderer placeholder approach** informs the kit's
  `${dotted.path}` render engine (see [`RENDER-ENGINE.md`](./RENDER-ENGINE.md)); the
  per-agent YAML config shape informed the agent frontmatter convention.

### Original to ai-core-kit (MIT, no upstream)

Authored fresh for the kit during the port: CHILD skills `coding-standards`,
`error-handling`, `code-tour`, `architecture-decision-records`, `production-audit`,
`cost-audit`, `cost-telemetry`, `agent-eval`, `frontend-a11y`; CHILD commands
`/prd`, `/rice`; META skills `skill-validator` and `cost-telemetry`.
