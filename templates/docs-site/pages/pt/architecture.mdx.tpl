---
title: Arquitetura
description: Como o ${project.name} está estruturado.
---

# Arquitetura

`${project.name}` é um projeto **${archetype}** escrito em **${project.language}**.

## Estrutura do código

O código da aplicação fica na raiz do repositório e é governado pelo manifesto
em `${CLAUDE_PROJECT_DIR}/project.manifest.yaml`. Abra o projeto no Claude Code e
rode `/ack-init` para re-renderizar a configuração gerenciada pelo kit após
editar o manifesto.

## Por onde começar

- Leia o `${CLAUDE_PROJECT_DIR}/CLAUDE.md` para entender o acordo de trabalho.
- Adicione suas próprias páginas em `pages/pt/` (e `pages/en/`) e liste-as no
  `_meta.js` correspondente.
