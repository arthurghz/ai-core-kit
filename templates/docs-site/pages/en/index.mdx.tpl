---
title: ${project.name}
description: ${project.description}
---

# ${project.name}

${project.description}

These docs are scaffolded by [ai-core-kit](https://github.com/stallae/ai-core-kit)
and live alongside your product. Edit them freely — they are yours; the kit
manages `project.manifest.yaml`, not this site.

## At a glance

| | |
| --- | --- |
| Archetype | `${archetype}` |
| Language | `${project.language}` |

## Start here

- **[Getting Started](/getting-started)** — install dependencies and run ${project.name} locally.
- **[Architecture](/architecture)** — how the project is shaped and where the source of truth lives.
- **[Reference](/reference)** — document this product's API and modules.

#ack:if features.sdd_gate
## Design-contract gate

This project ships the ai-core-kit **contract gate** in `${CLAUDE_PROJECT_DIR}/.claude/`.
Changes under the protected paths require an approved design contract first:

#ack:each contract_gate.protected_paths as "- `$item`"
#ack:endif
