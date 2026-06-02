---
name: ui-design-system
description: >
  Generates and exports a design-token system from a brand color — color scales,
  a modular type scale, an 8pt spacing grid, radii, shadows, breakpoints, and
  z-index layers — in JSON, CSS custom properties, or SCSS, and produces the
  documentation a developer needs to consume them. Use when the user asks to
  "generate design tokens", "create a color palette / type scale / spacing
  system", "export CSS variables or SCSS tokens", "set up a design system from a
  brand color", "wire tokens into Tailwind / styled-components", or "prepare a
  design-to-dev handoff". Do NOT use this for the project's UI composition house
  rules (layout, component anatomy, accessibility decisions) — that lives in the
  design-system/frontend-design-guidelines skill — nor for picking the brand
  palette or voice (brand-guidelines). This skill produces the token *values and
  artifacts*; those skills govern *how* tokens are applied.
license: MIT
---

# ui-design-system — token generation & developer handoff

This skill turns a single brand color into a complete, exportable design-token
system and the handoff material that makes those tokens usable in code. It is the
**tooling** layer of the design stack: it produces token *values and files*.

> **Where this sits.** If this project shipped the design-system pack, the
> `frontend-design-guidelines` skill already governs *how* to compose UI (layout
> primitives, spacing ownership, component states, accessibility) and
> `brand-guidelines` holds the chosen palette and voice. This skill does not
> restate those rules — it generates the concrete token artifacts they reference
> and prepares the developer handoff. Read those skills for *application*; use
> this one to *produce and export* the tokens.

## When to use

- "Generate design tokens from `#0066CC`."
- "I need a 10-step color scale / a 1.25 type scale / an 8pt spacing grid."
- "Export the tokens as CSS variables / SCSS / a JSON file for Tailwind."
- "Convert this brand color into a full palette and check WCAG contrast."
- "Prepare the token handoff for the front-end team."

## When NOT to use

- Composing or reviewing actual UI (layout, component structure, focus order) —
  use `frontend-design-guidelines`.
- Choosing the brand palette, logo, or voice — use `brand-guidelines`.
- Backend, data-layer, or stack-selection work.

## Procedure

### 1. Gather inputs

| Input | Values | Default |
|---|---|---|
| Brand color | hex (`#RRGGBB`) | `#0066CC` |
| Style preset | `modern` \| `classic` \| `playful` | `modern` |
| Output format | `json` \| `css` \| `scss` \| `summary` | `json` |

The style preset only changes font families, border radii, and shadow depth —
the color, type, and spacing algorithms are identical across presets.

### 2. Generate the token set

```bash
python3 scripts/design_token_generator.py "#0066CC" --style modern --format summary
```

The generator emits nine token categories: `colors` (primary, secondary,
neutral, semantic, surface), `typography` (families, sizes, weights, line
heights, letter spacing, composed text styles), `spacing` (8pt grid + semantic
aliases), `sizing` (containers + component sizes), `borders`, `shadows`,
`animation`, `breakpoints`, and `z-index`. The algorithms are documented in
`references/token-generation.md`.

### 3. Validate accessibility before exporting

- Body text must clear **WCAG AA 4.5:1**; large text (≥ 18pt, or ≥ 14pt bold)
  and UI/graphical objects must clear **3:1**.
- Every semantic color (`success`/`warning`/`error`/`info`) ships a `contrast`
  value for text drawn on it — confirm those pairings pass.
- If a generated step fails contrast for its intended use, move one step up or
  down the scale rather than hand-editing a hex; the scale is the source of
  truth (see `frontend-design-guidelines` → "tokens, not magic numbers").

### 4. Export in the target format

```bash
# CSS custom properties (:root variables)
python3 scripts/design_token_generator.py "#0066CC" --format css  > design-tokens.css

# SCSS variables
python3 scripts/design_token_generator.py "#0066CC" --format scss > _design-tokens.scss

# JSON for Tailwind / Figma Tokens Studio / JS tooling
python3 scripts/design_token_generator.py "#0066CC" --format json > design-tokens.json
```

Framework wiring (Tailwind config, styled-components, CSS-vars import) and Figma
sync are in `references/developer-handoff.md`.

### 5. Document the component system

When the request extends to a component library, structure it with atomic design
(atoms → molecules → organisms → templates), map each component to the tokens it
consumes, and specify every variant, size, and **state** (default, hover, active,
focus-visible, disabled, loading). A component without a `focus-visible` style is
not done. The full anatomy templates and the variant/size/state matrix are in
`references/component-architecture.md`. For responsive scales (breakpoints, fluid
type via `clamp()`, responsive spacing), see `references/responsive-calculations.md`.

### 6. Write the design-system doc

Fill `assets/design_system_doc_template.md` with the generated values and the
handoff checklist so the tokens, component rules, and integration steps live in
one place the front-end team can follow.

## Quick reference

### Color scale (50 → 900)

| Step | Role |
|---|---|
| 50–100 | subtle / light backgrounds |
| 200–300 | hover states, borders |
| 400 | disabled |
| **500** | **base / default** |
| 600–700 | hover (dark), active |
| 800–900 | text, headings |

### Type scale (1.25 "major third", 16px base)

`xs 10 · sm 13 · base 16 · lg 20 · xl 25 · 2xl 31 · 3xl 39 · 4xl 49 · 5xl 61` (px)

### Style presets

| Aspect | modern | classic | playful |
|---|---|---|---|
| Sans | Inter | Helvetica | Poppins |
| Mono | Fira Code | Courier | Source Code Pro |
| Default radius | 8px | 4px | 16px |
| Shadows | layered, subtle | single layer | soft, pronounced |

## Tooling

- `scripts/design_token_generator.py` — `<brand_color> [--style modern|classic|playful] [--format json|css|scss|summary]`. Stdlib only (`colorsys`); writes to stdout.

## Reference files

| File | Content |
|---|---|
| `references/token-generation.md` | Color algorithm (HSV), type-scale math, WCAG contrast, export formats |
| `references/component-architecture.md` | Atomic design, naming, props, the variant/size/state matrix |
| `references/responsive-calculations.md` | Breakpoints, fluid typography, responsive spacing |
| `references/developer-handoff.md` | Tailwind / styled-components / CSS-vars wiring, Figma sync, handoff checklist |

## Definition of done

- Brand color supplied as hex; style preset matches the product.
- All nine categories generated; semantic colors carry contrast values.
- Tokens exported in the format the codebase consumes.
- Contrast checked (AA floor) before handoff.
- Component states — including `focus-visible` — specified for every component.
- The design-system doc is filled and points at the exported token files.
