# ai-core-kit

**A forkable standard for spinning up production-grade Claude Code projects.**

`ai-core-kit` is **not a project — it is the standard every new project forks.** It is
a meta-repo that, via a single `/ack-init` run inside a fresh fork, installs a
battle-tested Claude Code configuration **plus** a delivery methodology into that child
repo. You fork it, run the interview, and your repo is wired with the right
`.claude/` tooling, an archetype-appropriate scaffold, an opt-in design-contract gate,
optional MCP, and offline cost telemetry — with zero manual file shuffling.

---

## The one thing to never get wrong: two layers

`ai-core-kit` lives in **two layers that must never be conflated**:

| Layer | What it is | What governs it |
|---|---|---|
| **META** — *building the kit itself* | the scaffold repo: this `README`/`CLAUDE.md`, `docs/`, `.claude/` tooling, `templates/`, `telemetry/`, `discovery/` | forkability, idempotency, template hygiene, the discovery engine, offline telemetry |
| **CHILD** — *what `/ack-init` renders into a fork* | the actual new project | design-contract-first, the bootstrap interview, archetype scaffolding, the **contract gate** |

**Design-contract-first / API-first / the contract gate are CHILD-layer rules.** They
are authored here as **templates + hooks that ship into the child** — they do **not**
govern how the meta-repo itself is built. Consequently the META repo deliberately:

- carries **no** `project.manifest.yaml` and **no** contract instance (those are child
  artifacts produced by the interview); and
- wires **no** contract-gate hook of its own (it would pass vacuously).

The contract payload lives **only** under `templates/` and is what `/ack-init` renders.

See the full boundary rationale in [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) and the
day-to-day rules in [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md).

---

## How it works (usage flow)

```
fork ai-core-kit
   └─ run /ack-init in the child
        └─ archetype-first interview (templates/interview/questions.yaml)
             └─ writes project.manifest.yaml   ← single source of truth
                  └─ renders the archetype template set (docs/RENDER-ENGINE.md)
                       └─ wires the opt-in extras you chose:
                          hooks · MCP · telemetry · discovery
```

1. **Fork** this repo as the starting point for a new project.
2. **Run `/ack-init`** in the fork. It runs an **archetype-first interview**: pick your
   project shape, then answer only the questions that apply to it (an IaC project is
   never asked database questions; a fullstack project is offered the design-system
   install).
3. The interview writes a **`project.manifest.yaml`** — the **single source of truth**
   for everything downstream. There is **no LLM in the render loop**: the same answers
   produce a byte-identical manifest, and the manifest is validated against the frozen
   JSON-Schema **before** anything is rendered (invalid manifest → abort, write
   nothing).
4. The render engine stamps out the **archetype template set** from `templates/`,
   substituting `${dotted.path}` variables from the manifest.
5. **Opt-in extras** you selected are wired: conservative hooks (including the 3-mode
   contract gate), project-scoped MCP, the offline telemetry aggregator, and the
   discovery sources.

> Forkability invariant: the META `.claude/` tree is **never** copied into a child.
> Child hooks use the literal `${CLAUDE_PROJECT_DIR}`; child template variables are
> `${dotted.path}` in snake_case.

---

## The frozen P3 contract

The interview → manifest → render pipeline is governed by a small set of **frozen**
contract files. They are the stable interface four teams build against; changing them
is a deliberate, versioned act.

| File | Role |
|---|---|
| [`templates/manifest/project.manifest.schema.yaml`](./templates/manifest/project.manifest.schema.yaml) | Authoritative, human-readable manifest contract (`schema_version: 2`). |
| [`templates/manifest/project.manifest.schema.json`](./templates/manifest/project.manifest.schema.json) | JSON-Schema (draft 2020-12) generated from the YAML; the validator the interview runs. |
| [`templates/interview/questions.yaml`](./templates/interview/questions.yaml) | The deterministic question bank `/ack-init` walks in order; the **sole** source of interview questions. |
| [`docs/RENDER-ENGINE.md`](./docs/RENDER-ENGINE.md) | The render contract: variable syntax, `_when.*` conditional dirs, the render map, and idempotency rules. |

Design detail and the producer/consumer matrix live in
[`docs/P3-DESIGN.md`](./docs/P3-DESIGN.md).

---

## Cost telemetry — value prop

Claude Code hooks **cannot read token cost today** (see issue #11008), so cost is **not**
captured live. Instead `ai-core-kit` ships an **offline transcript aggregator** that
reads `~/.claude/projects/**/*.jsonl` and joins it against a **versioned pricing map**
(`telemetry/pricing.json`) to produce **per-feature and per-model cost attribution**
after a run — not a live meter, but accurate, reproducible accounting you can diff
across runs. Activity/metadata hooks remain metadata-only and never block.

See [`telemetry/README.md`](./telemetry/README.md) for the data contract and the
pricing-map format.

---

## Archetype status (v1)

`/ack-init` is archetype-first. v1 ships five archetypes at two depths:

| Archetype | v1 depth |
|---|---|
| **backend-api** | **Deep** — full template set, contract gate, OpenAPI seed |
| **fullstack** | **Deep** — full set + optional design-system install |
| **monorepo** | Minimal-core |
| **library-sdk** | Minimal-core |
| **infra-iac** | Minimal-core |

*Deep* archetypes render a complete, opinionated scaffold; *minimal-core* archetypes
render the always-on safe core (skills + minimal `CLAUDE.md` + command/agent
conventions + manifest) and will be deepened in later versions.

---

## Repository map

```
ai-core-kit/
├── README.md  CLAUDE.md  THIRD_PARTY_NOTICES.md
├── .claude/{agents,commands,skills,hooks}/  settings.json   # META tooling (never forked into a child)
├── templates/                                               # the CHILD payload /ack-init renders
│   ├── manifest/project.manifest.schema.{yaml,json}
│   ├── interview/questions.yaml
│   └── archetypes/{backend-api,fullstack,monorepo,library-sdk,infra-iac}/
├── telemetry/{README.md,pricing.json}                       # offline cost aggregation
├── discovery/{sources.yaml,proposals/,adopted/}             # propose, never auto-adopt
└── docs/
```

## Documentation

- [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md) — framing, the two-layer model, references + licenses, the 8-phase build plan, team roster.
- [`docs/BOOTSTRAP-CONFIG.md`](./docs/BOOTSTRAP-CONFIG.md) — the data-driven build configuration (phases, teams, models, budgets, acceptance tests).
- [`docs/P3-DESIGN.md`](./docs/P3-DESIGN.md) — interview → manifest → render design and producer/consumer matrix.
- [`docs/RENDER-ENGINE.md`](./docs/RENDER-ENGINE.md) — the render contract (variables, `_when.*` dirs, render map, idempotency).
- [`docs/PLAN-REVIEW.md`](./docs/PLAN-REVIEW.md) — corrections to the naive plan and revised sequencing.
- [`docs/REFERENCES.md`](./docs/REFERENCES.md) — verified license ledger for every reference repo.
- [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) — canonical `.claude/` conventions (SKILL.md / agent / command / hook shape).

## Licensing

`ai-core-kit` learns patterns broadly but vendors files conservatively. Anthropic
**example** skills are Apache-2.0 (vendorable **with** a NOTICE); the Anthropic
**document** skills (`docx`/`pdf`/`pptx`/`xlsx`) are **proprietary / source-available**
and are **never** vendored or derived from. See
[`docs/REFERENCES.md`](./docs/REFERENCES.md) and
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).
