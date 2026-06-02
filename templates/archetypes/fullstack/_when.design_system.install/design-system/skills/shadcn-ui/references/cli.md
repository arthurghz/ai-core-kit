# CLI — init, add, build, mcp

All commands are run through `npx shadcn@latest <command>` (no global install
needed). The CLI reads `components.json` for aliases, the CSS file, and registries.

## `init`

```bash
npx shadcn@latest init
```

Detects the framework, installs base dependencies, sets up Tailwind, writes
`components.json`, and creates the `cn()` helper at `aliases.utils`.

| Flag | Effect |
|------|--------|
| `-t, --template <name>` | scaffold for a framework: `next`, `vite`, `react-router`, `astro`, `laravel` |
| `-b, --base <radix\|base>` | primitive base |
| `--css-variables` | theme via CSS variables — **default `true`**; keep on for clean brand theming |
| `--monorepo` | set up a monorepo-aware layout |
| `--rtl` | right-to-left support |

For this project's fullstack frameworks: use `-t next` for Next.js and
`-t react-router` for Remix / React Router. `vite` is for a Vite-based React app.
(`sveltekit`/`nuxt` are not React+Tailwind shadcn targets — see the SKILL.md
"When NOT to apply" note about the community ports.)

### `components.json` fields

| Field | Meaning |
|-------|---------|
| `$schema` | `https://ui.shadcn.com/schema.json` |
| `style` | `new-york` (the old `default` is deprecated) |
| `rsc` | React Server Components (true for Next.js app router) |
| `tsx` | TypeScript components |
| `tailwind.config` | path to a Tailwind config (empty for v4 CSS-first) |
| `tailwind.css` | the CSS file holding `@theme` + the CSS variables |
| `tailwind.baseColor` | `neutral\|stone\|zinc\|mauve\|olive\|mist\|taupe` |
| `tailwind.cssVariables` | `true` (default) — theme via variables |
| `tailwind.prefix` | Tailwind class prefix (usually empty) |
| `aliases.components` | base components dir (`@/components`) |
| `aliases.ui` | where `add` writes primitives (`@/components/ui`) |
| `aliases.utils` | `cn()` helper (`@/lib/utils`) |
| `aliases.lib` | shared lib (`@/lib`) |
| `aliases.hooks` | hooks dir (`@/hooks`) |
| `registries` | map of `@namespace` → registry URL template |

## `add`

```bash
npx shadcn@latest add [component...]
```

| Flag | Effect |
|------|--------|
| `-a, --all` | add every component in the registry |
| `-o, --overwrite` | re-fetch and replace existing files |
| `-p, --path <dir>` | write to a path other than `aliases.ui` |
| `--dry-run` | print planned changes, write nothing |

Components are written to `aliases.ui`. To pull from a declared registry, prefix
the name with its namespace: `npx shadcn@latest add @acme/data-table`.

## `build`

```bash
npx shadcn@latest build
```

Reads a `registry.json` and emits the registry's component files under `public/r`
so they can be served as a registry others (or your own MCP) can `add` from. Use
this to publish an internal/private design-system registry.

## `mcp`

```bash
npx shadcn@latest mcp init --client claude   # write the Claude Code .mcp.json entry
npx shadcn@latest mcp                          # run the MCP server (what the entry invokes)
```

`mcp init --client claude` writes the `shadcn` server into the project's
`.mcp.json`. Supported clients and their config files:

| Client | Config file | Server key |
|--------|-------------|------------|
| Claude Code | `.mcp.json` | `mcpServers` |
| Cursor | `.cursor/mcp.json` | `mcpServers` |
| VS Code | `.vscode/mcp.json` | `servers` |
| Codex | `~/.codex/config.toml` | (TOML) |

See `references/mcp.md` for the server entry and how it composes with the
project's own `features.mcp` server.

## Registries (incl. private)

Declare extra registries under `registries` in `components.json`:

```jsonc
"registries": {
  "@acme": "https://registry.acme.com/{name}.json"
}
```

`{name}` is substituted with the requested component name on `add`. Private
registries work the same way; supply auth via the registry URL / environment as
that registry requires. Publish your own with `build` (above).
