---
name: frontend-design-guidelines
description: Apply this project's frontend design guidelines when building or refining any user interface — layout, spacing, the type scale, color usage, component anatomy, responsive behavior, and accessibility. The skill enforces consistent, polished UI decisions instead of one-off ad-hoc styling. Use it when the user asks to build, style, or review a web component, page, screen, form, dashboard, or marketing layout, or when a change touches visual structure, sizing, contrast, focus order, or breakpoints. Do NOT use it for brand identity decisions (color palette, logo, voice — see the brand-guidelines skill), for backend or data-layer work, or for choosing the tech stack.
license: Apache-2.0
---

# Frontend Design Guidelines

These are the project's house rules for building polished, consistent user
interfaces. They describe *how* to compose UI — the structural and perceptual
decisions that make a product feel deliberate. Brand identity (the specific
palette, logo, type families, and voice) lives in the **brand-guidelines**
skill; consult that skill for token *values* and apply the structure here.

Read this file first. When a topic needs depth, follow the pointer into
`references/`.

## When to apply

Apply these guidelines whenever a task creates or changes visual structure:
new components or pages, restyling, layout refactors, responsive fixes,
contrast or focus changes, and design reviews. They are framework-agnostic —
the same principles hold for React, Vue, Svelte, or plain HTML/CSS.

## Core principles

1. **Tokens, not magic numbers.** Every spacing, radius, color, and font-size
   value resolves to a named design token (see the brand-guidelines token set).
   A literal `13px` or `#3a7` in a component is a defect — it cannot be themed,
   audited, or kept consistent.
2. **One scale per dimension.** Spacing comes from one spacing scale,
   type from one type scale, radius from one radius scale. Never introduce a
   value that is not on the scale; if the scale lacks what you need, the scale
   is wrong, not the instance.
3. **Hierarchy is earned with size, weight, and space — not with more color.**
   Reach for whitespace and weight before adding another accent color.
4. **Accessibility is a constraint, not a finishing pass.** Contrast, focus
   order, hit-target size, and semantic structure are decided while building,
   not bolted on afterward.
5. **Consistency beats novelty inside a product.** Distinctiveness belongs to
   the brand layer. A given product surface should feel like one hand drew it.

## Layout

Compose pages from a small set of layout primitives rather than bespoke
flex/grid declarations per component:

- **Stack** — vertical rhythm; children separated by one spacing token.
- **Cluster** — horizontal group that wraps; used for tag rows, button rows.
- **Grid** — responsive multi-column; column count driven by container width,
  not device width.
- **Center / Container** — caps line length and centers content; the page max
  width is a token, not a literal.

Prefer container-driven responsiveness (the component adapts to the space it is
given) over device-width media queries scattered across components. Keep layout
concerns in layout primitives; keep components unaware of where they sit.

Full primitive definitions, the grid contract, and anti-patterns are in
`references/layout.md`.

## Spacing

- Use a single modular spacing scale (e.g. a 4px base: 4, 8, 12, 16, 24, 32,
  48, 64). Every margin, padding, and gap is one step on this scale.
- Spacing belongs to the **parent/layout**, not the child. Components do not
  carry outer margins; the surrounding Stack/Cluster/Grid owns the gaps. This
  keeps components reusable in any context.
- Density is a deliberate choice: pick a compact, default, or comfortable
  density per surface and apply it consistently, do not mix.

See `references/spacing.md` for the scale, the "space owned by parent" rule,
and density guidance.

## Typography

- Use one **type scale** (a fixed set of size + line-height + weight pairings):
  display, h1–h4, body-lg, body, body-sm, caption. Pick the role by meaning,
  not by eyeballing a pixel size.
- Set line length to roughly 60–75 characters for body copy; cap it with the
  layout Container, not per-paragraph.
- Line-height scales inversely with font size: tight for large display,
  generous for body.
- Numbers in tables and data UIs use tabular figures so columns align.

The full scale, pairing table, and usage rules are in
`references/typography.md`. The actual font families come from the brand layer.

## Color

- Color is applied through **semantic roles**, never raw values:
  `surface`, `surface_raised`, `text`, `text_muted`, `border`, `accent`,
  and status roles (`success`, `warning`, `danger`, `info`). The brand layer
  maps these roles to concrete brand tokens.
- Build for both light and dark by referencing roles; a role flips its value
  per theme, components do not branch on theme.
- Use color to *signify*, not to decorate. A second accent color must mean
  something different from the first.

Contrast minimums, the semantic-role table, and theming mechanics are in
`references/color.md`.

## Components

Every reusable component documents its **anatomy** (the named parts), its
**variants** (visual kinds: primary/secondary/ghost), its **sizes** (from the
size scale), and its **states** (default, hover, active, focus-visible,
disabled, loading, error). A component is not done until every state is
specified — a hover with no focus-visible style is incomplete.

- Build behavior on accessible primitives or correct native elements (a real
  `<button>`, a labeled `<input>`); do not reimplement focus, keyboard, and
  ARIA semantics that the platform already gives you.
- Keep components presentational and prop-driven; lift data fetching and
  business logic out of the visual layer.

Component anatomy templates, the variant/size/state matrix, and a buttons +
forms worked example are in `references/components.md`.

## Responsive

- Design **content-out**, mobile-first: start from the smallest viable layout
  and add structure as space allows.
- Breakpoints are named tokens (`sm`, `md`, `lg`, `xl`), not scattered pixel
  literals. Prefer fluid sizing (clamp, min/max, fractional grids) so fewer
  hard breakpoints are needed.
- Touch targets are at least 44×44px; tap and hover affordances must both work.

Breakpoint tokens, the fluid-first approach, and reflow rules are in
`references/responsive.md`.

## Accessibility

Treat WCAG 2.2 AA as the floor:

- **Contrast:** body text ≥ 4.5:1, large text and UI/graphical objects ≥ 3:1.
- **Keyboard:** everything operable by keyboard; visible `focus-visible`
  styling on every interactive element; logical tab order; no keyboard traps.
- **Semantics:** correct landmarks and headings; labels tied to controls;
  state exposed via ARIA only when no native semantic exists.
- **Motion:** honor `prefers-reduced-motion`; never convey meaning by color,
  motion, or sound alone.

The full checklist (run it on every UI change) is in
`references/accessibility.md`.

## Definition of done (UI)

Before considering UI work complete, confirm: values resolve to tokens (no
magic numbers); spacing is owned by the layout; type roles are used by meaning;
color uses semantic roles and passes contrast; every component state is styled
including focus-visible; the layout reflows cleanly from the smallest
breakpoint up; and the accessibility checklist passes.
