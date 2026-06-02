---
name: python-testing
description: pytest testing strategy for this project — TDD cycle, fixtures and scopes, parametrization, mocking, async tests, and coverage gates. Use when writing or reviewing Python tests in a repo whose manifest sets project.language == python. TRIGGER when creating test_*.py, designing a suite, or reviewing coverage. SKIP for non-test Python (use python-patterns) or HTTP-layer integration specifics owned by fastapi-patterns.
license: MIT
---

# Python Testing

pytest-based testing for projects where `project.language: python`. Pairs with
`python-patterns` (write the code) and any framework pack (test its surface).

## When to use

- Writing new Python behaviour test-first (red → green → refactor).
- Designing or restructuring a test suite.
- Reviewing coverage and test quality on a Python diff.

## When NOT to use

- Production `.py` code → `python-patterns`.
- Framework wiring under test → consult the matching framework pack for the
  client/fixture idiom, then test it here.

## TDD cycle

1. **RED** — write a failing test for the next behaviour.
2. **GREEN** — minimal code to pass.
3. **REFACTOR** — clean up with tests green.

```python
def test_add_returns_sum():
    assert add(2, 3) == 5
```

## Coverage gate

- Target ≥ 80% overall; 100% on critical/security paths.
- Wire the gate into CI so it fails the build, not just prints:

```bash
pytest --cov=src --cov-report=term-missing --cov-fail-under=80
```

## Structure

```text
tests/
├── conftest.py        # shared fixtures
├── unit/              # fast, isolated, no I/O
├── integration/       # DB / HTTP / filesystem
└── e2e/               # full-stack flows
```

- One behaviour per test; descriptive names:
  `test_login_with_invalid_password_is_rejected`.
- Tests are independent — no shared mutable state, no ordering assumptions.
- Test behaviour, not implementation internals.

## Fixtures

```python
import pytest

@pytest.fixture
def db():
    conn = connect(":memory:")
    create_schema(conn)
    yield conn          # setup above, teardown below
    conn.close()

@pytest.fixture(scope="session")   # function (default) | module | session
def expensive_client():
    client = build_client()
    yield client
    client.close()
```

- Default to function scope; widen only for genuinely expensive, read-only
  resources.
- Put cross-file fixtures in `conftest.py`.
- `autouse=True` sparingly (e.g. reset global config) — hidden setup hurts
  readability.

## Parametrization

```python
@pytest.mark.parametrize(
    "raw,expected",
    [("a@b.com", True), ("nope", False), ("@x.com", False)],
    ids=["valid", "missing-at", "missing-local"],
)
def test_is_valid_email(raw, expected):
    assert is_valid_email(raw) is expected
```

Prefer parametrization over copy-pasted near-identical tests. Give each case an
`id` so failures read clearly.

## Mocking

```python
from unittest.mock import patch

@patch("mypkg.client.fetch", autospec=True)   # autospec catches API misuse
def test_handles_upstream_failure(fetch):
    fetch.side_effect = ConnectionError("down")
    with pytest.raises(ServiceUnavailable):
        do_work()
    fetch.assert_called_once()
```

- Mock at the boundary you own (where the name is *used*, not where it is
  defined).
- Mock external services, clocks, randomness, network — never the unit under
  test.
- Avoid over-specific mocks that assert on internals; they make refactors break
  tests for no behavioural reason.

## Async tests

```python
import pytest

@pytest.mark.asyncio
async def test_async_fetch():
    result = await fetch_user(1)
    assert result.id == 1
```

Install `pytest-asyncio`; mock awaitables with `AsyncMock` / assert with
`assert_awaited_once()`.

## Exceptions

```python
with pytest.raises(ValueError, match="invalid input"):
    validate("")
```

Use `pytest.raises` — never wrap the call in a bare `try/except` inside a test.

## Useful invocations

```bash
pytest -x            # stop at first failure
pytest --lf          # rerun last failures
pytest -k user       # name filter
pytest -m "not slow" # marker filter
pytest -q            # quiet
```

Register custom markers in `pyproject.toml` under
`[tool.pytest.ini_options].markers` and run with `--strict-markers`.

## Anti-patterns

- Asserting on log strings or private attributes instead of observable
  behaviour.
- Network/DB hits in "unit" tests — mark them `integration`.
- Tests that depend on execution order or leftover state.
- Catching exceptions to "pass" a test; let `pytest.raises` assert them.

---

*Re-authored for ai-core-kit from the ECC `python-testing` skill
(Copyright (c) 2026 Affaan Mustafa, MIT). Adapted to kit conventions; relicensed
notice retained under MIT.*
