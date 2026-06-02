# Accessibility

Treat WCAG 2.2 AA as the floor, decided while building — not a finishing pass.
Run this checklist on every UI change.

## Contrast

- Body text ≥ 4.5:1; large text (≥24px, or ≥19px bold) ≥ 3:1.
- UI components, borders, icons, and the focus ring ≥ 3:1 against neighbors.
- Verify in both light and dark themes; `text_muted` is the usual offender
  (see `color.md`).

## Keyboard

- Every interactive element is operable by keyboard (Tab/Shift+Tab, Enter/Space,
  arrow keys for composite widgets).
- A visible `focus-visible` style on every interactive element — never
  `outline: none` without an equal-or-better replacement.
- Logical, source-order tab sequence; no positive `tabindex`.
- No keyboard traps: focus can always move out of any component.
- Provide a "skip to main content" link on full pages.

## Semantics & structure

- Use native elements for native behavior (`<button>`, `<a>`, `<input>`,
  `<nav>`, `<main>`). Add ARIA only when no native semantic exists, and never
  contradict the native role.
- One `<h1>` per page; do not skip heading levels for visual sizing (use the
  type role instead — see `typography.md`).
- Landmarks present: `header`, `nav`, `main`, `footer` as applicable.
- Every form control has a programmatically associated `<label>`; errors and
  hints are tied via `aria-describedby`; invalid fields set `aria-invalid`.

## Images & icons

- Meaningful images have descriptive `alt`; decorative images use empty `alt=""`.
- Icon-only controls carry an accessible name (`aria-label`).

## Motion & timing

- Honor `prefers-reduced-motion`: replace large/parallax/auto-playing motion
  with a reduced or static alternative.
- No essential auto-advancing or time-limited interaction without a way to
  pause, stop, or extend it.

## Don't rely on a single channel

Never convey meaning by color, shape, position, motion, or sound alone — always
pair it with text or an icon (the color-only rule from `color.md`).

## Live regions & feedback

- Asynchronous status (toasts, save confirmations, validation summaries) is
  announced via an appropriate `aria-live` region.
- Loading states expose `aria-busy`; the user is never left guessing.

## Definition of done (a11y)

Contrast passes both themes · full keyboard operability with visible focus ·
correct landmarks and heading order · labeled controls with associated
errors/hints · reduced-motion respected · no color-only meaning · async status
announced. If any line fails, the UI change is not done.
