---
name: docker-patterns
description: Docker and Docker Compose patterns for this project — multi-stage Dockerfiles, dev/prod compose layering, healthchecks and service dependencies, networking, volume strategy, and container hardening. Use when containerizing the app, writing a Dockerfile or compose file, or troubleshooting container networking/volumes. TRIGGER when editing Dockerfile/compose.yaml or wiring local services. SKIP for Kubernetes manifests or cloud-specific IaC.
license: MIT
---

# Docker Patterns

Docker and Docker Compose for reproducible local dev and lean production images.
Language-agnostic; the Dockerfile base image follows `project.language`.

## When to use

- Writing a `Dockerfile` or `docker-compose.yaml`.
- Standing up local dependencies (DB, cache, mail) for development.
- Diagnosing container networking, volume, or image-size issues.

## When NOT to use

- Kubernetes/Helm or cloud-provider IaC → an infra pack.

## Multi-stage Dockerfile

Separate build deps from the runtime image; ship only artifacts. (Node example;
the same `deps → build → runtime` shape applies to any language.)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --production

FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S app && adduser -S app -u 1001
USER app                                   # never run as root
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

- Pin a specific base tag (`node:22-alpine`), not `latest`.
- Order layers from least- to most-frequently-changed (deps before source) for
  cache hits.
- A `.dockerignore` (node_modules, .git, build output, secrets) keeps the
  context small and avoids leaking files.

## Compose for local development

```yaml
services:
  app:
    build: { context: ., target: dev }
    ports: ["3000:3000"]
    volumes:
      - .:/app                 # bind mount: hot reload
      - /app/node_modules      # anonymous volume: keep container deps
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/app_dev
    depends_on:
      db: { condition: service_healthy }   # wait for healthcheck, not just start

  db:
    image: postgres:16-alpine
    environment: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: app_dev }
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

- `depends_on … condition: service_healthy` prevents the app racing an
  unready DB — a `depends_on` without a condition only waits for *start*.
- Services resolve each other by name on the Compose network
  (`db:5432`, `redis:6379`).

## Dev / prod layering

```bash
docker compose up                                            # auto-loads override
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

- `docker-compose.override.yml` (auto-loaded): debug env, debugger port — dev
  only.
- `docker-compose.prod.yml` (explicit): `target: production`, `restart: always`,
  resource limits.

## Networking

- Split networks so only the API can reach the DB:

```yaml
services:
  api: { networks: [frontend-net, backend-net] }
  db:  { networks: [backend-net] }     # not reachable from frontend
networks: { frontend-net: {}, backend-net: {} }
```

- Bind data-store ports to localhost in dev (`"127.0.0.1:5432:5432"`); omit
  `ports` entirely in prod so the store is reachable only inside the network.

## Volumes

- **Named volume** (`pgdata:`) — persistent data managed by Docker.
- **Bind mount** (`.:/app`) — source for hot reload in dev.
- **Anonymous volume** (`/app/node_modules`) — shields container-built deps from
  the host bind mount.
- Mount init scripts read-only:
  `./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql:ro`.

## Hardening

- Run as a non-root user (`USER app`); drop unneeded capabilities.
- No secrets in the image or `docker-compose.yml` — use a gitignored `.env` or
  Docker secrets; reference via `environment`/`env_file`.
- Add `HEALTHCHECK` so orchestrators detect a wedged container.
- Minimal base (`-alpine`/`-slim`/distroless) shrinks the attack surface.
- Scan images (`docker scout`, Trivy) in CI.

## Anti-patterns

- `FROM …:latest` (non-reproducible builds).
- Running the container process as root.
- Baking secrets or `.env` into the image.
- One mega-container running every service — one process per container.
- `depends_on` without a healthcheck condition (app races an unready dependency).
- No `.dockerignore` (bloated context, leaked files).

---

*Re-authored for ai-core-kit from the ECC `docker-patterns` skill
(Copyright (c) 2026 Affaan Mustafa, MIT). Adapted to kit conventions; relicensed
notice retained under MIT.*
