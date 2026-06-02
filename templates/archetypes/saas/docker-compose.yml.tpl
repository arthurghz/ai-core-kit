# Local container stack for ${project.name}.
#
#   cp env.example .env.local    # then fill in your keys
#   docker compose up --build    # web -> http://localhost:3000
#
# `web` builds the PRODUCTION image (Next.js standalone) and runs it locally,
# alongside a throwaway Postgres (when persistence is enabled). For a hot-reload
# dev loop, run `${project.package_manager} dev` on the host instead. In production
# this app targets ${hosting.target} against managed Supabase.
services:
  web:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - path: .env.local
        required: false
#ack:if persistence.enabled
    environment:
      # Point the Postgres client / Drizzle at the local db service for compose dev
      # (overrides DATABASE_URL from .env.local while `compose up` is running).
      DATABASE_URL: postgresql://postgres:postgres@db:5432/${project.name}
    depends_on:
      db:
        condition: service_healthy

  # Local ${persistence.db} for dev (production uses managed Supabase). Swap the
  # image if your fork chose a different engine.
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${project.name}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d ${project.name}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  pgdata:
#ack:endif
