# Layout primitives

Compose every page from these primitives. They encapsulate the spacing and
alignment decisions so individual components never hand-roll flex/grid rules.

## Stack — vertical rhythm

A Stack lays children out vertically and inserts exactly one spacing token
between them (never a margin on the children themselves).

- `gap` is a spacing-scale step (default `space_4`).
- The Stack owns the gap; children contribute no outer margin.
- Use a "recursive" Stack at the page level and nested Stacks inside sections.

```css
.stack { display: flex; flex-direction: column; }
.stack > * + * { margin-block-start: var(--space-4); }
```

## Cluster — wrapping horizontal group

For rows of items that should wrap gracefully: tag lists, button rows, metadata
chips.

- `gap` from the spacing scale, applied on both axes.
- Wraps by default; never force a single row that can overflow.

```css
.cluster { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
```

## Grid — responsive multi-column

Column count is driven by available width, not device width. Prefer
`auto-fit`/`minmax` so the grid reflows without breakpoints.

```css
.grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
}
```

## Center / Container — line-length cap

Caps measure and centers content. The max width is a token, not a literal.

```css
.container { max-inline-size: var(--measure-page); margin-inline: auto;
  padding-inline: var(--space-4); }
```

## The contract

1. **Layout owns spacing.** Components never set outer margins. If a component
   needs breathing room, the parent Stack/Cluster/Grid provides it. This keeps
   components portable across surfaces.
2. **Container-driven, not device-driven.** A card decides its internal layout
   from the space it is given (container queries / intrinsic sizing), so the
   same card works in a sidebar and a full-width region.
3. **Compose, don't nest deeply.** Three or four primitives compose almost any
   page. Reach for a bespoke grid only for genuinely unique layouts.

## Anti-patterns

- Outer `margin` on a reusable component (breaks portability — use a Stack).
- `position: absolute` for layout flow (reserve it for overlays/badges).
- Fixed pixel heights on content containers (let content size the box).
- Per-component media queries that duplicate the breakpoint tokens.
- Mixing `gap` with sibling margins in the same container.
