# syntax=docker/dockerfile:1
# Container image for ${project.name} (${project.framework} / ${project.language}).
#
#   docker build -t ${project.name} .
#   docker compose up --build    # web -> http://localhost:3000  (+ Postgres)
#
# This is a single-stage starting point that assumes a Node/${project.framework} app
# with a package.json. As your app lands, switch to a multi-stage build
# (deps -> build -> runner) — see the `saas` archetype's Dockerfile for a Next.js
# standalone reference. Commit your ${project.package_manager} lockfile for
# reproducible builds.

FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
# Install deps only once a manifest exists (the fresh skeleton has none yet).
RUN if [ -f package.json ]; then ${project.package_manager} install; fi
EXPOSE 3000
CMD ["sh", "-c", "${project.package_manager} run dev"]
