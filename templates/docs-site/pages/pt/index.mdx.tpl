---
title: ${project.name}
description: ${project.description}
---

# ${project.name}

${project.description}

Esta documentação é gerada pelo [ai-core-kit](https://github.com/stallae/ai-core-kit)
e vive ao lado do seu produto. Edite-a à vontade — ela é sua; o kit gerencia o
`project.manifest.yaml`, não este site.

## Visão geral

| | |
| --- | --- |
| Arquétipo | `${archetype}` |
| Linguagem | `${project.language}` |

## Comece por aqui

- **[Primeiros passos](/getting-started)** — instale as dependências e execute o ${project.name} localmente.
- **[Arquitetura](/architecture)** — como o projeto é estruturado e onde vive a fonte da verdade.
- **[Referência](/reference)** — documente a API e os módulos deste produto.

#ack:if features.sdd_gate
## Portão de contrato de design

Este projeto inclui o **contract gate** do ai-core-kit em `${CLAUDE_PROJECT_DIR}/.claude/`.
Alterações nos caminhos protegidos exigem um contrato de design aprovado antes:

#ack:each contract_gate.protected_paths as "- `$item`"
#ack:endif
