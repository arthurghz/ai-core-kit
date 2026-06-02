/* Default shadcn/ui theme for ${project.name} (Tailwind v4, OKLch).
 *
 * Rendered into the child as `app/globals.css` (Next.js App Router) or your
 * framework's global stylesheet. STATIC by design: every value below is a
 * concrete default, so the renderer never sees an unbound `${...}` (an unbound
 * substitution is a hard render error per docs/RENDER-ENGINE.md). The only
 * `${...}` in this file is `${project.name}` above, which is always bound.
 *
 * Base style: new-york. Base color: neutral. Color space: OKLch (oklch(L C H)).
 * To re-brand, override the token VALUES in `:root` / `.dark` only — never the
 * variable names, and never the `@theme inline` mapping (utilities depend on it).
 * See theme.tokens.json for brand-token -> CSS-variable wiring, and README.md.
 *
 * Attribution: token names and OKLch theming convention follow shadcn/ui (MIT);
 * these values are an independently authored default. See ../NOTICE.
 */

@import "tailwindcss";

/* Enables the `dark:` variant to respond to a `.dark` class on a parent
 * (e.g. <html class="dark">) rather than the prefers-color-scheme media query,
 * so theme toggles work. Remove if you prefer OS-driven dark mode only. */
@custom-variant dark (&:is(.dark *));

/* ---------------------------------------------------------------------------
 * Light theme (default). All colors in OKLch: oklch(lightness chroma hue).
 * ------------------------------------------------------------------------- */
:root {
  /* Base radius; the derived radii below are computed from it. */
  --radius: 0.625rem;

  /* Surfaces and text */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  /* Semantic roles */
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

  /* Lines and focus */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);

  /* Data-visualization series */
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);

  /* Sidebar surface (used by the shadcn sidebar block) */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

/* ---------------------------------------------------------------------------
 * Dark theme. Applied when an ancestor carries the `.dark` class. Roles flip
 * (light surfaces become dark, etc.); the variable NAMES stay identical.
 * ------------------------------------------------------------------------- */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);

  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);

  /* In dark mode border/input use a translucent white so they read against the
   * dark surface; ring uses a mid-neutral. */
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

/* ---------------------------------------------------------------------------
 * Tailwind v4 theme bridge. `@theme inline` exposes the CSS variables above as
 * Tailwind utilities (bg-background, text-foreground, border-border, rounded-lg,
 * etc.). Derived radii are computed from --radius so a single change rescales
 * the whole set. Do not rename these — shadcn components reference the utilities.
 * ------------------------------------------------------------------------- */
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

  /* Derived radii: rounded-sm/md/lg/xl all key off the single --radius base. */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* ---------------------------------------------------------------------------
 * Base layer: apply the border color globally and set the page surface/text,
 * matching the shadcn default scaffold.
 * ------------------------------------------------------------------------- */
@layer base {
  * {
    border-color: var(--border);
    outline-color: var(--ring);
  }
  body {
    background-color: var(--background);
    color: var(--foreground);
  }
}
