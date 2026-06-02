# Third-Party Notices

This file records attribution for third-party material that `ai-core-kit` **vendors**
(copies or directly derives files from). It is the companion to the full license
ledger in [`docs/REFERENCES.md`](./docs/REFERENCES.md).

> **Maintenance rule.** Add an entry here **whenever a file is copied in** from an
> external source — never after the fact. Each entry must carry the SPDX identifier
> and the **verbatim** upstream copyright line. Learning a *pattern* from a repo does
> **not** require an entry; copying a *file* does.
>
> **Not vendorable — never listed here:** the Anthropic document skills
> (`docx`, `pdf`, `pptx`, `xlsx`) are **proprietary / source-available** and are
> excluded from this kit entirely. See `docs/REFERENCES.md §1b`.

---

## Apache-2.0 — anthropics/skills (example skills)

The following components originate from **anthropics/skills**
(<https://github.com/anthropics/skills>) and are licensed under the **Apache License,
Version 2.0** (`SPDX-License-Identifier: Apache-2.0`).

**Copyright notice (verbatim, from each skill's `LICENSE.txt`):**

```
Copyright 2026 Anthropic, PBC.
```

> Note: `anthropics/skills` has no repo-root `LICENSE`; licensing is declared
> per-skill in each `LICENSE.txt`. The vendorable example skills below were each
> verified as Apache-2.0.

### Vendored / vendorable example skills

These skills MAY be copied into this kit. When a skill is actually vendored, keep its
upstream `LICENSE.txt` in the skill folder and confirm the entry below is present:

- `algorithmic-art`
- `brand-guidelines`
- `canvas-design`
- `claude-api`
- `frontend-design`
- `internal-comms`
- `mcp-builder`
- `skill-creator`
- `slack-gif-creator`
- `theme-factory`
- `web-artifacts-builder`
- `webapp-testing`

> `frontend-design`'s upstream `LICENSE.txt` ends at `END OF TERMS AND CONDITIONS`
> (its appendix is omitted). If vendored, restore the standard Apache-2.0 appendix
> and reattach the `Copyright 2026 Anthropic, PBC.` line so the NOTICE is complete.
>
> `doc-coauthoring` ships **no** `LICENSE.txt` and is therefore **not** vendorable
> until upstream clarifies its license; do not copy its files.

### Apache-2.0 attribution / NOTICE statement

```
This product includes software developed by Anthropic, PBC.

Portions of this product are derived from the Anthropic example Agent Skills
("anthropics/skills"), Copyright 2026 Anthropic, PBC., licensed under the
Apache License, Version 2.0. You may obtain a copy of the License at:

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied.
```

When a skill is vendored as-is, the full `LICENSE.txt` MUST accompany its folder; the
statement above satisfies the Apache-2.0 NOTICE requirement at the repository root.

---

## MIT — pattern references (only if files are copied)

The repositories below are **MIT** licensed. We currently borrow **patterns**, not
files. **If any file is ever copied in**, add a concrete entry here with the verbatim
copyright line and retain the MIT permission text alongside the copied file.

| Repository | SPDX | Verbatim copyright line |
|---|---|---|
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | `MIT` | `Copyright (c) 2025 Alireza Rezvani` |
| [shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) | `MIT` | `Copyright (c) 2025-2026 Shayan Rais` |
| [affaan-m/ecc](https://github.com/affaan-m/ecc) | `MIT` | `Copyright (c) 2026 Affaan Mustafa` |
| [gotalab/cc-sdd](https://github.com/gotalab/cc-sdd) | `MIT` | `Copyright (c) 2025 gotalab` |

**MIT permission text** (reproduce with any copied MIT file):

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## P3 port — actual vendored / re-authored components

> This section records the **concrete** material brought into the kit during the P3
> port (the index above declared what is *vendorable*; this records what was
> *actually* taken, the layer it landed in, and its provenance). Apache-2.0 items
> are copied + adapted under the NOTICE above; MIT items are **re-authored** in kit
> canonical style with the verbatim copyright line below retained.

### Apache-2.0 — anthropics/skills (vendored + adapted into META)

`SPDX-License-Identifier: Apache-2.0` · `Copyright 2026 Anthropic, PBC.` ·
<https://github.com/anthropics/skills> · NOTICE statement: see the Apache-2.0
section above.

| Component | Layer / path | Note |
|---|---|---|
| `skill-creator` (SKILL.md, `agents/`, `scripts/`, `eval-viewer/`, `references/`, `assets/`) | META `.claude/skills/skill-creator/` | Vendored + adapted to kit conventions. |
| `mcp-builder` (SKILL.md, `reference/`, `scripts/`) | META `.claude/skills/mcp-builder/` | Vendored + adapted to kit conventions. |

> **Action required when vendoring as-is:** these two skills are Apache-2.0 derived
> but their upstream `LICENSE.txt` is **not yet present** in the skill folders.
> Per `docs/REFERENCES.md §1a`, copy each skill's upstream `LICENSE.txt` into its
> folder so the NOTICE is complete. The repository-root NOTICE statement above
> satisfies the Apache-2.0 attribution requirement in the interim.
>
> `skill-validator` and the META `cost-telemetry` are **original to the kit** (no
> upstream); the standalone Apache-2.0 / MIT entries do not apply to them.

### MIT — affaan-m/ecc (re-authored)

`SPDX-License-Identifier: MIT` · `Copyright (c) 2026 Affaan Mustafa` ·
<https://github.com/affaan-m/ecc> · MIT permission text: see the MIT section above.

| Re-authored component | Layer / path | Upstream basis |
|---|---|---|
| `python-patterns` | CHILD `templates/skills/lang/python-patterns/` | ecc `python-patterns` |
| `python-testing` | CHILD `templates/skills/lang/python-testing/` | ecc `python-testing` |
| `go-patterns` | CHILD `templates/skills/lang/go-patterns/` | ecc `golang-patterns` |
| `rust-patterns` | CHILD `templates/skills/lang/rust-patterns/` | ecc `rust-patterns` |
| `react-patterns` | CHILD `templates/skills/lang/react-patterns/` | ecc `react-patterns` |
| `postgres-patterns` | CHILD `templates/skills/lang/postgres-patterns/` | ecc `postgres-patterns` |
| `prisma-patterns` | CHILD `templates/skills/lang/prisma-patterns/` | ecc `prisma-patterns` |
| `docker-patterns` | CHILD `templates/skills/lang/docker-patterns/` | ecc `docker-patterns` |
| `node-api-patterns` | CHILD `templates/skills/lang/node-api-patterns/` | informed by ecc `nestjs-patterns` (synthesized for the Express+NestJS enum) |
| `architect`, `code-explorer`, `code-reviewer`, `security-reviewer`, `silent-failure-hunter`, `refactor-cleaner` | CHILD `templates/agents/` | ecc `agents/*` |

> `typescript-patterns` is **original to the kit** (no ECC source skill); MIT-licensed.

### MIT — alirezarezvani/claude-skills (re-authored)

`SPDX-License-Identifier: MIT` · `Copyright (c) 2025 Alireza Rezvani` ·
<https://github.com/alirezarezvani/claude-skills> · MIT permission text: see above.

| Re-authored component | Layer / path | Upstream basis |
|---|---|---|
| `saas-scaffolder` (SKILL.md, `scripts/`, `references/`) | CHILD `templates/skills/saas-scaffolder/` | claude-skills `product-team/skills/saas-scaffolder` |
| `spec-to-repo` (SKILL.md, `scripts/`, `references/`) | CHILD `templates/skills/spec-to-repo/` | claude-skills `product-team/skills/spec-to-repo` |
| `ui-design-system` (SKILL.md, `scripts/`, `references/`, `assets/`) | CHILD `templates/skills/ui-design-system/` | claude-skills `product-team/skills/ui-design-system` |

### MIT — shanraisshan/claude-code-best-practice (re-authored)

`SPDX-License-Identifier: MIT` · `Copyright (c) 2025-2026 Shayan Rais` ·
<https://github.com/shanraisshan/claude-code-best-practice> · MIT permission text:
see above.

| Re-authored component | Layer / path | Upstream basis |
|---|---|---|
| `/rpi/research` | CHILD `templates/commands/rpi/research.md` | `rpi/.claude/commands/rpi/research.md` |
| `/rpi/plan` | CHILD `templates/commands/rpi/plan.md` | `rpi/.claude/commands/rpi/plan.md` |
| `/rpi/implement` | CHILD `templates/commands/rpi/implement.md` | `rpi/.claude/commands/rpi/implement.md` |
| `requirement-parser` | CHILD `templates/agents/requirement-parser.md` | `rpi/.claude/agents/requirement-parser.md` |
| `constitutional-validator` | CHILD `templates/agents/constitutional-validator.md` | `rpi/.claude/agents/constitutional-validator.md` |

### Original to ai-core-kit (MIT, no upstream)

`coding-standards`, `error-handling`, `code-tour`, `architecture-decision-records`,
`production-audit`, `cost-audit`, `cost-telemetry` (CHILD), `agent-eval`,
`frontend-a11y` (CHILD skills); `/prd`, `/rice` (CHILD commands). Authored for the
kit; no third-party attribution required.
