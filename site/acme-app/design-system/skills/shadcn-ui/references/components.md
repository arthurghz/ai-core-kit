# Components — adding and composing

shadcn/ui components are **copied into the project**, not installed as a package.
The CLI fetches a component's source from a registry and writes it to your
`aliases.ui` directory. You own the result and edit it in place.

## Where components land

The `add` command writes to the directory named by `aliases.ui` in
`components.json` (default `@/components/ui`, i.e. `components/ui/`). Each
component is one or more `.tsx` files plus any small helpers it needs. Shared
utilities go to `aliases.lib`/`aliases.utils` (the `cn()` class-merge helper
lives at `@/lib/utils`).

Keep the generated `ui/` files as **presentational primitives**. Build your
feature components (in `aliases.components`, e.g. `components/`) by composing the
primitives, and lift data fetching and business logic out of the visual layer —
this is the frontend-design-guidelines "presentational and prop-driven" rule.

## Adding components

```bash
npx shadcn@latest add button                 # one component
npx shadcn@latest add button dialog input    # several at once
npx shadcn@latest add --all                   # every component in the registry
```

Common flags:

| Flag | Effect |
|------|--------|
| `-a, --all` | add all available components |
| `-o, --overwrite` | re-fetch and replace existing files (loses local edits) |
| `-p, --path <dir>` | write to a path other than `aliases.ui` |
| `--dry-run` | print what would change; write nothing |

### Overwrite vs. own edits

Because you own the files, re-running `add <name>` without `--overwrite` will not
clobber a component you have customized. Use `--overwrite` deliberately when you
want to pull the upstream version back (e.g. to pick up a fix), and re-apply your
edits afterward. Use `--dry-run` first to see the diff surface before committing.

## Composing common components

These are composition shapes, not copy-paste code — adapt to the project's
conventions and apply frontend-design-guidelines (states, spacing owned by the
layout, semantic color roles).

### Button

The `button` primitive is variant- and size-driven (via
`class-variance-authority`). Use the semantic variants (`default`/primary,
`secondary`, `ghost`, `destructive`, `outline`, `link`) rather than ad-hoc
classes, and make sure every interactive state — including `focus-visible` — is
covered (the variants ship these; do not strip them).

### Form

shadcn forms compose `form` (a thin wrapper over `react-hook-form`) with the
field primitives (`label`, `input`, `select`, `checkbox`, …) and a resolver
(e.g. `zod`). Pattern:

1. Define a schema (zod) for the form's data.
2. Create the form with the resolver.
3. Render `FormField` per field, each wiring a `FormLabel`, the control, and
   `FormMessage` for validation output.

This keeps labels tied to controls (accessibility) and validation messages in a
consistent place.

### Dialog / Sheet / Popover

These layer on Radix overlays and bring focus trapping, escape-to-close, and
ARIA wiring for free — do not reimplement that behavior. Compose a `Dialog` from
its `Trigger`, `Content`, `Header`/`Footer`, and `Title`/`Description` parts. The
`Title` and `Description` are what assistive tech announces; always provide them.

### Data table

The `table` primitives are presentational; pair them with a headless table engine
(e.g. TanStack Table) for sorting, filtering, and pagination. Keep the engine and
data fetching outside the `ui/` primitives — the table component renders rows it
is handed.

## Multi-app / monorepo

In a monorepo, run `init` per app (or per shared UI package) and point
`aliases.ui` at the right location, or use `add -p <dir>` to target a package.
`init --monorepo` sets up the layout. Keep one shared `components.json` per
package so theming and aliases stay consistent.

## See also

- `references/cli.md` — full `init`/`add`/`build` flags and framework templates.
- `references/theming.md` — making the added components match the brand.
- `references/mcp.md` — letting an agent add/compose components via the MCP.
- sibling **frontend-design-guidelines** skill — the component state matrix,
  anatomy, and accessibility checklist these compositions must satisfy.
