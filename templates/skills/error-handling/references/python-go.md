# Error handling — Python & Go

The same contract as the SKILL body, expressed idiomatically per language: a base
error with a `code`, specific subtypes, wrapping that preserves the cause, and a
single boundary that maps errors to the response envelope.

## Python

### Exception hierarchy

```python
class AppError(Exception):
    """Base application error carrying a stable code and HTTP status."""
    def __init__(self, message: str, code: str, status_code: int = 500):
        super().__init__(message)
        self.code = code
        self.status_code = status_code


class NotFoundError(AppError):
    def __init__(self, resource: str, id: str):
        super().__init__(f"{resource} not found: {id}", "NOT_FOUND", 404)


class ValidationError(AppError):
    def __init__(self, message: str, details: list[dict] | None = None):
        super().__init__(message, "VALIDATION_ERROR", 422)
        self.details = details or []
```

### FastAPI global handlers

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

app = FastAPI()


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )


@app.exception_handler(Exception)
async def unhandled_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unexpected error", exc_info=exc)  # full context to the log
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR",
                           "message": "An unexpected error occurred"}},
    )
```

### Wrapping without losing the cause

Use `raise … from err` so the original traceback survives:

```python
try:
    row = repo.find(id)
except DatabaseError as err:
    raise AppError("Database error", "DB_ERROR") from err
```

## Go

### Sentinel errors and wrapping

```go
package domain

import "errors"

var (
    ErrNotFound     = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrConflict     = errors.New("conflict")
)

// Wrap with context using %w so errors.Is/As still work upstream.
func (r *UserRepository) FindByID(ctx context.Context, id string) (*User, error) {
    user, err := r.db.QueryRow(ctx, "SELECT * FROM users WHERE id = $1", id)
    if errors.Is(err, sql.ErrNoRows) {
        return nil, fmt.Errorf("user %s: %w", id, ErrNotFound)
    }
    if err != nil {
        return nil, fmt.Errorf("querying user %s: %w", id, err)
    }
    return user, nil
}
```

### Mapping errors to the envelope at the boundary

```go
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    user, err := h.service.GetUser(r.Context(), chi.URLParam(r, "id"))
    if err != nil {
        switch {
        case errors.Is(err, domain.ErrNotFound):
            writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
        case errors.Is(err, domain.ErrUnauthorized):
            writeError(w, http.StatusForbidden, "FORBIDDEN", "Access denied")
        default:
            slog.Error("unexpected error", "err", err) // full context to the log
            writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR",
                "An unexpected error occurred")
        }
        return
    }
    writeJSON(w, http.StatusOK, user)
}
```

`writeError` should emit the same `{ "error": { "code", "message" } }` envelope the
TypeScript handler produces, so every service in the project speaks one error shape.
