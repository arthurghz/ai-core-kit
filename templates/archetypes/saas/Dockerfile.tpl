# syntax=docker/dockerfile:1
# Production container for ${project.name} — Next.js (standalone output).
#
#   docker build -t ${project.name} .
#   docker run -p 3000:3000 --env-file .env.local ${project.name}
#
# For local dev with a throwaway Postgres alongside the app, use docker-compose.yml
# (`docker compose up --build`). In production this app targets ${hosting.target}.
# Tip: commit your ${project.package_manager} lockfile for reproducible builds, and
# keep `output: "standalone"` in next.config.ts (the COPY steps below rely on it).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- dependencies -----------------------------------------------------------
FROM base AS deps
# Copy the lockfile too (the `*` keeps this from failing on the lockfile-less fresh
# skeleton) so installs are reproducible once you commit one.
COPY package.json pnpm-lock.yaml* ./
RUN ${project.package_manager} install

# ---- build ------------------------------------------------------------------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ${project.package_manager} run build

# ---- runtime (minimal, non-root) --------------------------------------------
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
