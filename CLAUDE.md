# CLAUDE.md — ai-core-kit (META layer)

> Minimal pointer file. CLAUDE.md is loaded every turn, so it stays small to avoid a
> per-turn token tax. **It points; it does not dump.** Read the linked docs on demand.

## What this repo is

`ai-core-kit` is a **forkable standard**, not a project. A fork runs `/ack-init` once
to install a Claude Code config + delivery methodology into the new child repo. You are
working in the **META** layer (building the kit), unless a path under `templates/` says
otherwise.

## The boundary rule (never conflate)

- **META** = building the kit: this file, `README.md`, `docs/`, `.claude/` tooling,
  `templates/` authoring, `telemetry/`, `discovery/` (planned). Governed by forkability,
  idempotency, template hygiene.
- **CHILD** = what `/ack-init` renders into a fork — **only** what lives under
  `templates/`. Design-contract-first and the contract gate are **CHILD** rules.
- Therefore the META repo has **no** `project.manifest.yaml`, **no** contract instance,
  and wires **no** contract-gate hook of its own (it would pass vacuously).
- Forkability: the META `.claude/` tree is **never** copied into a child. Child hooks
  use the literal `${CLAUDE_PROJECT_DIR}`; child template vars are `${dotted.path}`
  (snake_case).

## Licensing guardrail

Anthropic **example** skills are Apache-2.0 (vendorable **with** a NOTICE). The
Anthropic **document** skills — `docx`, `pdf`, `pptx`, `xlsx` — are
**proprietary / source-available**: never read, copy, or derive from them. Details in
`docs/REFERENCES.md`.

## Where to look

- **Conventions** (`.claude/` primitives: SKILL.md / agent / command / hook shape) →
  [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md)
- **Framing, plan, two-layer model, team roster** → [`docs/BOOTSTRAP.md`](./docs/BOOTSTRAP.md)
- **The frozen P3 contract** (manifest schema, question bank, render contract) →
  `templates/manifest/`, `templates/interview/questions.yaml`,
  [`docs/RENDER-ENGINE.md`](./docs/RENDER-ENGINE.md), [`docs/P3-DESIGN.md`](./docs/P3-DESIGN.md)
- **License ledger** → [`docs/REFERENCES.md`](./docs/REFERENCES.md) ·
  [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)
- **Project overview** → [`README.md`](./README.md)
