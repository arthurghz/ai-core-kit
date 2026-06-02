# Color

Apply color through **semantic roles**, never raw hex/rgb values. The brand
layer (brand-guidelines skill) maps each role to a concrete brand token; this
reference defines the roles and the rules for using them.

## Semantic roles

| Role             | Meaning                                          |
|------------------|--------------------------------------------------|
| `surface`        | base background of a region                      |
| `surface_raised` | elevated background (cards, menus, popovers)     |
| `surface_sunken` | recessed background (wells, code blocks)         |
| `text`           | primary foreground text                          |
| `text_muted`     | secondary / supporting text                      |
| `text_on_accent` | text placed on an accent fill                    |
| `border`         | dividers and component outlines                  |
| `border_focus`   | focus ring                                       |
| `accent`         | primary interactive / emphasis color            |
| `accent_hover`   | accent under hover/active                        |
| `success`        | positive status                                  |
| `warning`        | cautionary status                                |
| `danger`         | destructive / error status                       |
| `info`           | neutral informational status                     |

Components reference roles (`color: var(--text)`); they never branch on the
theme. A role resolves to one value in light and another in dark — flipping
themes is a token-table swap, not a component change.

## Rules

1. **Roles, not literals.** A raw `#3a7` in a component is a defect.
2. **Color signifies; it does not decorate.** A second accent must carry a
   distinct meaning from the first. Reach for whitespace and weight before
   another hue.
3. **Status colors are reserved.** `success/warning/danger/info` mean status —
   do not use `danger` red as a decorative accent.
4. **Never color-only.** Pair every color signal with a non-color cue (icon,
   text, shape) so the meaning survives color-blindness and grayscale.

## Contrast (WCAG 2.2 AA)

| Content                                   | Minimum ratio |
|-------------------------------------------|---------------|
| Body text (`text` on `surface`)           | 4.5:1         |
| Large text (≥24px, or ≥19px bold)         | 3:1           |
| UI components, borders, graphical objects | 3:1           |
| Focus ring against adjacent colors        | 3:1           |

Verify both themes. `text_muted` is the role most likely to fail — check it on
every surface it appears on. Disabled controls are exempt from contrast minima
but must still be perceivable and clearly non-interactive.
