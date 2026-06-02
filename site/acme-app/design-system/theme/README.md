# shadcn/ui theme

A complete default [shadcn/ui](https://ui.shadcn.com) theme for this project's
fullstack frontend: a Tailwind v4 stylesheet with the full OKLch token set
(light + dark) and a ready-to-use `components.json`. shadcn components are
copied **into** your repo (not an npm dependency), so you own and edit them.

This subtree renders only when `design_system.install == true` (fullstack
archetype). Files here are **static** (no `.tpl` substitution) except where noted
— they are copied byte-for-byte into the child.

## What's here

| File                  | Goes to (child)                  | Purpose                                                                 |
|-----------------------|----------------------------------|-------------------------------------------------------------------------|
| `globals.css.tpl`     | `app/globals.css`                | Tailwind v4 import, full OKLch token set (`:root` + `.dark`), `@theme inline` utility bridge. Rendered: only `${project.name}` in the top comment is substituted; all values are static. |
| `components.json.tpl` | `components.json` (project root) | shadcn CLI config: `style: new-york`, `baseColor: neutral`, `cssVariables: true`, path aliases, empty `registries`. |
| `theme.tokens.json`   | reference (keep in design-system) | Maps snake_case brand tokens (`color_primary`, `color_background`, `radius_base`, …) to the shadcn CSS variables (`--primary`, `--background`, `--radius`, …) so you can wire brand values into the theme. |

## Applying the theme

The shadcn CLI does not need to scaffold these from scratch — they ship with the
project. To bring in components against this config:

1. Confirm `components.json` is at the project root and `app/globals.css` exists
   (both rendered by `/ack-init`). If your framework's global stylesheet lives
   elsewhere (e.g. Vite/React-Router `src/index.css`, Astro), move
   `globals.css` there and update `tailwind.css` in `components.json` to match.
2. Ensure the file is imported once at the app root (Next.js App Router:
   `import "./globals.css"` in `app/layout.tsx`).
3. Add components:

   ```bash
   npx shadcn@latest add button card dialog
   # or every component:
   npx shadcn@latest add -a
   ```

   Components land in the `aliases.ui` directory (`@/components/ui`) and consume
   the CSS variables defined in `globals.css`.

If you are starting a brand-new app instead of an existing one, you can scaffold
with `npx shadcn@latest init` (`-t next | vite | react-router | astro`), then
replace the generated `globals.css` / `components.json` with the ones here to
inherit this project's defaults.

### Component-browsing via MCP

The fullstack archetype's `.mcp.json` declares a `shadcn` MCP server
(`npx shadcn@latest mcp`) when `features.mcp == true`. With it, an agent can
search and install components (including from private registries declared under
`registries` in `components.json`) without leaving the editor. One-time setup if
the server is not yet wired in a child: `npx shadcn@latest mcp init --client claude`.

## Light and dark mode

Tokens are declared twice in `globals.css`: `:root` (light, the default) and
`.dark` (dark overrides). Dark mode activates when an ancestor element carries
the `.dark` class — the `@custom-variant dark` line in `globals.css` binds the
`dark:` Tailwind variant to that class. Typical wiring: toggle `class="dark"` on
`<html>` (e.g. via `next-themes`). To use OS preference only, replace the custom
variant with a `prefers-color-scheme` media query and drop the toggle.

Every surface token has a paired `*-foreground` (e.g. `--primary` /
`--primary-foreground`) for the text/icon color drawn on top — keep the pair
contrasting when you re-theme.

## Customizing the base color

`baseColor` in `components.json` (`neutral` here) seeds the greyscale ramp the
CLI uses when it generates new components. Supported values: `neutral`, `stone`,
`zinc`, `mauve`, `olive`, `mist`, `taupe`. Changing it affects **newly added**
components' suggested neutrals; it does not rewrite the tokens already in
`globals.css`. To change the actual greys, edit the OKLch values in `globals.css`.

`style` is `new-york` (the current shadcn style; the former `default` is
deprecated). Leave it unless you have a reason to diverge.

## Overriding with brand tokens

`theme.tokens.json` maps your project's brand tokens (the snake_case keys owned
by the `brand-guidelines` skill, e.g. `color_brand`, `color_border`,
`radius_base`) to the shadcn CSS variables. To re-brand:

1. Look up the brand token's value (from the brand-guidelines skill / project
   `tokens.json`).
2. Find its `css_var` in `theme.tokens.json` (e.g. `color_primary` -> `--primary`,
   and note `brand_source: color_brand`).
3. **Convert the value to OKLch.** shadcn uses the OKLch color space
   (`oklch(L C H)` — lightness 0–1, chroma, hue in degrees), *not* hex or HSL. A
   hex brand color like `#3b5bdb` becomes roughly `oklch(0.52 0.21 264)`; use any
   hex→OKLch converter, or your design tool's OKLch readout.
4. Write the OKLch value into the matching variable in **both** `:root` and
   `.dark` of `globals.css` (light and dark should differ — see the existing
   defaults for the lightness flip pattern).

Only edit token **values** in `:root` / `.dark`. Do **not** rename variables or
touch the `@theme inline` block — the Tailwind utilities (`bg-primary`,
`text-foreground`, `rounded-lg`, …) and shadcn components depend on those exact
names. The derived radii (`--radius-sm/md/lg/xl`) recompute from `--radius`
automatically, so changing `radius_base` rescales the whole set.

## License

shadcn/ui is MIT-licensed. The token names and OKLch theming convention here
follow shadcn/ui; the specific values are an independently authored default for
this kit. See the design-system `NOTICE` for the full attribution.
