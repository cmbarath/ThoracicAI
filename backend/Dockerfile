# ============================================================
# ThoracicAI Platform — Production Cloud Run Dockerfile
# Optimized for Google Cloud Run (1 vCPU, 2 GiB RAM, CPU PyTorch)
# ============================================================

FROM python:3.12-slim as base

# Prevent Python from writing .pyc and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8080

WORKDIR /app

# Install minimal OS dependencies for PyTorch & Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-optimized PyTorch first (reduces image size from ~3.5GB to ~750MB)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining backend dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source and trained model weights
COPY app/ app/
COPY weights/ weights/

# Create non-root user and private storage directory
RUN useradd -m -u 1000 thoracicuser && \
    mkdir -p /app/storage/reports && \
    chown -R thoracicuser:thoracicuser /app

USER thoracicuser

# Cloud Run default port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

# Start uvicorn listening on 0.0.0.0 and Cloud Run's dynamic $PORT with 1 worker
CMD ["sh", "-c", "python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1"]
