---
title: Getting Started
description: Install dependencies and run ${project.name} locally.
---

# Getting Started

This page covers running **${project.name}** on your machine.

## Prerequisites

- **Language:** `${project.language}`
- **Runtime:** `${project.runtime}`
- **Package manager:** `${project.package_manager}`

> If any value above is blank, fill it in for your environment — the scaffold emits
> whatever was captured during the create-ack interview.

## Run the project

From the repository root (`${CLAUDE_PROJECT_DIR}`), install dependencies and start the
project. Adjust the commands to match this project's actual scripts:

```sh
${project.package_manager} install
${project.package_manager} run dev
```

## Run these docs

The documentation site lives in `docs/` at the repository root:

```sh
cd docs
npm install
npm run dev      # preview at http://localhost:3000
npm run build    # production build
```

Next: see [Architecture](/architecture) for how the project is shaped, and
[Reference](/reference) to document its API and modules.
