# Typography

Type families come from the brand layer (see the brand-guidelines skill). This
reference defines the *scale and usage roles* — the structural decisions.

## The type scale

A fixed set of role → size/line-height/weight pairings. Choose a role by
*meaning*, never by eyeballing a pixel size.

| Role       | Size  | Line-height | Weight   | Use                                  |
|------------|-------|-------------|----------|--------------------------------------|
| `display`  | 48px  | 1.05        | 700      | hero / marketing headline            |
| `h1`       | 32px  | 1.15        | 700      | page title                           |
| `h2`       | 24px  | 1.25        | 600      | section heading                      |
| `h3`       | 20px  | 1.3         | 600      | subsection heading                   |
| `h4`       | 16px  | 1.4         | 600      | card / group heading                 |
| `body_lg`  | 18px  | 1.6         | 400      | lead paragraph                       |
| `body`     | 16px  | 1.6         | 400      | default body copy                    |
| `body_sm`  | 14px  | 1.5         | 400      | secondary / dense UI text            |
| `caption`  | 12px  | 1.4         | 500      | labels, metadata, captions           |

Line-height scales inversely with size: tight for display, generous for body.

## Rules

1. **Use roles, not literals.** A component asks for `body_sm`, not `14px`.
2. **One scale.** Do not introduce a size that is not a role. A missing role
   means the scale is incomplete — fix the scale, not the instance.
3. **Measure (line length).** Keep body copy at ~60–75 characters per line; cap
   it with the layout Container, not per-paragraph widths.
4. **Hierarchy via the scale + weight + space**, not via color. Two heading
   levels should differ in size/weight, not (only) in hue.
5. **Tabular figures** for numeric columns in tables and data UI so digits
   align. Use proportional figures for running prose.
6. **Truncation is explicit.** Decide per element whether text truncates,
   wraps, or clamps to N lines — never let it overflow its container.

## Headings

- Exactly one `h1` per page (the page title); do not skip levels for styling.
- If a visual size is wanted but the semantic level differs, style with the
  type role and keep the correct heading element for document structure.
