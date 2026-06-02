---
name: error-handling
description: >
  Robust error-handling contract for this project — typed error hierarchies, the
  Result pattern, API error envelopes, error boundaries, retries with backoff,
  and user-facing vs developer-facing messages, with examples in TypeScript,
  Python, and Go. Use when designing error types for a module, adding retry or
  circuit-breaker logic, reviewing endpoints for missing handling, or debugging
  swallowed errors. Trigger on "how should this fail", "add retries", "error
  envelope", or "this catch block swallows the error". Do NOT use for general
  naming/readability conventions (use coding-standards) or for production launch
  triage (use production-audit).
license: MIT
---

# Error Handling

The consistent failure contract for this project. Errors are first-class values
with structure, surfaced at the boundary where they occur, logged with full
context server-side, and shown to users as friendly text — never a stack trace.

## When to activate

- Designing error types or an exception hierarchy for a new module or service.
- Adding retry logic or circuit breakers for an unreliable dependency.
- Reviewing API handlers for missing or inconsistent error handling.
- Implementing user-facing error messages and feedback states.
- Debugging cascading failures or silently swallowed errors.

## Core principles

1. **Fail fast and loud.** Surface at the boundary; never bury an error.
2. **Typed errors over string messages.** Errors carry a `code`, status, and structure.
3. **User message ≠ developer message.** Friendly text to users; full context to logs.
4. **Never swallow silently.** Every `catch` must handle, re-throw, or log.
5. **Errors are part of the API contract.** Document every code a client may receive.

## Typed error hierarchy

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = this.constructor.name
    // Keep `instanceof` working after ES5 transpilation.
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404)
  }
}
export class ValidationError extends AppError {
  constructor(message: string, details: { field: string; message: string }[]) {
    super(message, 'VALIDATION_ERROR', 422, details)
  }
}
export class UnauthorizedError extends AppError {
  constructor(reason = 'Authentication required') { super(reason, 'UNAUTHORIZED', 401) }
}
export class RateLimitError extends AppError {
  constructor(public readonly retryAfterMs: number) { super('Rate limit exceeded', 'RATE_LIMITED', 429) }
}
```

Python and Go follow the same shape — a base error with a `code`, specific
subtypes, and wrapping that never loses the original cause. See
`references/python-go.md`.

## Result pattern (no-throw style)

For operations where failure is expected and routine (parsing, external calls),
return a value instead of throwing:

```ts
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E }

const ok = <T>(value: T): Result<T> => ({ ok: true, value })
const err = <E>(error: E): Result<never, E> => ({ ok: false, error })

async function fetchUser(id: string): Promise<Result<User>> {
  try {
    const user = await db.users.findUnique({ where: { id } })
    return user ? ok(user) : err(new NotFoundError('User', id))
  } catch {
    return err(new AppError('Database error', 'DB_ERROR'))
  }
}

const r = await fetchUser('abc-123')
if (!r.ok) { logger.error('fetch user failed', { error: r.error }); return }
console.log(r.value.email) // narrowed to the success branch
```

## API error envelope

Every error response uses one envelope so clients parse failures uniformly:

```jsonc
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [/* optional */] } }
```

```ts
function handleApiError(error: unknown): Response {
  if (error instanceof AppError) {
    return json(
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.statusCode },
    )
  }
  if (error instanceof z.ZodError) {
    return json(
      { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed',
        details: error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } },
      { status: 422 },
    )
  }
  console.error('Unexpected error:', error) // full context to the log
  return json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } }, { status: 500 })
}
```

A FastAPI global handler and Go handler-level unwrapping live in
`references/python-go.md`.

## Retry with exponential backoff

Retry only **retriable** failures (transient/5xx), never 4xx client errors:

```ts
async function withRetry<T>(fn: () => Promise<T>, opts: {
  maxAttempts?: number; baseDelayMs?: number; maxDelayMs?: number; retryIf?: (e: unknown) => boolean
} = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 500, maxDelayMs = 10_000, retryIf = () => true } = opts
  let last: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn() }
    catch (e) {
      last = e
      if (attempt === maxAttempts || !retryIf(e)) throw e
      const jitter = Math.random() * baseDelayMs
      await new Promise(r => setTimeout(r, Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, maxDelayMs)))
    }
  }
  throw last
}

await withRetry(() => fetch('/api/data').then(r => r.json()), {
  retryIf: e => !(e instanceof AppError && e.statusCode < 500),
})
```

## React error boundary

```tsx
export class ErrorBoundary extends Component<
  { fallback: ReactNode; onError?: (e: Error, i: ErrorInfo) => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info)
    console.error('Unhandled React error:', error, info)
  }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}
```

## User-facing messages

Map codes to friendly copy; keep technical detail out of user-visible text.

```ts
const USER_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'The requested item could not be found.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: "You don't have permission to do that.",
  VALIDATION_ERROR: 'Please check your input and try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again later.',
}
const getUserMessage = (code: string) => USER_MESSAGES[code] ?? USER_MESSAGES.INTERNAL_ERROR
```

## Checklist

Before merging code that touches error handling:

- [ ] Every `catch` handles, re-throws, or logs — no silent swallowing.
- [ ] API errors use the standard `{ error: { code, message } }` envelope.
- [ ] User-facing text carries no stack traces or internal details.
- [ ] Full error context is logged server-side.
- [ ] Custom errors extend a base `AppError` with a `code`.
- [ ] Async functions surface errors to callers — no fire-and-forget without fallback.
- [ ] Retry logic only retries retriable errors (not 4xx).
- [ ] Rendering errors are caught by an `ErrorBoundary`.

## Related skills

- `coding-standards` — the baseline conventions this contract assumes.
- `production-audit` — launch-time check that these handlers exist and reconcile.
