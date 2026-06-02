---
name: node-api-patterns
description: Node.js backend API patterns for this project covering both Express and NestJS — layered structure, validated DTOs, centralized error handling, async-safe handlers, config/secrets, and graceful shutdown. Use when writing or reviewing a Node backend whose manifest sets project.framework == express or project.framework == nestjs. TRIGGER when editing controllers/routes/services or wiring middleware. SKIP for Python/Go/Rust backends or React UI (use react-patterns).
license: MIT
---

# Node API Patterns (Express & NestJS)

Production patterns for Node.js HTTP backends. Active when this project's
manifest declares `project.framework: express` or `project.framework: nestjs`.
Most principles apply to both; framework-specific snippets are labelled.

## When to use

- Writing/modifying controllers, routes, services, middleware, DTOs.
- Reviewing a Node backend diff for structure, validation, and error safety.

## When NOT to use

- Non-Node backends → the matching language/framework pack.
- React component code → `react-patterns`. ORM models → `prisma-patterns` /
  `drizzle-patterns`.

## Layered structure (both)

Keep HTTP concerns thin and push logic down:

```text
route/controller   -> parse + validate input, call service, shape response
service             -> business logic, transactions, orchestration (no req/res)
repository/data     -> persistence (ORM/queries only)
```

Controllers never contain business logic; services never touch `req`/`res`.

```text
src/
  modules/<feature>/   controller  service  dto/  (NestJS adds .module.ts)
  common/              middleware  filters  guards  errors
  config/              env schema + typed config
  main.ts | server.ts  bootstrap/wiring only
```

## Validate every input at the edge

Untrusted input is `unknown` until validated. Reject unknown fields.

**NestJS** — global `ValidationPipe` + class DTOs:

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,            // strip unknown props
  forbidNonWhitelisted: true, // 400 on unknown props
  transform: true,
}));

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
}
```

**Express** — validate with a schema (zod/joi) in a middleware:

```ts
const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
const validate = (s: ZodSchema) => (req, _res, next) => {
  const r = s.safeParse(req.body);
  if (!r.success) return next(new HttpError(400, "validation failed", r.error.issues));
  req.body = r.data;            // narrowed, trusted
  next();
};
router.post("/users", validate(schema), createUser);
```

## Centralized error handling

One place converts thrown errors into responses. Never `res.send` an error from
deep in a service.

```ts
// Shared typed error
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}
```

**Express** — error-handling middleware LAST (4 args), and wrap async handlers
so rejections reach it:

```ts
const asyncH = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);  // or use express 5 / express-async-errors

app.use((err, _req, res, _next) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status >= 500) logger.error(err);             // log server faults, not 4xx noise
  res.status(status).json({ error: err.message, details: err.details });
});
```

**NestJS** — a global exception filter; throw `HttpException` subclasses from
services:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter { /* map -> JSON */ }
app.useGlobalFilters(new AllExceptionsFilter());
```

In both: never leak stack traces or internal messages to clients on 5xx.

## Async safety

- Every async handler's rejection must reach the error layer (Express 4 needs a
  wrapper; Express 5 / NestJS handle it). An unhandled rejection that escapes is
  a hung request or a crash.
- Add `process.on("unhandledRejection")` / `"uncaughtException")` handlers that
  log and exit — a process in an unknown state should restart, not limp on.

## Config & secrets

- Load and **validate** config once at boot; fail fast on missing/invalid env.
- Never read `process.env` scattered through the codebase — read a typed config
  object.

```ts
const Env = z.object({ PORT: z.coerce.number().default(3000), DATABASE_URL: z.string().url() });
export const env = Env.parse(process.env);
```

NestJS: `ConfigModule.forRoot({ validationSchema })`. Secrets come from the
environment / a secrets manager, never committed.

## Middleware & cross-cutting

- Security headers (`helmet`), CORS allow-list (never `*` with credentials),
  body-size limits, and rate limiting on public endpoints.
- Structured request logging with a correlation/request id; redact secrets.
- Authn/authz as middleware (Express) or guards (NestJS) — not inline checks
  duplicated per route.

## Graceful shutdown

```ts
const server = app.listen(env.PORT);
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    server.close(() => { /* drain DB pool, queues */ process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref(); // hard cap
  });
}
```

NestJS: `app.enableShutdownHooks()` + `OnModuleDestroy`.

## Anti-patterns

- Business logic in controllers / route handlers.
- Per-route ad-hoc validation instead of a single validation layer with
  unknown-field rejection.
- Swallowing async errors (missing wrapper, empty `.catch()`).
- `res.json(err)` of raw errors → leaks internals.
- `process.env` reads sprinkled through modules instead of one validated config.
- `cors({ origin: "*" , credentials: true })`.

---

*Authored for ai-core-kit (synthesized for the Express + NestJS Node backend
enum; informed by the ECC `nestjs-patterns` skill, Copyright (c) 2026 Affaan
Mustafa, MIT). Licensed MIT.*
