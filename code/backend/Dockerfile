# CarbonXchange Backend - Production Dockerfile
FROM python:3.11-slim

# Build arguments
ARG BUILD_DATE
ARG VERSION=1.0.0

# Labels
LABEL maintainer="CarbonXchange Team" \
      version="${VERSION}" \
      build-date="${BUILD_DATE}" \
      description="CarbonXchange Carbon Credit Trading Platform Backend"

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    FLASK_ENV=production \
    PORT=5000 \
    PYTHONPATH=/app

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
        netcat-openbsd \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create logs and uploads directories
RUN mkdir -p /app/logs /app/uploads

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY src/ ./src/

# Optional pre-compiled contract ABIs for on-chain calls (see
# contracts_abi/README.md - the directory always exists, at minimum with
# just that README, so this COPY never fails on a clean checkout).
COPY contracts_abi/ ./contracts_abi/

# Create non-root user for security
RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 --gid 1001 --no-create-home appuser \
    && chown -R appuser:appgroup /app

USER appuser

# Expose port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Entrypoint
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "4", \
     "--worker-class", "gevent", \
     "--worker-connections", "1000", \
     "--timeout", "120", \
     "--keepalive", "5", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "100", \
     "--access-logfile", "/app/logs/access.log", \
     "--error-logfile", "/app/logs/error.log", \
     "--log-level", "info", \
     "--preload", \
     "src.main:app"]
