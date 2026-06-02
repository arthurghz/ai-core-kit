---
name: rust-patterns
description: Idiomatic Rust conventions for this project — ownership and borrowing, Result/? error propagation (thiserror for libs, anyhow for apps), enums to make illegal states unrepresentable, traits, and safe concurrency. Use when writing or reviewing Rust in a repo whose manifest sets project.language == rust. TRIGGER when editing .rs files, designing crates, or reviewing a Rust diff. SKIP for web routing wiring (use axum-patterns).
license: MIT
---

# Rust Patterns

Idiomatic Rust for safe, performant, maintainable code. Active when this
project's manifest declares `project.language: rust`.

## When to use

- Writing or modifying `.rs` source (non-test).
- Designing crate/module layout and public surfaces.
- Reviewing a Rust diff for ownership, error handling, and API quality.

## When NOT to use

- HTTP routing / extractors / middleware → `axum-patterns`.

## Core principles

- **Borrow before you clone.** Take `&T`/`&mut T`; take ownership only to store
  or consume. Don't `.clone()` to dodge the borrow checker.
- **Make illegal states unrepresentable.** Model with enums + exhaustive
  `match`; a value that cannot be constructed cannot be a bug.
- **Errors are typed values.** Return `Result`, propagate with `?`. No `unwrap`
  / `expect` on fallible paths in production.
- **Zero-cost abstraction.** Traits + generics over dynamic dispatch unless you
  need a trait object.

## Ownership & borrowing

```rust
fn process(data: &[u8]) -> usize { data.len() }     // borrow: read-only
fn store(data: Vec<u8>) -> Record { Record { payload: data } } // own: to keep
```

Use `Cow<'_, str>` to borrow when possible and own only when you must mutate:

```rust
use std::borrow::Cow;
fn normalize(input: &str) -> Cow<'_, str> {
    if input.contains(' ') { Cow::Owned(input.replace(' ', "_")) }
    else { Cow::Borrowed(input) }
}
```

## Error handling

Libraries — structured, typed errors with `thiserror`:

```rust
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("record not found: {id}")]
    NotFound { id: String },
    #[error("connection failed")]
    Connection(#[from] std::io::Error),   // auto From for `?`
}
```

Applications — flexible context with `anyhow`:

```rust
use anyhow::{bail, Context, Result};

fn load_config(path: &str) -> Result<Config> {
    let raw = std::fs::read_to_string(path)
        .with_context(|| format!("read config {path}"))?;
    let cfg: Config = toml::from_str(&raw)
        .with_context(|| format!("parse config {path}"))?;
    if cfg.workers == 0 { bail!("workers must be > 0"); }
    Ok(cfg)
}
```

Prefer `Option`/`Result` combinators (`map`, `and_then`, `ok_or`,
`unwrap_or_default`) over nested `match` where they read more clearly.

## Types, traits, enums

```rust
// State machine via enum — no invalid combination is constructible.
enum Connection {
    Disconnected,
    Connecting { since: Instant },
    Connected { session: SessionId },
}

// Trait for an abstraction the caller provides.
trait Store {
    fn get(&self, id: &str) -> Result<Record, StorageError>;
}

// Generics with bounds = static dispatch (zero cost); &dyn Store when you need
// heterogeneous impls behind one type.
fn first_record<S: Store>(store: &S, ids: &[String]) -> Option<Record> {
    ids.iter().find_map(|id| store.get(id).ok())
}
```

- Derive `Debug`, and `Clone`/`PartialEq`/`Eq`/`Hash` as appropriate.
- Implement `From` for ergonomic conversions; `?` uses it for free.
- Newtype wrappers (`struct UserId(u64)`) prevent mixing up like-typed values.

## Concurrency

- Shared mutable state: `Arc<Mutex<T>>` (or `RwLock` for read-heavy); keep lock
  scopes minimal and never `.await` while holding a std `Mutex`.
- Message passing: `std::sync::mpsc` / `tokio::sync::mpsc` channels.
- Async: `tokio` runtime; `async fn` + `.await`; `tokio::spawn` for concurrent
  tasks; `tokio::select!` for cancellation/timeouts.
- The compiler enforces `Send`/`Sync` — trust the errors, don't `unsafe` past
  them.

## Crate layout

```text
src/
  lib.rs            # public API re-exports; `pub use` the surface
  main.rs           # binary entry (wiring only)
  error.rs          # thiserror enums
  domain/  service/ infra/
```

Keep `pub` minimal — default to private, expose deliberately. One module per
domain concern.

## Tooling baseline

```bash
cargo build
cargo test
cargo clippy -- -D warnings   # lint as errors in CI
cargo fmt --check
```

## Anti-patterns

- `unwrap()` / `expect()` / `panic!` on recoverable errors.
- `.clone()` sprinkled to silence the borrow checker.
- `unsafe` without a documented invariant and a safe wrapper.
- Stringly-typed APIs where a newtype or enum models the domain.
- Over-using `Rc<RefCell<T>>` to emulate shared mutability in single-threaded
  code — usually a design smell.

---

*Re-authored for ai-core-kit from the ECC `rust-patterns` skill
(Copyright (c) 2026 Affaan Mustafa, MIT). Adapted to kit conventions; relicensed
notice retained under MIT.*
