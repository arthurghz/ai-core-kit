# Component architecture

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `ui-design-system` skill.

This file covers how to *structure a component library on top of the generated
tokens*. For the project's house rules on composing UI (layout primitives,
spacing ownership, the "tokens not magic numbers" rule), defer to the
`frontend-design-guidelines` skill — this reference does not restate them.

## Atomic hierarchy

Organize components in four tiers; each tier is built only from the tiers below
it, so a change at a lower tier propagates predictably.

| Tier | Examples | Rule |
|---|---|---|
| **Atoms** | Button, Input, Icon, Label, Badge | no composition of other components |
| **Molecules** | FormField, SearchBar, Card, ListItem | small groups of atoms |
| **Organisms** | Header, Footer, DataTable, Modal | self-contained UI sections |
| **Templates** | DashboardLayout, AuthLayout | arrange organisms; no business data |

## Map components to tokens

Every component consumes tokens — never literal values. A representative map:

| Component | Token categories used |
|---|---|
| Button | colors, sizing, borders, shadows, typography |
| Input | colors, sizing, borders, spacing |
| Card | colors, borders, shadows, spacing |
| Modal | colors, shadows, spacing, z-index, animation |

If a component needs a value not on a scale, the **scale** is wrong (extend it),
not the instance.

## The variant / size / state matrix

A component is **not done** until every cell of this matrix is specified.

**Variants** (visual kind):

```
primary    background colors.primary.500   text #FFFFFF
secondary  background colors.neutral.100    text colors.neutral.900
ghost      background transparent           text colors.neutral.700
danger     background colors.semantic.error.base  text #FFFFFF
```

**Sizes** (from the sizing tokens):

```
sm  height 32px  paddingX 12px  fontSize 14px
md  height 40px  paddingX 16px  fontSize 16px
lg  height 48px  paddingX 20px  fontSize 18px
```

**States** — all of them, every time:

```
default · hover · active · focus-visible · disabled · loading · error
```

A `hover` with no `focus-visible` style is an accessibility defect: keyboard
users get no affordance. Specify `focus-visible` explicitly.

## Naming & props

- **Component names** are PascalCase; **prop names** are camelCase; **token
  paths** are the dotted/hyphenated names the generator emits.
- Expose a small, typed prop surface: `variant`, `size`, `disabled`, `loading`,
  plus content via `children`. Avoid boolean-explosion (`isPrimary`,
  `isSecondary`, …) — use one `variant` enum instead.
- Keep components **presentational and prop-driven**. Data fetching and business
  logic live above the visual layer, not inside the component.

## Worked example — Button (props)

```ts
type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  children: ReactNode;
};
```

Anatomy: `[ container [ iconLeft? ] [ label ] [ spinner (when loading) ] ]`.
Build it on a real `<button>` element so keyboard, focus, and ARIA come for free.

## Documentation checklist (per component)

- [ ] Anatomy diagram (named parts).
- [ ] Variant list with token bindings.
- [ ] Size list with token bindings.
- [ ] Every state styled, including `focus-visible`.
- [ ] Typed props interface.
- [ ] Accessibility notes (semantic element, ARIA only where no native exists).
