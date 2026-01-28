FROM mcr.microsoft.com/playwright/python:v1.41.0-jammy

WORKDIR /app

# Install system dependencies (optional, image has most)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from root
COPY requirements.txt .
# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Playwright browsers are in base image, but we ideally need to ensure dependencies for patched driver
# and undetected-playwright might need specific versions or deps.
RUN playwright install chromium --with-deps

# Copy backend code
COPY backend/ ./backend/
# Copy worker code (Critical: backend imports worker)
COPY worker/ ./worker/

# Create logs and uploads directories
RUN mkdir -p logs uploads

EXPOSE 8000

# Start command
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
