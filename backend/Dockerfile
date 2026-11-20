# ============================================================
# ThoracicAI Platform Backend Dockerfile
# Production-ready Python 3.12 container with PyTorch & DenseNet121
# ============================================================

FROM python:3.12-slim as base

# Prevent Python from writing .pyc and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install minimal OS dependencies for PyTorch & Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application source
COPY app/ app/
COPY weights/ weights/

# Create non-root user and private storage directory
RUN useradd -m -u 1000 thoracicuser && \
    mkdir -p /app/storage/reports && \
    chown -R thoracicuser:thoracicuser /app

USER thoracicuser

EXPOSE 8000 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-10000}/api/health || exit 1

CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
