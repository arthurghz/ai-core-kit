---
name: shadcn-ui
description: Use this skill when building or theming a React + Tailwind UI in this fullstack project with shadcn/ui — the copy-in (not npm-dependency) component model, initializing the project (components.json), adding and composing components via the CLI, theming with OKLch CSS variables and dark mode, wiring component registries (including private ones), and enabling the shadcn MCP server so an agent can browse/search/install components. Triggers include "add a shadcn component", "set up shadcn", "scaffold a button/dialog/form", "theme the UI", "enable dark mode", "add a component registry", or "turn on the shadcn MCP". Do NOT use it for non-React or non-Tailwind stacks (plain SvelteKit/Nuxt — see the community ports note), for brand identity decisions like the palette, logo, or voice (that is the brand-guidelines skill), or for UI composition rules like layout, spacing, and accessibility mechanics (that is the frontend-design-guidelines skill).
license: MIT
---

# shadcn/ui

shadcn/ui is a collection of accessible, composable React components built on
Radix primitives and styled with Tailwind CSS. It is **not an npm dependency**:
the CLI copies component source **into this project**, so you own the code and
edit it freely. This skill covers how to set it up, add and compose components,
theme them, and let an agent drive shadcn through its MCP server.

This skill is part of this project's `design-system`. It composes with two
sibling skills — apply all three together:

- **brand-guidelines** — the source of truth for brand *token values*
  (`color_brand`, `radius_base`, the type scale, voice, logo). Map those values
  onto shadcn's CSS variables; see `references/theming.md`.
- **frontend-design-guidelines** — *how* UI is composed (layout, spacing, type
  roles, semantic color roles, component states, responsive, accessibility).
  shadcn gives you the parts; that skill governs how you assemble them.

Read this file first; follow a pointer into `references/` when you need depth.

## When to apply

Apply this skill when a task in a **React + Tailwind** surface (Next.js, Remix /
React Router, or Vite) involves:

- initializing shadcn in the project, or creating/repairing `components.json`;
- adding a component (button, dialog, form, table, …) or composing several into
  a feature;
- theming — defining or editing the OKLch CSS variables, light/dark mode, or
  mapping brand tokens onto the shadcn variables;
- adding a component **registry** (the default one or a private/internal one);
- enabling or using the **shadcn MCP** so an agent can browse and install
  components.

## When NOT to apply

- **Non-React or non-Tailwind stacks.** shadcn/ui is native to React + Tailwind.
  This project's fullstack framework can be `next | remix | sveltekit | nuxt`.
  For `next` and `remix` this skill is first-class. For `sveltekit`/`nuxt` the
  React components do **not** apply directly — community ports `shadcn-svelte`
  and `shadcn-vue` exist but have different CLIs and APIs; this skill does not
  cover them. Plain HTML/CSS, Angular, or other frameworks: do not use it.
- **Brand identity** (palette, logo, voice, type families) → brand-guidelines.
- **UI composition rules** (layout, spacing, accessibility mechanics, component
  state matrix) → frontend-design-guidelines.

## The copy-in model (the one mental shift)

Unlike a normal component library, `npx shadcn add button` writes the button's
source into the project's `components/ui/` directory. Consequences:

1. **You own the code.** Edit a component in place; it will not be overwritten by
   a package update because there is no package. Re-running `add` only touches a
   component if you pass `--overwrite`.
2. **No version lock-step.** There is nothing in `package.json` to bump for the
   components themselves (their runtime deps — Radix, `class-variance-authority`,
   `tailwind-merge`, etc. — are normal deps the CLI installs).
3. **The registry is a source, not a runtime.** `add` fetches component
   definitions from a registry URL and writes files; at runtime your app imports
   only your own files under the configured aliases.

## Initialize the project

Run once per project (or per app in a monorepo):

```bash
npx shadcn@latest init
```

`init` detects the framework, installs base deps, sets up Tailwind, writes
`components.json`, and creates the `lib/utils` `cn()` helper. Useful flags:

- `-t, --template <next|vite|react-router|astro|laravel>` — scaffold for a
  specific framework when not auto-detected.
- `-b, --base <radix|base>` — primitive base.
- `--css-variables` — theme via CSS variables (the **default**, `true`); this is
  what makes brand-token theming clean. Keep it on.
- `--monorepo`, `--rtl` — monorepo layout / right-to-left support.

`components.json` is the project's shadcn config. The important fields:

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",                 // current style; old "default" is deprecated
  "rsc": true,                          // React Server Components (Next app router)
  "tsx": true,
  "tailwind": {
    "config": "",                       // empty for Tailwind v4 (CSS-first config)
    "css": "app/globals.css",           // file holding the @theme + CSS vars
    "baseColor": "neutral",             // neutral|stone|zinc|mauve|olive|mist|taupe
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",            // where `add` writes components
    "utils": "@/lib/utils",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "registries": {}                      // extra/private registries (see below)
}
```

`baseColor` picks the neutral ramp; `style` is `new-york`. Full field reference
and the full CLI flag list are in `references/cli.md`.

## Add and compose components

```bash
npx shadcn@latest add button dialog input        # add several at once
npx shadcn@latest add --all                       # add everything
npx shadcn@latest add button --overwrite          # re-fetch, replace local edits
npx shadcn@latest add button --dry-run            # preview, write nothing
npx shadcn@latest add button -p ./packages/ui     # write to a non-default path
```

Components land in the `aliases.ui` directory (`@/components/ui` by default).
Compose them into your own feature components — keep the generated `ui/`
primitives presentational and lift data/logic out, per frontend-design-guidelines.
Patterns for composing forms, dialogs, and data tables, plus the overwrite /
dry-run workflow, are in `references/components.md`.

## Theme with CSS variables (OKLch)

With `cssVariables: true`, every color is a CSS variable in the OKLch color space
(not HSL), declared in `:root` (light) and overridden in `.dark` (dark). Tailwind
v4 exposes them as utilities via `@theme inline` (so `bg-background`,
`text-foreground`, `border-border` resolve to the variables).

The shadcn variable set you theme: `background`/`foreground`,
`card`/`popover` (+ `-foreground`), `primary`/`secondary`/`accent`/`muted`
(+ `-foreground`), `destructive` (+ `-foreground`), `border`, `input`, `ring`,
the `sidebar-*` family, `chart-1..chart-5`, and `--radius` (base `0.625rem`,
with derived `radius-sm/md/lg/xl`).

To apply this project's brand: map the brand-guidelines tokens onto these
variables — e.g. `color_brand` → `--primary`, `color_ink`/`color_paper` →
`--foreground`/`--background`, `radius_base` → `--radius`. The full OKLch token
list, the `:root`/`.dark` blocks, the `@theme inline` mapping, and the brand-token
crosswalk are in `references/theming.md`.

> Render-safety note (this skill ships as a kit template): the theming reference
> ships a **complete static default OKLch theme**. Brand overrides are documented
> there as edits a fork makes; this skill never reads an absent manifest path.

## Dark mode

Dark mode is the `.dark` class toggled on a root element (typically `<html>`),
which swaps the CSS variables. Wire a theme provider/toggle appropriate to the
framework (e.g. `next-themes` for Next.js) that adds/removes the `.dark` class
and respects the OS preference. Because components reference variables and never
hard-code colors, no component branches on theme. See `references/theming.md`.

## Registries (default and private)

`add` pulls from the default shadcn registry. To add components from another
registry — an internal/private design system, or a third-party one — declare it
under `registries` in `components.json`, then reference its namespace:

```jsonc
"registries": {
  "@acme": "https://registry.acme.com/{name}.json"
}
```

```bash
npx shadcn@latest add @acme/data-table
```

The `{name}` placeholder is filled with the requested component name. You can
publish your own registry with `npx shadcn build` (it reads `registry.json` and
emits files under `public/r`). Registry details are in `references/cli.md` and
`references/mcp.md`.

## Enable the shadcn MCP server

The shadcn MCP server lets an agent browse, search, and install components
(across the default and any declared registries) without you hand-running the
CLI. Set it up for Claude Code with:

```bash
npx shadcn@latest mcp init --client claude
```

This writes the server entry into the project's `.mcp.json`. The canonical entry
is:

```json
{ "mcpServers": { "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] } } }
```

This project ships that entry as `../mcp/shadcn.mcp.json` in this `design-system`
subtree, and the fullstack archetype's root `.mcp.json` carries the same `shadcn`
server. The shadcn MCP **composes with** this project's own `features.mcp`
server — they are independent entries under `mcpServers`; enabling shadcn does
not replace or disable any project server. What the MCP exposes, how it is wired,
and how it sits alongside `features.mcp` are in `references/mcp.md`.

## Quick checklist

- React + Tailwind surface? If not, stop (see When NOT to apply).
- `components.json` present with `cssVariables: true` and `style: new-york`.
- Components live under `aliases.ui` (`@/components/ui`); compose, don't fork
  the primitives without reason.
- Colors come from the OKLch CSS variables mapped to brand tokens — no literal
  colors in components (frontend-design-guidelines: "tokens, not magic numbers").
- Light **and** dark themed via `:root`/`.dark`; component states all styled.
- Need agent-driven component work? Enable the shadcn MCP (`references/mcp.md`).
