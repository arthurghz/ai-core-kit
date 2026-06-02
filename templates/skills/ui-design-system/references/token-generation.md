# Token generation — algorithms & export formats

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Reference for `scripts/design_token_generator.py`.

## Color: the HSV scale algorithm

The generator works in HSV space (Python's stdlib `colorsys`), not RGB, so a
scale stays perceptually coherent: hue is held constant while saturation and
value are walked across ten steps.

For each step `s` in `[50,100,…,900]`:

```
value (V):       0.95               if s < 500
                 V_base · (1 − (s−500)/500)   if s ≥ 500
saturation (S):  S_base · (0.3 + 0.7 · s/900)
hue (H):         held at H_base
```

- Steps **below 500** sit at a fixed high brightness (0.95) and ramp
  saturation up — light tints for backgrounds, borders, and hover surfaces.
- Step **500** is the brand color itself (`DEFAULT`).
- Steps **above 500** darken toward 900 while saturating — for text, active
  states, and headings.

The **secondary** palette is the brand hue rotated 180° (complementary). The
**neutral** ramp is a fixed, hand-tuned gray scale (it does not derive from the
brand color, so neutrals never pick up a colored cast).

`semantic` colors (success/warning/error/info) are fixed, accessible defaults;
each carries a `contrast` value — the text color to draw on top of `base`.

## Type: the modular scale

A modular scale multiplies a base size by a ratio raised to the step distance:

```
size(step) = base · ratio^(step − base_index)
```

Defaults: `base = 16px`, `ratio = 1.25` (a "major third"). Steps below `base`
divide instead of multiply. Result (rounded):

| Token | px | Derivation |
|---|---|---|
| xs | 10 | 16 ÷ 1.25² |
| sm | 13 | 16 ÷ 1.25 |
| base | 16 | — |
| lg | 20 | 16 × 1.25 |
| xl | 25 | 16 × 1.25² |
| 2xl | 31 | 16 × 1.25³ |
| 3xl | 39 | 16 × 1.25⁴ |
| 4xl | 49 | 16 × 1.25⁵ |
| 5xl | 61 | 16 × 1.25⁶ |

Pick the role by **meaning** (heading vs. body vs. caption), never by eyeballing
a pixel value — that is the discipline `frontend-design-guidelines` enforces.

## Spacing: the 8pt grid

Every spacing token is an integer multiple of an 8px base unit. The numeric
scale runs `0 → 64` via the multiplier set
`[0, .5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 20, 24, 32, 40, 48, 56, 64]`,
and semantic aliases (`xs`–`3xl`) point at the common steps. An 8pt grid keeps
layouts aligned and divisible across breakpoints.

## WCAG contrast (validate before shipping)

| Level | Normal text | Large text / UI objects |
|---|---|---|
| **AA** (floor) | 4.5:1 | 3:1 |
| AAA | 7:1 | 4.5:1 |

Large text = ≥ 18pt regular, or ≥ 14pt bold. To compute a ratio: convert each
color to relative luminance `L`, then `(L_lighter + 0.05) / (L_darker + 0.05)`.
If a step fails for its intended pairing, move one step along the scale rather
than editing a hex — the scale stays the single source of truth.

## Export formats

| Format | Shape | Consumed by |
|---|---|---|
| `json` | nested object | Tailwind config, Figma Tokens Studio, JS/TS |
| `css` | `:root { --path: value; }` | any CSS/vanilla project, CSS-in-JS theming |
| `scss` | `$path: value;` | Sass build pipelines |

The CSS and SCSS exporters flatten the nested object with `-`-joined paths
(e.g. `colors.primary.500` → `--colors-primary-500` / `$colors-primary-500`).
The `summary` format prints category counts for a quick sanity check and emits
no files.
