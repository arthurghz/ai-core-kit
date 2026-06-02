# syntax=docker/dockerfile:1
# Container image for ${project.name} (${project.language} / ${project.framework}).
#
#   docker build -t ${project.name} .
#   docker compose up --build    # api -> http://localhost:8000  (+ Postgres)
#
# Default stack: Python + uv + FastAPI. If your fork chose a different language,
# swap the base image + install/run steps to match (your package manager is
# ${project.package_manager}). Commit your lockfile for reproducible builds.

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

# uv: fast, reproducible Python installs (https://docs.astral.sh/uv/).
RUN pip install --no-cache-dir uv

COPY . .
# Install deps from whichever manifest your project uses (skeleton has none yet).
RUN if [ -f uv.lock ] || [ -f pyproject.toml ]; then uv sync --frozen || uv sync; \
    elif [ -f requirements.txt ]; then uv pip install --system -r requirements.txt; fi

EXPOSE 8000
# Point this at your ASGI app (e.g. src/ exposing `app`); adjust as the code lands.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
