# Responsive calculations

> Re-authored for ai-core-kit from alirezarezvani/claude-skills (MIT, © 2025
> Alireza Rezvani). Companion to the `ui-design-system` skill.

Breakpoints, fluid typography, and responsive spacing built from the generated
tokens. Design **content-out and mobile-first**: start from the smallest viable
layout and add structure as space allows.

## Breakpoints

The generator emits six named breakpoints. Reference them as tokens — never
scatter pixel literals through components.

| Token | Width | Typical target |
|---|---|---|
| xs | 480px | large phones |
| sm | 640px | small tablets |
| md | 768px | tablets |
| lg | 1024px | small laptops |
| xl | 1280px | desktops |
| 2xl | 1536px | large screens |

Prefer **container-driven** responsiveness (a component adapts to the space it
is given) over device-width media queries copied into every component.

## Fluid typography with `clamp()`

`clamp(min, preferred, max)` lets type scale smoothly between two viewports
without a media query. The preferred term is `intercept + slope·vw`:

```
slope     = (max_px − min_px) / (max_vw − min_vw)
intercept = min_px − slope · min_vw
preferred = intercept_rem + (slope · 100)vw
```

Worked example — 16px → 24px between 320px and 1200px viewport:

```css
font-size: clamp(1rem, 0.5rem + 2vw, 1.5rem);
```

Pre-computed display scale:

```css
--fluid-h1:   clamp(2rem,    1rem    + 3.6vw, 4rem);
--fluid-h2:   clamp(1.75rem, 1rem    + 2.3vw, 3rem);
--fluid-h3:   clamp(1.5rem,  1rem    + 1.4vw, 2.25rem);
--fluid-body: clamp(1rem,    0.95rem + 0.2vw, 1.125rem);
```

Always cap with `max` so type never grows unbounded on ultrawide displays, and
keep body line length to ~60–75 characters via the layout container.

## Responsive spacing

Section rhythm should grow with the viewport while component padding stays
roughly stable. Map spacing tokens per breakpoint:

| Token | Mobile | Tablet | Desktop |
|---|---|---|---|
| --space-md | 12px | 16px | 16px |
| --space-lg | 16px | 24px | 32px |
| --space-xl | 24px | 32px | 48px |
| --space-section | 48px | 80px | 120px |

## Responsive grid

Drive column count by **container width**, not device width, so a component
reflows correctly wherever it is placed:

```css
.grid {
  display: grid;
  gap: var(--space-lg);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
}
```

## Touch & reflow rules

- Touch targets ≥ 44×44px; tap and hover affordances must both work.
- Content reflows to a single column at the smallest breakpoint with no
  horizontal scroll (WCAG 1.4.10 Reflow: usable at 320px width).
- Honor `prefers-reduced-motion` for any breakpoint-triggered transitions.
