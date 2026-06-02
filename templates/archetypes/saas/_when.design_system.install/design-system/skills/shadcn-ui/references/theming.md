# Theming — OKLch CSS variables, dark mode, brand mapping

shadcn/ui themes through **CSS variables in the OKLch color space** (not HSL).
With `cssVariables: true` (the default), every color resolves to a variable
declared in `:root` (light theme) and overridden in `.dark` (dark theme).
Tailwind v4 exposes those variables as utility classes via `@theme inline`, so
`bg-background`, `text-foreground`, `border-border`, `rounded-lg`, etc. all read
the variables.

> This reference ships a **complete static default OKLch theme** so a child
> renders without referencing any manifest path. Brand colors are applied as
> **edits a fork makes** to these values (see "Mapping brand tokens" below); this
> file never reads an absent token path.

## The variable set

You theme this full set of variables (each as an OKLch triple `L C H`):

- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--popover`, `--popover-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--accent`, `--accent-foreground`
- `--muted`, `--muted-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`
- `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`,
  `--sidebar-primary-foreground`, `--sidebar-accent`,
  `--sidebar-accent-foreground`, `--sidebar-border`, `--sidebar-ring`
- `--chart-1` … `--chart-5`
- `--radius` (base `0.625rem`), with derived `radius-sm/md/lg/xl`

## Complete default theme (neutral base)

Drop this into the CSS file named by `tailwind.css` in `components.json` (e.g.
`app/globals.css`). It is a complete, self-contained neutral theme — no missing
values, safe to render as-is.

```css
@import "tailwindcss";

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

## Expose the variables to Tailwind v4

Tailwind v4 uses `@theme inline` to turn the CSS variables into utilities. Add
this alongside the blocks above so `bg-background`, `text-foreground`,
`border-border`, and the radius utilities resolve:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

## baseColor

`tailwind.baseColor` in `components.json` picks the neutral ramp the defaults are
generated from: one of `neutral | stone | zinc | mauve | olive | mist | taupe`.
The theme above uses the `neutral` ramp (`C = 0`). Choosing a different base
shifts the neutral hue; pick once and keep it.

## Dark mode

`.dark` is a class toggled on a root element (usually `<html>`). When present, its
variable overrides take effect and the whole UI flips — components never branch on
theme because they read the variables. Wire a provider/toggle for the framework
(e.g. `next-themes` for Next.js) that adds/removes `.dark` and honors the OS
preference (`prefers-color-scheme`). See frontend-design-guidelines for the
"build for both themes via roles" rule.

## Mapping brand tokens onto shadcn variables

The sibling **brand-guidelines** skill is the source of truth for brand token
*values* (snake_case keys like `color_brand`, `color_ink`, `color_paper`,
`radius_base`). To make shadcn carry the brand, replace the relevant default
values above with the brand values, converting hex to OKLch (any color tool or
`oklch()` with an `from` color works):

| brand-guidelines token | shadcn variable(s) |
|------------------------|--------------------|
| `color_brand`          | `--primary` (and `--ring`, `--sidebar-primary`) |
| `color_brand_dark`     | `--primary` in `.dark`, hover/active states |
| `color_on_brand`       | `--primary-foreground` |
| `color_ink`            | `--foreground`, `--card-foreground` (light) |
| `color_ink_muted`      | `--muted-foreground` |
| `color_paper`          | `--background`, `--card` (light) |
| `color_paper_raised`   | `--card` / `--popover` |
| `color_border`         | `--border`, `--input` |
| `color_danger`         | `--destructive` |
| dark-theme brand tokens | the corresponding `.dark` overrides |
| `radius_base`          | `--radius` |

Keep `*-foreground` pairs contrast-checked against their background (the
frontend-design-guidelines accessibility floor: body text ≥ 4.5:1, UI ≥ 3:1).
Do not introduce raw colors in components — always go through these variables.

## See also

- sibling **brand-guidelines** — the brand token values and the dark-theme set.
- sibling **frontend-design-guidelines** — semantic color roles, contrast minima.
- `references/cli.md` — `init --css-variables`, `baseColor`.
