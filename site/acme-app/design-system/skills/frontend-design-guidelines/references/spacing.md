# Spacing

## The scale

Use one modular scale on a 4px base. Every margin, padding, and gap is a step.

| Token        | Value | Typical use                                  |
|--------------|-------|----------------------------------------------|
| `space_1`    | 4px   | hairline gaps, icon-to-label                 |
| `space_2`    | 8px   | tight padding, chip internals                |
| `space_3`    | 12px  | compact control padding                      |
| `space_4`    | 16px  | default gap, card padding (base unit)        |
| `space_6`    | 24px  | section internal spacing                     |
| `space_8`    | 32px  | between distinct content blocks              |
| `space_12`   | 48px  | section separation                           |
| `space_16`   | 64px  | major page-region separation                 |

Steps are intentionally non-linear (they grow faster as they get larger) so
adjacent steps are visually distinct. Do not interpolate between steps; if a
layout seems to need `space_5`, reconsider the composition instead.

## Rules

1. **No magic numbers.** A literal `padding: 13px` is a defect. Resolve every
   value to a token.
2. **Space is owned by the parent.** The layout primitive (Stack/Cluster/Grid)
   inserts gaps; children carry no outer margin. This is what makes a component
   reusable in any context — see `layout.md`.
3. **Inner vs outer.** A component owns its *internal* padding (its own
   breathing room) but never its *external* margin (that belongs to the layout).
4. **Pair spacing with the type scale.** Vertical rhythm between text blocks
   should relate to line-height, not be chosen arbitrarily.

## Density modes

A surface picks one density and applies it consistently:

- **Compact** — data-dense tables/dashboards; control padding `space_2`/`space_3`.
- **Default** — most application UI; control padding `space_3`/`space_4`.
- **Comfortable** — marketing/onboarding; control padding `space_4`/`space_6`.

Do not mix densities within one surface. If two regions need different
densities, treat them as different surfaces with a clear boundary.
