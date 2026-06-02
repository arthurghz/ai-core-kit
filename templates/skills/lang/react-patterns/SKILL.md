---
name: react-patterns
description: React 18/19 patterns for this project — hooks discipline, server/client component boundaries, Suspense + error boundaries, form actions, data-fetching choices, state-location decisions, and accessible composition. Use when writing or reviewing React components in a fullstack repo (project.framework in next or remix with a React UI; sveltekit/nuxt use their own packs). TRIGGER when editing .tsx/.jsx components or custom hooks. SKIP for pure backend code or non-React UI frameworks.
license: MIT
---

# React Patterns

Idiomatic React 18/19 for robust, accessible, performant component trees.
Active for fullstack archetypes whose UI is React (e.g. `project.framework:
next` or `remix`).

## When to use

- Writing/modifying React function components, custom hooks, or component trees.
- Reviewing `.tsx`/`.jsx`.
- Choosing state location, data-fetching strategy, or composition shape.

## When NOT to use

- Backend/API code → the matching backend pack.
- Non-React UI (Svelte, Vue/Nuxt templates) → that framework's pack.

## Core principles

- **Render is a pure function of props + state.** Derive during render; don't
  mirror props into state via `useEffect`.
- **Side effects live outside render** — event handlers or `useEffect`, never
  the render body.
- **Compose, don't inherit.** `children`, render props, component props.

```tsx
// Good: derive during render
function Cart({ items }: { items: CartItem[] }) {
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  return <span>{formatMoney(total)}</span>;
}
```

## Hooks discipline

- Call hooks at the top level, unconditionally.
- Clean up every subscription / interval / listener in the effect's return.
- Use a functional updater when next state depends on previous:
  `setN(n => n + 1)`.
- Don't pre-emptively memoize. Add `useMemo`/`useCallback` only when a profiler
  or a dependency chain proves it matters.
- Extract a custom hook only when the same hook sequence repeats in 2+ places.

## State location decision tree

```
one component?              -> useState in it
parent + a few children?    -> lift to common ancestor
distant branches, low-freq? -> Context (theme, auth, locale)
high-freq shared updates?   -> external store (Zustand, Jotai, Redux Toolkit)
derived from server?        -> server-state lib (TanStack Query / SWR / RSC)
```

Most pages need neither context nor a global store. Resist abstraction until
duplicated lifting hurts.

## Server / client components (RSC)

```tsx
// Server Component (default): async, ships no JS for itself
export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  if (!product) notFound();
  return <ProductView product={product} />;
}

// Client Component: opt in
"use client";
export function AddToCart({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button disabled={pending} onClick={() => start(() => addToCart(id))}>
    {pending ? "Adding…" : "Add to cart"}
  </button>;
}
```

- Server → Client: pass serializable props or `children`.
- Client → Server: invoke Server Actions via `<form action={…}>` or from a
  handler.
- Never `import` a Server Component into a Client Component file — compose via
  `children`.

## Suspense + error boundaries

```tsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<Skeleton />}>
    <UserDetail id={id} />
  </Suspense>
</ErrorBoundary>
```

Place Suspense close to the data, not at the route root. Error boundaries catch
errors during render/lifecycle — NOT in event handlers or async callbacks.

## Forms (React 19 actions, preferred)

```tsx
"use client";
import { useActionState } from "react";

export function UserForm() {
  const [state, action, pending] = useActionState(updateUser, { error: null });
  return (
    <form action={action}>
      <input name="name" required />
      <button type="submit" disabled={pending}>Save</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

Controlled inputs when the value drives other UI or live validation. For
multi-step / dynamic / cross-field forms, use a library (React Hook Form,
TanStack Form) — hand-rolled state past trivial complexity is a trap.

## Data fetching

| Need | Tool |
|---|---|
| Per-request data (Next App Router) | RSC `await fetch()` |
| Client cache + mutations + invalidation | TanStack Query |
| Lightweight client cache | SWR |
| One-off in a handler | `fetch()` |

Avoid `useEffect` + `fetch` for app data — races, no cache, no retry, no
Suspense integration.

## Performance

- `React.memo` only when a component re-renders often, usually with equal props,
  and is measurably expensive — otherwise the equality check is pure overhead.
- Split context by concern so a theme change doesn't re-render auth consumers.
- Stable `key` props (entity id, never array index).
- Virtualize lists past ~50 non-trivial rows (`@tanstack/react-virtual`).

## Accessibility-first

- Semantic HTML (`<button>`, `<a>`, `<nav>`, `<main>`) before `role`.
- Every interactive element keyboard-reachable; manage focus on
  route/modal transitions.
- Label every input (`<label htmlFor>` or `aria-label`).

## Anti-patterns

- Mirroring props into state with `useEffect`.
- Conditional hook calls.
- Importing a Server Component into a Client Component file.
- Catch-all global store for state used by one subtree.
- Array index as `key` for reorderable lists.

---

*Re-authored for ai-core-kit from the ECC `react-patterns` skill
(Copyright (c) 2026 Affaan Mustafa, MIT). Adapted to kit conventions; relicensed
notice retained under MIT.*
