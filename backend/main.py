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

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="X Scheduler")

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)

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
    print("[MAIN] Application starting up...", flush=True)
    from .scheduler import start_scheduler
    print("[MAIN] Starting scheduler...", flush=True)
    start_scheduler()
    print("[MAIN] Scheduler started successfully.", flush=True)

@app.get("/")
def read_root():
    return {"message": "X Scheduler API is running"}
