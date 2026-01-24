FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from root
COPY requirements.txt .
# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Browsers and System Dependencies
RUN pip install playwright && playwright install --with-deps chromium

# Copy backend code
COPY backend/ ./backend/

# Create logs and uploads directories
RUN mkdir -p logs uploads

EXPOSE 8000

# Start command
CMD uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
