---
name: typescript-patterns
description: Idiomatic TypeScript conventions for this project — strict compiler settings, type narrowing, discriminated unions, generics, runtime validation at boundaries, and module structure. Use when writing or reviewing TypeScript in a repo whose manifest sets project.language == typescript. TRIGGER when editing .ts/.tsx (non-React-component) files, designing types, or reviewing a TS diff. SKIP for React component composition (use react-patterns) or HTTP wiring (use node-api-patterns).
license: MIT
---

# TypeScript Patterns

Idiomatic, strict TypeScript for safe, maintainable code. Active when this
project's manifest declares `project.language: typescript`.

## When to use

- Writing or modifying `.ts`/`.tsx` (types, services, utilities).
- Designing the type model for a module or API.
- Reviewing a TypeScript diff for soundness and idiom.

## When NOT to use

- React component/hook composition → `react-patterns`.
- Express/NestJS server wiring → `node-api-patterns`.

## Compiler is the first line of defense

Enable strictness and treat type errors as build failures:

```jsonc
// tsconfig.json compilerOptions
{
  "strict": true,                          // implies strictNullChecks, etc.
  "noUncheckedIndexedAccess": true,        // arr[i] is T | undefined
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "verbatimModuleSyntax": true
}
```

Run `tsc --noEmit` in CI. `any` is opt-out from type safety; prefer `unknown`
and narrow.

## Model the domain with types

```ts
// Discriminated union — exhaustive, illegal states unrepresentable.
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function unwrap<T>(r: Result<T>): T {
  if (r.ok) return r.value;
  throw new Error(r.error);
}

// Exhaustiveness: the never-assignment fails to compile if a case is missed.
function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.r ** 2;
    case "rect":   return s.w * s.h;
    default: { const _exhaustive: never = s; return _exhaustive; }
  }
}
```

- Prefer `type` aliases for unions/intersections; `interface` for extendable
  object contracts.
- Use literal/template-literal types and `as const` to capture exact values.
- `readonly` arrays/props by default; mutate intentionally.

## Narrowing over assertion

```ts
function len(x: unknown): number {
  if (typeof x === "string") return x.length;          // narrowed
  if (Array.isArray(x)) return x.length;
  throw new TypeError("expected string or array");
}

// User-defined type guard
function isUser(v: unknown): v is User {
  return typeof v === "object" && v !== null && "id" in v;
}
```

Avoid `as` casts and `!` non-null assertions — they silence the compiler
without proving anything. Use guards, narrowing, and validation instead.

## Validate at the boundary

External data (request bodies, env, JSON, third-party APIs) is `unknown` until
proven. Parse-then-use with a schema validator:

```ts
import { z } from "zod";

const Env = z.object({ PORT: z.coerce.number(), DATABASE_URL: z.string().url() });
export const env = Env.parse(process.env);   // throws loudly on bad config
```

The inferred type (`z.infer<typeof Env>`) is the single source of truth — no
hand-maintained duplicate interface.

## Generics

```ts
// Constrain to what you actually use.
function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] {
  return items.map((i) => i[key]);
}
```

Add generics only when a real relationship between inputs/outputs needs to be
preserved — not for decoration.

## Async

- `async`/`await` over raw `.then()` chains.
- Type rejections: functions return `Promise<T>`; model expected failures as a
  `Result`/union rather than throwing across module boundaries when callers must
  handle them.
- `Promise.all` for independent work; `Promise.allSettled` when partial failure
  is acceptable. Never leave a promise unawaited (enable
  `@typescript-eslint/no-floating-promises`).

## Module structure

- One concern per module; export a deliberate public surface from an `index.ts`.
- `import type { … }` for type-only imports (with `verbatimModuleSyntax`).
- No default exports for libraries — named exports refactor and tree-shake
  better.

## Tooling baseline

```bash
tsc --noEmit                 # type gate
eslint . --max-warnings 0    # with @typescript-eslint
prettier --check .
```

## Anti-patterns

- `any` (use `unknown` + narrowing); blanket `// @ts-ignore`.
- `as` casts to force a shape instead of validating it.
- `!` non-null assertions to dodge `strictNullChecks`.
- `enum` where a union of string literals (`type X = "a" | "b"`) is simpler and
  erasable.
- Floating (unawaited) promises.

---

*Authored for ai-core-kit (no ECC source skill for TypeScript). Licensed MIT.*
