---
name: frontend-a11y
description: >
  Accessibility patterns for React/Next.js UIs — semantic HTML, correct ARIA,
  form labeling and error association, keyboard navigation, focus management,
  reduced-motion, and screen-reader support — targeting the issues most often
  flagged in review (missing labels, wrong ARIA, non-semantic click handlers,
  broken keyboard paths). Use when building or reviewing any interactive
  component or form, adding `aria-*`, or acting on a11y feedback from a linter or
  review tool. Trigger on "make this accessible", "a11y review", "add aria
  labels", or "screen-reader support". Do NOT use for general React state/render
  patterns (use react-patterns) or non-UI work.
license: MIT
---

# Frontend Accessibility

Practical accessibility patterns for React and Next.js, focused on the defects
most commonly flagged in code review: missing form labels, incorrect ARIA usage,
non-semantic interactive elements, and broken keyboard navigation.

## When to activate

- Building or reviewing form components (`<input>`, `<select>`, `<textarea>`).
- Creating interactive elements (modals, dropdowns, tooltips, tabs, accordions).
- Using `<div>` or `<span>` with `onClick`.
- Adding any `aria-*` attribute.
- Implementing keyboard navigation or focus management.
- Acting on a11y feedback from a review tool or ESLint a11y rules.
- Building components that must support screen readers.

## When NOT to use

- General React component, state, or rendering patterns → `react-patterns`.
- Non-UI work, backend, or build tooling.

## Form accessibility

Disconnected labels and error messages are the most common review findings.

```tsx
// BAD — no association; screen readers can't pair them
<label>Email</label>
<input type="email" />

// GOOD — htmlFor matches input id
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

Required fields — convey "required" to assistive tech, not just visually:

```tsx
<label htmlFor="email">Email <span aria-hidden="true">*</span></label>
<input id="email" type="email" required aria-required="true" />
```

Error messages — link the message and signal the invalid state:

```tsx
<input
  id="email"
  type="email"
  aria-describedby={error ? 'email-error' : undefined}
  aria-invalid={!!error}
/>
{error && <span id="email-error" role="alert">{error}</span>}
```

A complete accessible form (labels, `aria-describedby`, `role="alert"`,
`autoComplete`, `noValidate`) is in `references/components.md`.

## Semantic HTML

Use the element that matches the intent; native semantics give you focus,
keyboard activation, and an accessible role for free.

```tsx
// BAD — no role, no keyboard support, no accessible name
<div onClick={handleClick}>Submit</div>
// GOOD
<button type="button" onClick={handleClick}>Submit</button>

// BAD — non-semantic navigation
<div onClick={() => navigate('/home')}>Home</div>
// GOOD — supports right/middle-click and keyboard
<a href="/home">Home</a>

// BAD — skipped heading level (h1 → h4)
// GOOD — sequential levels (h1 → h2)
```

## ARIA attributes

Use ARIA only when native HTML is insufficient. **Wrong ARIA is worse than no ARIA.**

```tsx
// aria-label: inline string label when there is no visible text
<button aria-label="Close modal"><XIcon /></button>

// aria-labelledby: reference visible text
<section aria-labelledby="section-title">
  <h2 id="section-title">Recent Orders</h2>
</section>

// aria-describedby: supplementary description beyond the label
<button aria-describedby="delete-warning" onClick={handleDelete}>Delete account</button>
<p id="delete-warning">This action cannot be undone.</p>

// aria-live: announce updates without a reload (polite = wait; assertive = interrupt, urgent only)
<div role="status" aria-live="polite" aria-atomic="true">{message}</div>

// aria-expanded / aria-controls: disclosure widgets
<button aria-expanded={isOpen} aria-controls={contentId} onClick={toggle}>{title}</button>
<div id={contentId} hidden={!isOpen}>{children}</div>
```

## Keyboard navigation

Every interactive element must be reachable and operable by keyboard alone. A
custom widget that handles `onClick` must also handle the equivalent keys
(`Enter`/`Space` to activate, arrows to move, `Escape` to dismiss) and expose
`tabIndex` plus the right role. A full keyboard-driven combobox/dropdown example
is in `references/components.md`.

## Focus management

Focus must move logically when UI state changes — especially modals and route
transitions. Save the previously-focused element, move focus into the new
surface on open, and restore it on close:

```tsx
useEffect(() => {
  if (isOpen) {
    previousFocusRef.current = document.activeElement as HTMLElement
    modalRef.current?.focus()
  } else {
    previousFocusRef.current?.focus()
  }
}, [isOpen])
```

For a full focus trap (Tab/Shift+Tab cycling, nested portals, dynamic content),
use a maintained library such as `focus-trap-react` rather than rolling your own.

## Images and icons

```tsx
<img src="/decoration.png" alt="" aria-hidden="true" />               {/* decorative */}
<img src="/chart.png" alt="Revenue rose 23% from Jan to Mar" />        {/* meaningful */}
<button aria-label="Delete item"><TrashIcon aria-hidden="true" /></button>
```

## Reduced motion

Respect `prefers-reduced-motion`; gate animations behind it.

```tsx
const reduceMotion = useReducedMotion() // matchMedia('(prefers-reduced-motion: reduce)')
<div style={{ transition: reduceMotion ? 'none' : 'transform 300ms ease' }} />
```

## Anti-patterns

```tsx
<div onClick={handleClick}>Click me</div>            // no role/tabIndex/onKeyDown
<div aria-label="Navigation">…</div>                  // aria-label on a roleless div
<input placeholder="Enter your email" />              // placeholder is not a label
<button tabIndex={3}>Submit</button>                  // positive tabIndex breaks order
<button aria-hidden="true">Open</button>              // hides a focusable element → trap
<div role="button" onClick={handleClick}>Submit</div> // missing tabIndex + onKeyDown
```

## Checklist

Before submitting an interactive component for review:

- [ ] Every `<input>`/`<select>`/`<textarea>` has a connected `<label>` via `htmlFor`/`id`.
- [ ] Error messages are linked with `aria-describedby` and marked `role="alert"`.
- [ ] No `onClick` on `<div>`/`<span>` without `role`, `tabIndex`, and `onKeyDown`.
- [ ] Icon-only buttons have `aria-label`.
- [ ] Decorative images use `alt=""` and `aria-hidden="true"`.
- [ ] Modals restore focus on close (use `focus-trap-react` for full trapping).
- [ ] Dynamic content updates use `aria-live`.
- [ ] `prefers-reduced-motion` is respected for animations.

## Related skills

- `coding-standards` — the baseline conventions UI code is also held to.
- `production-audit` — the launch check that includes the UX/a11y lens.
- React language packs under `skills/lang/` — general component and state patterns.
