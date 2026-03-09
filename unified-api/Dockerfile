FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev git \
    && rm -rf /var/lib/apt/lists/*

COPY data-connectors/ ./data-connectors/
RUN pip install --no-cache-dir ./data-connectors

COPY unified-api/requirements.txt ./unified-api/requirements.txt
RUN pip install --no-cache-dir -r ./unified-api/requirements.txt

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home appuser

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY data-connectors/ ./data-connectors/
COPY unified-api/ ./unified-api/

RUN sed -i 's/\r$//' /app/unified-api/entrypoint.sh \
    && chmod +x /app/unified-api/entrypoint.sh \
    && mkdir -p /app/unified-api/reports \
    && chown -R appuser:appuser /app

USER appuser
WORKDIR /app/unified-api

EXPOSE 8000

ENTRYPOINT ["/app/unified-api/entrypoint.sh"]
