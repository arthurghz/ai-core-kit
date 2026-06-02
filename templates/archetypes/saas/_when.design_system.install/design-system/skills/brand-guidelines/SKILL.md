---
name: brand-guidelines
description: Apply this project's brand identity to any artifact that should carry the product's look and feel — the design tokens (brand color, neutral and status colors, the type scale, radius, and spacing tokens), the typography families, brand voice and tone, and logo usage rules. The skill is the source of truth for token *values* that the frontend-design-guidelines skill consumes through semantic roles. Use it when a task involves brand colors, the type scale, corporate/visual identity, voice and copy tone, logo placement, or producing a branded document, slide, page, or component. Do NOT use it to decide UI structure, layout, or accessibility mechanics (that is the frontend-design-guidelines skill), and never use it to choose a stack or write backend logic.
license: Apache-2.0
---

# Brand Guidelines

This skill is the source of truth for the project's brand identity: the design
tokens, typography families, voice, and logo usage. The frontend-design-guidelines
skill defines *how* UI is composed and references brand values through semantic
roles; this skill defines the concrete *values* those roles resolve to.

Token keys are **snake_case** matching `^[a-z][a-z0-9_]*$` (decision O4). The
child renderer's lowercase `${var}` regex cannot match a hyphen, so a hyphenated
key would be left un-substituted; snake_case keys are render-safe. The
JSON-Schema enforces this via `tokens.propertyNames`. The values shown below are
sensible defaults — a fork overrides them via `/ack-init` (seed `{}`), and they
materialize into the project's `tokens.json`.

## Design tokens

### Color tokens

Brand and neutral colors. Keys are snake_case; values are placeholders a fork
replaces with its own palette.

| Token              | Default   | Role it feeds                          |
|--------------------|-----------|----------------------------------------|
| `color_brand`      | `#3b5bdb` | `accent` (primary interactive)         |
| `color_brand_dark` | `#2f49af` | `accent_hover`                         |
| `color_ink`        | `#14151a` | `text` (light theme)                   |
| `color_paper`      | `#ffffff` | `surface` (light theme)                |
| `color_muted`      | `#5c6370` | `text_muted`                           |
| `color_border`     | `#e3e6ea` | `border`                               |
| `color_success`    | `#2f9e44` | `success`                              |
| `color_warning`    | `#e8a317` | `warning`                              |
| `color_danger`     | `#e03131` | `danger`                               |
| `color_info`       | `#1c7ed6` | `info`                                 |

Every brand color must satisfy the contrast minima in the frontend
accessibility reference when paired with its on-color. Define a parallel set for
dark theme (e.g. `color_ink` and `color_paper` swap roles); see
`references/tokens.md`.

### Type scale tokens

The numeric type scale lives here as tokens; the frontend type *roles*
(`display`, `h1`, `body`, …) map onto these.

| Token             | Default | Maps to role |
|-------------------|---------|--------------|
| `font_size_display` | `48px`  | `display`    |
| `font_size_h1`      | `32px`  | `h1`         |
| `font_size_h2`      | `24px`  | `h2`         |
| `font_size_body`    | `16px`  | `body`       |
| `font_size_caption` | `12px`  | `caption`    |

### Radius and spacing tokens

| Token            | Default | Use                         |
|------------------|---------|-----------------------------|
| `radius_base`    | `8px`   | default corner radius       |
| `radius_sm`      | `4px`   | inputs, chips               |
| `radius_lg`      | `16px`  | cards, modals               |
| `radius_pill`    | `999px` | pills, avatars              |
| `space_base`     | `16px`  | base spacing unit           |

The spacing *scale* (steps `space_1`…`space_16`) is defined in the frontend
spacing reference; `space_base` here pins its base unit.

The full token table, the dark-theme set, and the tokens.json shape are in
`references/tokens.md`.

## Typography

- `font_family_heading` — display/heading family (default: a geometric sans;
  set a real family per brand).
- `font_family_body` — body family (default: a humanist sans or serif).
- `font_family_mono` — code/data family.

Always declare a system fallback stack after the brand family so text renders
before web fonts load. Map families to the type-scale roles, not to ad-hoc
sizes. Family selection and the fallback stacks are in `references/typography.md`.

## Voice and tone

The brand's writing voice (its consistent personality) plus tone modulation per
context (an error message vs. an onboarding hero). Voice is part of the brand
identity, not decoration. The voice profile, the do/don't word list, and worked
before/after rewrites are in `references/voice.md`.

Defaults: clear over clever; second person ("you"); active voice; sentence case
for UI labels; no jargon or hype. Error copy says what happened and what to do
next.

## Logo usage

Clear space, minimum sizes, approved color treatments (on light, on dark,
monochrome), and a list of prohibited alterations (no stretching, recoloring
outside the approved set, drop shadows, or rotation). Full rules and the asset
inventory are in `references/logo.md`.

## How this skill is consumed

1. **Tokens flow into the frontend layer.** `color_brand` → `accent`,
   `color_ink` → `text`, etc. UI components reference semantic roles; this skill
   pins what each role's value is per theme.
2. **Values are fork-owned.** The defaults here are placeholders. `/ack-init`
   seeds `tokens` as `{}`; a fork supplies real values that materialize into
   `tokens.json`.
3. **Keys stay snake_case.** Never introduce a hyphenated token key — it would
   silently survive the renderer un-substituted (decision O4).
