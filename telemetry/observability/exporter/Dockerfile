# =============================================================================
# ai-core-kit cost exporter image
# =============================================================================
# BUILD CONTEXT MUST BE telemetry/  (one level above observability/), because
# this image needs the cost engine + pricing map that live at the telemetry/
# root, not just the exporter package:
#
#   docker build -f observability/exporter/Dockerfile -t ack-cost-exporter .
#       # run from inside telemetry/  (so `.` == telemetry/)
#   # or from the repo root:
#   docker build -f telemetry/observability/exporter/Dockerfile \
#                -t ack-cost-exporter telemetry/
#
# The companion docker-compose.yml sets `context: ../..` (telemetry/) for this
# exact reason. With the context at telemetry/ the COPY paths below resolve:
#   aggregate.py                      -> /app/aggregate.py   (the OFFLINE engine)
#   pricing.json                      -> /app/pricing.json   (default price map)
#   observability/exporter/*.py,txt  -> /app/                (the exporter itself)
# aggregate.py + pricing.json land NEXT TO ack_cost_exporter.py so its in-image
# `import aggregate` resolves against the script's own dir (no path gymnastics).
# At runtime pricing.json is normally bind-mounted read-only over this baked-in
# copy; the baked copy is just a sane default so the image runs standalone.
# =============================================================================
FROM python:3.12-slim

LABEL org.opencontainers.image.title="ai-core-kit cost exporter" \
      org.opencontainers.image.description="Prometheus exporter for OFFLINE Claude Code cost (wraps telemetry/aggregate.py)." \
      org.opencontainers.image.source="https://github.com/arthurghz/ai-core-kit"

# No .pyc, unbuffered logs (so scrape errors show up immediately in `docker logs`).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ACK_PORT=9418

WORKDIR /app

# Install the single runtime dependency first for better layer caching.
COPY observability/exporter/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# The OFFLINE cost engine + default pricing map (context == telemetry/).
COPY aggregate.py /app/aggregate.py
COPY pricing.json /app/pricing.json

# The exporter itself.
COPY observability/exporter/ack_cost_exporter.py /app/ack_cost_exporter.py

# Run as a non-root user; transcripts are mounted read-only so no write perms
# are needed anywhere.
RUN useradd --create-home --uid 10001 exporter \
    && chown -R exporter:exporter /app
USER exporter

EXPOSE 9418

CMD ["python3", "ack_cost_exporter.py"]
