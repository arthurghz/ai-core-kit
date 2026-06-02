# Typography — brand families

This reference pins the *families*. The numeric type scale and the usage roles
(`display`, `h1`, `body`, …) live in the frontend-design-guidelines typography
reference; map families onto those roles, not onto ad-hoc pixel sizes.

## Family tokens

| Token                  | Default intent          | Example default        |
|------------------------|-------------------------|------------------------|
| `font_family_heading`  | display & headings      | a geometric sans       |
| `font_family_body`     | body & UI text          | a humanist sans/serif  |
| `font_family_mono`     | code, data, tabular     | a monospace            |

These are placeholders — a fork sets real families through `/ack-init`. Keys are
snake_case (decision O4).

## Fallback stacks

Always declare a system fallback after the brand family so text renders before
web fonts load and remains legible if a font fails:

```css
--font-family-heading: var(--brand-heading),
  ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

--font-family-body: var(--brand-body),
  ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

--font-family-mono: var(--brand-mono),
  ui-monospace, SFMono-Regular, "Menlo", "Consolas", monospace;
```

## Rules

1. **Two voices, maybe three.** A heading family and a body family is enough;
   add a mono family only for code/data. More families dilute the identity.
2. **Pair for contrast, not clash.** If the heading family is a strong display
   face, keep the body family quiet and highly readable.
3. **Use `font-display: swap`** (or `optional`) so the fallback shows
   immediately; never block render on a web font.
4. **Match metrics where possible.** Choose a fallback with similar metrics to
   reduce layout shift when the brand font loads.
5. **Map to roles.** A component asks for a type role; the role binds a family +
   the size/line-height/weight from the scale. Components never name a family
   directly.
