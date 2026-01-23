FROM mcr.microsoft.com/playwright/python:v1.49.0-noble

WORKDIR /app

# Copy requirements from root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (if not included in image)
RUN playwright install chromium

# Copy code
COPY worker/ ./worker/
COPY backend/ ./backend/ 

# The worker might need to access the database or common logic
# In the current structure, it's safer to copy the backend folder too if there are absolute imports

ENV PYTHONPATH=/app

# Start command (The scheduler in backend triggers tasks, but we need a persistent worker if it's separate)
# In this architecture, APScheduler runs inside the backend process.
# Maybe we can run a separate script for the worker tasks if we decouple it.
# For now, let's assume the worker is triggered by the backend, but having a dedicated Docker image
# allows us to scale the playwright execution environment separately if needed.
# If the backend handles scheduling, we might not need a separate "worker" container UNLESS
# we use a message queue (Celery/Redis).
# Given the current simple APScheduler setup, the backend *is* the worker.
# I'll create a docker-compose that runs them together or separately if I refactor slightly.
