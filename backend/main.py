import os
import asyncio
import sys

# Windows compatibility for Playwright/Subprocesses
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, Base
from fastapi.staticfiles import StaticFiles
from .routes import posts, upload, auth
from loguru import logger
import sys

# Configure Loguru
logger.remove()
logger.add(sys.stderr, format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")
logger.add("logs/backend.log", rotation="10 MB", retention="10 days", level="INFO")

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="X Scheduler")

# Ensure uploads and logs directory exists
os.makedirs("uploads", exist_ok=True)
os.makedirs("logs", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(posts.router, prefix="/api/posts", tags=["posts"])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up...")
    from .scheduler import start_scheduler
    logger.info("Starting scheduler...")
    start_scheduler()
    logger.info("Scheduler started successfully.")

@app.get("/")
def read_root():
    return {"message": "X Scheduler API is running"}
