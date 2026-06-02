---
title: Architecture
description: How ${project.name} is structured.
---

# Architecture

`${project.name}` is a **${archetype}** project written in **${project.language}**.

## Source layout

The application source lives under the repository root and is governed by the
manifest at `${CLAUDE_PROJECT_DIR}/project.manifest.yaml`. Open the project in
Claude Code and run `/ack-init` to re-render the kit-managed configuration after
editing the manifest.

## Where to start

- Skim `${CLAUDE_PROJECT_DIR}/CLAUDE.md` for the working agreement.
- Add your own pages under `pages/en/` (and `pages/pt/`) and list them in
  the matching `_meta.js`.
