---
name: go-patterns
description: Idiomatic Go conventions for this project — error wrapping, the zero-value rule, accept-interfaces-return-structs, context propagation, concurrency, and package layout. Use when writing or reviewing Go in a repo whose manifest sets project.language == go. TRIGGER when editing .go files, designing packages, or reviewing a Go diff. SKIP for HTTP router wiring (use gin-patterns) or data access (use gorm-patterns).
license: MIT
---

# Go Patterns

Idiomatic Go for robust, predictable services. Active when this project's
manifest declares `project.language: go`. Go should be boring in the best way:
clear over clever.

## When to use

- Writing or modifying `.go` files (non-test).
- Designing package boundaries and public APIs.
- Reviewing a Go diff for idiom, error handling, and concurrency safety.

## When NOT to use

- HTTP routing / middleware → `gin-patterns`.
- DB models / queries → `gorm-patterns`.
- `*_test.go` test strategy → a Go testing pack (not bundled by default; follow
  `go test` conventions below).

## Core principles

- **Errors are values.** Return them, wrap them, check them — never panic for
  ordinary failures.
- **Make the zero value useful.** Design types so `var x T` is ready to use.
- **Accept interfaces, return structs.** Functions take the narrowest interface
  they need and return concrete types.
- **Clear is better than clever.** Return early; keep the happy path
  un-indented.

## Error handling

```go
func LoadConfig(path string) (*Config, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, fmt.Errorf("load config %s: %w", path, err) // wrap with %w
    }
    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config %s: %w", path, err)
    }
    return &cfg, nil
}
```

- Wrap with `%w` to preserve the chain; add context at each layer.
- Inspect with `errors.Is` (sentinel) and `errors.As` (typed):

```go
if errors.Is(err, sql.ErrNoRows) { /* not found */ }

var verr *ValidationError
if errors.As(err, &verr) { /* field = verr.Field */ }
```

- Sentinels: `var ErrNotFound = errors.New("not found")`.
- Never discard an error with `_` unless it is genuinely best-effort cleanup —
  and comment why.

## Interfaces

```go
// Define the interface in the CONSUMER, list only what you use.
package service

type UserStore interface {
    GetUser(ctx context.Context, id string) (*User, error)
}

type Service struct{ store UserStore }
```

- Keep interfaces small (often one method). Compose with embedding.
- Don't return interfaces "to be flexible" — return the concrete struct.

## Context

```go
func Fetch(ctx context.Context, url string) ([]byte, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, fmt.Errorf("fetch %s: %w", url, err)
    }
    defer resp.Body.Close()
    return io.ReadAll(resp.Body)
}
```

- `context.Context` is always the first parameter; never store it in a struct.
- Propagate the caller's `ctx`; derive timeouts/cancellation from it.

## Concurrency

```go
// Coordinate goroutines with errgroup; cancel siblings on first error.
g, ctx := errgroup.WithContext(ctx)
results := make([][]byte, len(urls))
for i, url := range urls {
    i, url := i, url            // capture (pre-Go-1.22)
    g.Go(func() error {
        b, err := Fetch(ctx, url)
        results[i] = b
        return err
    })
}
if err := g.Wait(); err != nil {
    return nil, err
}
```

- Don't communicate by sharing memory; share by communicating (channels) — but a
  `sync.Mutex` around small critical sections is fine and often simpler.
- Every goroutine needs a clear exit path; use buffered channels or `select` on
  `ctx.Done()` to avoid leaks.
- Run `go test -race ./...` in CI.

## Package layout

```text
cmd/<app>/main.go     # entry point, wiring only
internal/             # private to this module
  handler/  service/  repository/  config/
pkg/                  # genuinely reusable public API (use sparingly)
```

- Package names: short, lowercase, no underscores, no `util`/`common` dumping
  grounds.
- Inject dependencies via constructors (`NewServer(db)`), not `init()` globals.
- Functional options for optional config:

```go
type Option func(*Server)
func WithTimeout(d time.Duration) Option { return func(s *Server) { s.timeout = d } }
func NewServer(addr string, opts ...Option) *Server { /* apply opts */ }
```

## Tooling baseline

```bash
go build ./...
go vet ./...
go test -race -cover ./...
gofmt -w . && goimports -w .
golangci-lint run        # errcheck, staticcheck, ineffassign, unused, ...
```

## Anti-patterns

- `panic` for ordinary errors (reserve for truly unrecoverable invariants).
- Naked returns in long functions.
- Mixing value and pointer receivers on one type.
- Storing `context.Context` in a struct field.
- Ignoring errors with `_` without a comment.

---

*Re-authored for ai-core-kit from the ECC `golang-patterns` skill
(Copyright (c) 2026 Affaan Mustafa, MIT). Adapted to kit conventions; relicensed
notice retained under MIT.*
