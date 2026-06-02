# Responsive

## Approach: content-out, fluid-first

Design from the smallest viable layout up, and prefer fluid sizing so fewer
hard breakpoints are needed.

1. Build the single-column, smallest-viewport layout first.
2. Add structure (columns, side regions) only as space allows.
3. Reach for fluid techniques before adding a breakpoint:
   - `clamp()` for fluid type and spacing,
   - `min()`/`max()` for fluid widths,
   - fractional and `auto-fit`/`minmax` grids (see `layout.md`).
4. Use container queries so a component adapts to *its* space, not the device.

## Breakpoint tokens

Breakpoints are named tokens, never scattered pixel literals.

| Token | Min width | Typical shift                          |
|-------|-----------|----------------------------------------|
| `sm`  | 640px     | larger touch targets, looser spacing   |
| `md`  | 768px     | introduce a second column / side nav   |
| `lg`  | 1024px    | multi-column app layout                |
| `xl`  | 1280px    | cap content width, add side rails      |

Define these once as tokens and reference them; do not repeat raw pixel values
in component CSS.

## Rules

1. **Mobile-first media queries** (`min-width`), so the base styles are the
   small layout and larger viewports add to it.
2. **Touch targets ≥ 44×44px** at every breakpoint; spacing must keep adjacent
   targets from overlapping their hit areas.
3. **Both input modes.** Anything revealed on hover must also be reachable by
   tap/keyboard; never gate essential affordances behind hover alone.
4. **Reflow, don't shrink to illegible.** At small sizes, stack and wrap rather
   than scaling text below the `caption` role or squeezing tables — switch dense
   tables to a card/list layout instead.
5. **Test the in-between.** Verify the layout at sizes *between* the named
   breakpoints, not only at the tokens.
