# Local development stack for ${project.name}.
#
#   docker compose up --build    # web -> http://localhost:3000
#
# The web container (plus a throwaway Postgres when persistence is enabled).
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
      # Point your data layer at the local db service while running `compose up`.
      DATABASE_URL: postgresql://postgres:postgres@db:5432/${project.name}
    depends_on:
      db:
        condition: service_healthy

  # Local ${persistence.db} for dev. Swap the image if your fork chose another engine.
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
