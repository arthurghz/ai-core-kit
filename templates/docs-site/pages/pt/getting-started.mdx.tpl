---
title: Primeiros passos
description: Instale as dependências e execute o ${project.name} localmente.
---

# Primeiros passos

Esta página mostra como executar o **${project.name}** na sua máquina.

## Pré-requisitos

- **Linguagem:** `${project.language}`
- **Runtime:** `${project.runtime}`
- **Gerenciador de pacotes:** `${project.package_manager}`

> Se algum valor acima estiver em branco, preencha-o para o seu ambiente — o scaffold
> emite o que foi capturado durante a entrevista do create-ack.

## Executar o projeto

A partir da raiz do repositório (`${CLAUDE_PROJECT_DIR}`), instale as dependências e
inicie o projeto. Ajuste os comandos conforme os scripts reais deste projeto:

```sh
${project.package_manager} install
${project.package_manager} run dev
```

## Executar esta documentação

O site de documentação vive em `docs/` na raiz do repositório:

```sh
cd docs
npm install
npm run dev      # visualize em http://localhost:3000
npm run build    # build de produção
```

A seguir: veja [Arquitetura](/architecture) para entender a estrutura do projeto e
[Referência](/reference) para documentar sua API e módulos.
