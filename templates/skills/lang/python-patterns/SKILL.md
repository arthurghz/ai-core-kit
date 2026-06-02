---
name: python-patterns
description: Idiomatic Python conventions for this project — PEP 8 layout, type hints, dataclasses, comprehensions, context managers, exceptions, and packaging. Use when writing or reviewing Python in a repo whose manifest sets project.language == python. TRIGGER when editing .py modules, designing package layout, or reviewing a Python diff. SKIP for Python test files (use python-testing) or framework-specific routing/ORM code (use fastapi-patterns / sqlalchemy-patterns).
license: MIT
---

# Python Patterns

Idiomatic Python for building robust, readable, maintainable code. Active when
this project's manifest declares `project.language: python`.

## When to use

- Writing or modifying `.py` modules (non-test).
- Designing a package/module layout or public API surface.
- Reviewing a Python diff for idiom, typing, and error-handling quality.

## When NOT to use

- Test files / fixtures → `python-testing`.
- Framework routing, DI, request/response models → `fastapi-patterns`.
- Data-access / ORM models → `sqlalchemy-patterns`.

## Core principles

- **Readability counts.** Prefer the obvious solution. Explicit beats clever.
- **Type everything public.** Annotate every function signature and module-level
  constant. Run `mypy --strict` (or `pyright`) in CI; treat type errors as build
  failures, not warnings.
- **Fail loud, fail early.** Raise specific exceptions; never `except: pass`.
- **Immutability by default.** Reach for `tuple`, frozen dataclasses, and pure
  functions before mutable shared state.

## Type hints

```python
from collections.abc import Iterable, Mapping
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class User:
    id: int
    name: str
    roles: tuple[str, ...] = ()

def index_by_id(users: Iterable[User]) -> Mapping[int, User]:
    return {u.id: u for u in users}
```

- Use built-in generics (`list[int]`, `dict[str, int]`) on Python 3.9+; import
  `Iterable`/`Mapping`/`Sequence` from `collections.abc`, not `typing`.
- Annotate optionals as `X | None`, not `Optional[X]`, on 3.10+.
- Use `typing.Protocol` for structural interfaces ("accept anything with a
  `.read()`") instead of inheritance.
- Reserve `Any` for genuine dynamic boundaries (deserialized JSON) and narrow it
  immediately with validation.

## Dataclasses & models

- `@dataclass(frozen=True, slots=True)` for value objects — hashable, immutable,
  memory-lean.
- Validate at construction in `__post_init__`; do not let an invalid instance
  exist.
- For external data (config, request bodies), prefer a validation library
  (pydantic, attrs) that parses-then-validates rather than hand-rolled `assert`.

## Idioms over boilerplate

```python
# Comprehension over manual append-loop
squares = [x * x for x in nums if x > 0]

# Dict/set comprehensions and generator expressions for laziness
total = sum(line_total(item) for item in cart)

# enumerate / zip instead of index arithmetic
for i, row in enumerate(rows):
    ...
for name, score in zip(names, scores, strict=True):
    ...

# Unpacking and star-targets
first, *rest = values

# pathlib over os.path string-munging
from pathlib import Path
config = (Path(__file__).parent / "config.toml").read_text()
```

## Context managers

```python
# Acquire/release resources with `with`, never manual try/finally for files.
with open(path, encoding="utf-8") as fh:
    data = fh.read()

# Compose multiple resources on one line (3.10+ parenthesized form):
with (open(src) as fin, open(dst, "w") as fout):
    fout.write(fin.read())

# Custom managers via contextlib:
from contextlib import contextmanager

@contextmanager
def timed(label: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        log.info("%s took %.3fs", label, time.perf_counter() - start)
```

## Error handling

```python
# Catch the narrowest exception you can act on.
try:
    payload = json.loads(raw)
except json.JSONDecodeError as exc:
    raise ConfigError(f"invalid config at {path}") from exc  # chain context

# Define domain exceptions; do not raise bare Exception.
class AppError(Exception): ...
class NotFoundError(AppError): ...
```

- Never swallow exceptions silently. If an error is truly ignorable, log it and
  comment why.
- Use `raise ... from exc` to preserve the cause chain.
- Reserve `finally`/`with` for cleanup; do not use exceptions for control flow.

## Structuring a package

```text
mypkg/
├── __init__.py          # public API re-exports only
├── _internal/           # leading underscore = not public
├── models.py
├── service.py
├── errors.py            # domain exceptions
└── py.typed             # ship type info (PEP 561)
```

- Keep `__init__.py` thin: re-export the public surface, no logic.
- One module per cohesive concern; split before a file passes ~400 lines.
- Dependency injection via constructor args/factories beats import-time globals.

## Concurrency

- I/O-bound + many connections → `asyncio` (`async def` + `await`); never block
  the event loop with sync I/O or CPU work (`run_in_executor` for those).
- CPU-bound → `concurrent.futures.ProcessPoolExecutor` (the GIL throttles
  threads for CPU work).
- Threads → I/O-bound work in sync code (`ThreadPoolExecutor`).
- Share data with `queue.Queue`/`asyncio.Queue`; guard mutable shared state with
  a lock and keep critical sections tiny.

## Tooling baseline

```bash
ruff check . --fix      # lint + import sort (replaces flake8 + isort)
ruff format .           # formatting (Black-compatible)
mypy --strict src/      # static typing gate
```

Pin these in `pyproject.toml` and wire them into the CI workflow the kit
renders, so the same gates run locally and in `ci_cd.target`.

## Anti-patterns

- Mutable default arguments (`def f(x=[])`) — use `None` + assign inside.
- `from module import *` outside controlled re-export.
- Comparing with `== None` / `== True` — use `is None`, truthiness.
- Catching `Exception`/bare `except` to hide failures.
- Module-level mutable singletons configured at import time.

---

*Re-authored for ai-core-kit from the ECC `python-patterns` skill
(Copyright (c) 2026 Affaan Mustafa, MIT). Adapted to kit conventions; relicensed
notice retained under MIT.*
