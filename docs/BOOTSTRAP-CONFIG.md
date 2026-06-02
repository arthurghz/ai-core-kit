# BOOTSTRAP-CONFIG.md — the data-driven META build config

> **Status:** active (the config-driven evolution of `docs/BOOTSTRAP.md`).
> **Layer:** **META.** This config governs how `ai-core-kit` builds *itself*. It
> does NOT describe a child contract, manifest, or contract gate — those are
> CHILD-payload artifacts authored under `templates/` and rendered by `/ack-init`.
> **Audience:** anyone re-planning the kit build, and the `/ack-build` orchestrator
> that consumes the config.

---

## 0. Why this exists

`docs/BOOTSTRAP.md` describes the build as prose: an 8-phase plan (§4), a team
roster (§5), a paste-in TEAMS command (§6), and a definition of done (§7).
Prose is great for humans and terrible for orchestration — you cannot validate
it, diff it, or drive a tool from it deterministically.

`bootstrap/ack.bootstrap.yaml` is that same plan as **data**: phases, gates,
dependencies, team composition, model assignments, advisory budgets, and
per-phase acceptance tests, all machine-readable and schema-validated. The
`/ack-build` command reads it, validates it, and drives the build phase-by-phase.
Re-planning the build is now an **edit to one YAML file** (re-validated against
its schema), not an edit to a prompt.

The relationship is intentional and one-directional:

```
docs/BOOTSTRAP.md  (the human narrative: framing, references, corrections)
        │  is the source the config encodes
        ▼
bootstrap/ack.bootstrap.yaml  (the machine plan: phases/teams/models/budgets/tests)
        │  validated by
        ▼
bootstrap/schema/bootstrap.schema.json  (JSON-Schema draft 2020-12)
        │  consumed by
        ▼
.claude/commands/ack-build.md  (the orchestrator: reads → validates → drives)
```

`BOOTSTRAP.md` stays the canonical narrative (the "why"). The config is the
canonical executable plan (the "what/how/when"). When they disagree, the config
wins for *execution* and `BOOTSTRAP.md` should be reconciled to match.

---

## 1. The three files

| File | Role |
|---|---|
| `bootstrap/ack.bootstrap.yaml` | The build config: `meta`, `models`, `budgets`, `teams`, `phases[]`. The single machine source of truth for the META build. |
| `bootstrap/schema/bootstrap.schema.json` | JSON-Schema (draft 2020-12, `additionalProperties:false` everywhere) that validates the config. Fail-closed: `/ack-build` refuses to run on an invalid config. |
| `.claude/commands/ack-build.md` | The orchestrator command. Reads the config, validates it against the schema, resolves a run plan, and drives each phase as a multi-agent team, stopping at gates. |

These mirror the same producer/consumer discipline the CHILD layer uses (one
frozen schema, one validated instance, one consumer command) — but at the META
layer, for the kit's own build rather than for a forked child.

---

## 2. Config anatomy

The config has five top-level keys (all `snake_case`). The schema is the
authoritative spec; this section is the orientation.

### 2.1 `meta`
Identity + the cloned reference repos with their license posture.

- `kit_name` — constant `ai-core-kit`.
- `version_source` — `git-describe` | `package_json` | `manual`. With `manual`,
  `version_override` (semver) is required.
- `reference_repos[]` — each `{name, url, license, vendorable, notes?}`. The
  `license` enum is `Apache-2.0 | MIT | source-available | proprietary`. The
  schema **enforces** that `source-available`/`proprietary` repos have
  `vendorable: false` — this encodes the hard licensing rule that the anthropics
  doc skills (`docx/pdf/pptx/xlsx`) are reference-only and must never be copied or
  derived from, while Apache-2.0/MIT files may be vendored WITH attribution.

### 2.2 `models`
Default model per role, plus a global `default`. Values are
`haiku | sonnet | opus | inherit`. A phase's `team[].model` overrides this for
that role in that phase; absent any override the role default applies, falling
back to `models.default`. Rationale baked into the defaults: load-bearing work
(ground-truth extraction, the frozen contract, the gate semantics, adversarial
QA) is Sonnet; mechanical authoring is Haiku; Opus is reserved for the
orchestrator/escalations.

### 2.3 `budgets`
`per_phase_tokens` plus an optional `per_role` map. These are **advisory**
cost-awareness targets surfaced in the status line — never hard caps. They never
block authoring.

### 2.4 `teams`
The roster (BOOTSTRAP.md §5) as data. Each entry binds a `role` to an `agent`
(resolving to `.claude/agents/<agent>.md`, authored in P2), records the `layer`
(`meta` vs `child-payload`), and a `responsibility`. The `layer` field is how the
orchestrator keeps the two-layer boundary honest: `child-payload` roles
(template, contract, design_system) produce `templates/` content; `meta` roles
build the kit.

### 2.5 `phases[]`
Exactly eight phases, **P1..P8**, in the PLAN-REVIEW.md §5 revised order. Each
phase carries:

| Key | Meaning |
|---|---|
| `id` | Stable `P1`..`P8`. |
| `title`, `goal` | One-line title + the phase's objective (from BOOTSTRAP.md §4). |
| `gate` | `true` ⟹ `/ack-build` STOPS for approval after the phase (the §4 ✋ markers). |
| `done` | `true` ⟹ complete on disk; `/ack-build` skips authoring and runs only acceptance tests as a regression check (resume-from-checkpoint). |
| `depends_on[]` | Hard prerequisites (other phase ids). Encodes PLAN-REVIEW.md §5 sequencing as a DAG. |
| `team[]` | The multi-agent team: `{role, agent, count, model?, token_budget?}`. |
| `deliverables[]` | Repo-relative paths the phase produces (directories end with `/`). |
| `acceptance_tests[]` | `{id, desc}` testable definition-of-done assertions (BOOTSTRAP.md §7, re-bound to the producing phase). |

**P3 is marked `done: true`** — the frozen contract (manifest schema, question
bank, render engine, `/ack-init`) already exists on disk per the recent commits.
P1 is also `done: true` (repo tree, license ledger). The remaining phases are
`done: false`.

---

## 3. How `/ack-build` consumes the config

`/ack-build` (`.claude/commands/ack-build.md`) is the data-driven evolution of
BOOTSTRAP.md §6. Its flow:

1. **META-repo guard.** Refuses unless both META sentinels
   (`bootstrap/ack.bootstrap.yaml`, `docs/BOOTSTRAP.md`) are present. This is the
   inverse of `/ack-init`, which refuses inside the META repo.
2. **Load + validate** the config against `bootstrap/schema/bootstrap.schema.json`.
   Invalid ⟹ hard STOP, author nothing. It also DAG-checks `depends_on` and warns
   if a referenced agent file is missing once P2 is `done`.
3. **Resolve the run plan.** Order = array order, gated by `depends_on` (a phase
   runs only after its deps are `done`). `done` phases are skipped for authoring
   (unless `--rebuild`/explicit `--phase`) but still have their acceptance tests
   re-run. Effective model/budget per member is resolved here.
4. **Drive each eligible phase as a team** — the BOOTSTRAP.md §6b skeleton:
   - **ground-truth barrier** — clone `meta.reference_repos`, extract exact
     conventions/licenses, WebFetch the docs.claude.com specs for this phase's
     primitives;
   - **author barrier** — one worker per deliverable, grounded in the facts,
     writing production-quality files (child-payload files use
     `${CLAUDE_PROJECT_DIR}`, never `templates/`/absolute ack paths);
   - **adversarial QA barrier** — validate against the phase's `acceptance_tests`,
     reporting each id PASS/FAIL with evidence.
5. **Per-phase status + cumulative OFFLINE cost.** See §4.
6. **Stop at every `gate: true`** for approval (unless `--no-stop`). A gate with
   failing acceptance tests halts regardless.

Useful flags: `--dry-run` (print the resolved plan and stop), `--phase <Pn>`,
`--from <Pn>`, `--no-stop` (CI sweep), `--rebuild` (re-author a `done` phase).

---

## 4. Cost is OFFLINE, never live (finding 8)

There is **no live token/cost API** exposed to hooks or the orchestrator
(issue #11008 / PLAN-REVIEW.md row 28). `/ack-build` therefore reports cumulative
spend via the OFFLINE aggregator `telemetry/aggregate.py`, which reads
`~/.claude/projects/**/*.jsonl` × a versioned `telemetry/pricing.json`
**post-run**. Two consequences encoded in both the config and the command:

- The aggregator is built in **P6**, which `depends_on: [P2, P3, P5]`. Until P6
  is `done`, `/ack-build` reports cost as `unavailable (P6 pending)` and proceeds
  — the cost feature is deliberately decoupled from earlier phases so its absence
  never blocks the build.
- `/ack-build` NEVER fabricates a number and NEVER reads a live `/usage`
  endpoint. The P8 telemetry acceptance test (`P8-A4`) runs the aggregator
  against a **captured transcript**, not live orchestration.

---

## 5. Editing the config

To re-plan the build, edit `bootstrap/ack.bootstrap.yaml`, then **re-validate**:

```bash
python3 - <<'PY'
import json, yaml
from jsonschema import Draft202012Validator
cfg = yaml.safe_load(open("bootstrap/ack.bootstrap.yaml"))
schema = json.load(open("bootstrap/schema/bootstrap.schema.json"))
errs = sorted(Draft202012Validator(schema).iter_errors(cfg), key=lambda e: list(e.path))
print("VALID" if not errs else f"{len(errs)} error(s)")
for e in errs: print(" -", "/".join(map(str, e.path)) or "<root>", ":", e.message)
PY
```

Common edits:

- **Re-sequence or add a dependency** — edit `phases[].depends_on`. The DAG is
  enforced at run time; keep the array order aligned with the intended P1..P8
  reading order. (The schema fixes the count at eight and the ids to `P1..P8`.)
- **Re-assign a model** — change `models.<role>` for a global default, or add
  `team[].model` to override one role in one phase (e.g. escalate a tricky QA to
  `opus` for P5 only).
- **Tune budgets** — `budgets.per_phase_tokens` / `budgets.per_role`. Advisory
  only; changing them never changes what gets built.
- **Add/adjust an acceptance test** — append to `phases[].acceptance_tests` with
  a `{id: "Pn-A<k>", desc}` (ids match `^P[1-8]-A[0-9]+$`). QA turns each into a
  pass/fail check.
- **Mark a phase done** — set `phases[].done: true` once you have reviewed its QA
  and accepted it. This is an operator checkpoint decision; `/ack-build` does NOT
  flip it for you, and a `done` phase is skipped for authoring but still
  regression-tested.
- **Add a reference repo** — append to `meta.reference_repos` with the correct
  `license`/`vendorable`. The schema rejects a `source-available`/`proprietary`
  repo marked `vendorable: true`.

> **Do not** add child-layer concepts to this config. There is no `contract`,
> `manifest`, or `contract_gate` key here by design — the META repo neither owns
> a manifest nor gates itself (findings 12/35/54). Child behavior is configured
> by `project.manifest.yaml` in a fork (see `RENDER-ENGINE.md` /
> `templates/manifest/`), not here.

---

## 6. Relationship to the other docs

| Doc | Layer | Relationship |
|---|---|---|
| `docs/BOOTSTRAP.md` | META | The human narrative this config encodes (§4 phases, §5 roster, §6 TEAMS command, §7 acceptance). The config is its executable form. |
| `docs/PLAN-REVIEW.md` | META | §5 revised sequencing → the `phases` order + `depends_on`; the numbered findings → the wording of several acceptance tests (e.g. rows 13/28/32/44/58). |
| `docs/P3-DESIGN.md` | CHILD-payload (P3) | Describes the FROZEN child contract that P3 (marked `done`) produced. The config references P3's deliverables but does not redefine them. |
| `docs/RENDER-ENGINE.md` | CHILD-payload (P4) | The renderer contract a later phase (P4) consumes. The config schedules P4; this doc specifies how P4's output is produced. |

In short: `BOOTSTRAP-CONFIG.md` + `ack.bootstrap.yaml` + `bootstrap.schema.json`
+ `/ack-build` are the **META build harness**; the `templates/` tree, the manifest
schema, `RENDER-ENGINE.md`, and `/ack-init` are the **CHILD payload** that harness
assembles. Keeping those two stacks distinct is the one thing never to get wrong
(BOOTSTRAP.md §0).

## 7. CHILD manifest version migration (v2 → v3, opt-in)

The CHILD manifest contract is versioned by `schema_version`
(`templates/manifest/project.manifest.schema.{yaml,json}`). The current major is
**3** (v3 added the `saas` archetype, `auth`/`hosting`/`billing`, `persistence.db
+= supabase`, and the orthogonal `features.iac` + `iac` block with derived
`is_aws`/`is_gcp`). All consumers refuse a mismatched MAJOR: the contract-gate hook
degrades to `off` + stderr, and the telemetry aggregator
(`telemetry/aggregate.py`, `ACCEPTED_MANIFEST_MAJOR`) ignores the manifest's
defaults with a stderr notice.

Migration of an existing **v2** child is **one-way and OPT-IN**: re-run
`/ack-init --migrate` in the child. It carries `user:` verbatim, defaults every
v3-new key to "off" (so the deterministic render is unchanged), sets
`schema_version: 3`, re-validates, and recomputes the hash. Without `--migrate`,
`/ack-init` REFUSES rather than silently rewriting (see `.claude/commands/ack-init.md`
STEP 1.5). This note is CHILD payload; `/ack-init` is its authoritative home.
