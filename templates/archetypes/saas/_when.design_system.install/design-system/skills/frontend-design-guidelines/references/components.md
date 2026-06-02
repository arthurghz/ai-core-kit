# Components

Every reusable component is specified along four axes. A component is not
"done" until all four are defined.

## The four axes

- **Anatomy** — the named parts (e.g. a Button has `root`, `icon`, `label`).
- **Variants** — visual kinds with distinct meaning: `primary`, `secondary`,
  `ghost`, `danger`.
- **Sizes** — drawn from the size scale: `sm`, `md`, `lg` (padding from the
  spacing scale, text from the type scale).
- **States** — `default`, `hover`, `active`, `focus-visible`, `disabled`,
  `loading`, and where relevant `error` / `selected`.

A hover style with no `focus-visible` style is an incomplete component.

## Variant × state matrix

Specify each cell, or explicitly note it is identical to another:

| State          | primary                     | secondary                  | ghost                  |
|----------------|-----------------------------|----------------------------|------------------------|
| default        | `accent` fill, `text_on_accent` | `surface_raised`, `border` | transparent, `accent` text |
| hover          | `accent_hover`              | border emphasis            | faint `surface_raised` |
| active         | darker accent               | pressed inset              | pressed inset          |
| focus-visible  | `border_focus` ring         | `border_focus` ring        | `border_focus` ring    |
| disabled       | reduced opacity, no pointer | reduced opacity, no pointer| reduced opacity        |
| loading        | spinner, label hidden, width preserved | same          | same                   |

## Rules

1. **Build on correct primitives.** Use a real `<button>`, a labeled `<input>`,
   a native `<a>` for navigation. Do not reimplement focus, keyboard handling,
   and ARIA that the platform already provides.
2. **Presentational and prop-driven.** Keep data fetching and business logic
   out of the visual component; pass data and callbacks in as props.
3. **States are tokenized.** Hover/active/focus colors come from semantic roles
   (see `color.md`), not bespoke values.
4. **Preserve layout across states.** A loading button keeps its width; an
   error field reserves space for its message so the layout does not jump.

## Worked example — Button

```
anatomy : root(button) > [icon?] label [icon?]
variants: primary | secondary | ghost | danger
sizes   : sm (text body_sm, padding space_2/space_3)
          md (text body,    padding space_3/space_4)
          lg (text body_lg, padding space_4/space_6)
states  : default hover active focus-visible disabled loading
a11y    : native <button>; type set explicitly; aria-busy when loading;
          icon-only buttons carry an aria-label
```

## Worked example — Text field

```
anatomy : root > label, control(input), [hint], [error]
states  : default focus-visible disabled error
a11y    : <label for> tied to input id; error referenced via
          aria-describedby; aria-invalid on error; hint also via
          aria-describedby; never rely on placeholder as the label
```
