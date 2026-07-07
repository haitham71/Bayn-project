# ─────────────────────────────────────────────
# Dockerfile — Bayn Identity Service
# ─────────────────────────────────────────────

FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim

WORKDIR /app

# Skip .pyc generation — irrelevant for a short-lived container, and
# avoids write-permission issues on read-only or mounted volumes
ENV PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY bayn/ ./bayn/
COPY alembic.ini .
COPY bayn/core/db/ ./bayn/core/db/

RUN useradd --create-home --shell /bin/bash appuser
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

CMD ["uvicorn", "bayn.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]