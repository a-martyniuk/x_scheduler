import os
import asyncio
import sys
from datetime import datetime

# Windows compatibility for Playwright/Subprocesses
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, Header, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from .db import engine, Base, SessionLocal
from fastapi.staticfiles import StaticFiles
from .routes import posts, upload, auth, analytics
from .config import settings
from fastapi import Header, HTTPException, Depends
from loguru import logger
import sys

# Configure Loguru
logger.remove()
logger.add(sys.stderr, format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")
# LOG_PATH se define más abajo, así que usamos settings.DATA_DIR aquí o movemos la lógica
logger.add(os.path.join(settings.DATA_DIR, "logs", "backend.log"), rotation="10 MB", retention="10 days", level="INFO")

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="X Scheduler")

# Ensure data, uploads and logs directory exists
os.makedirs(settings.DATA_DIR, exist_ok=True)
UPLOAD_PATH = os.path.join(settings.DATA_DIR, "uploads")
LOG_PATH = os.path.join(settings.DATA_DIR, "logs")
os.makedirs(UPLOAD_PATH, exist_ok=True)
os.makedirs(LOG_PATH, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_PATH), name="uploads")

# 1. CORS Middleware - MUST BE FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow ALL origins
    allow_credentials=False, # Disable cookies (we use Header auth)
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# 2. Request Logging Middleware for Diagnostics
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming {request.method} request to {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

from .dependencies import verify_token

app.include_router(posts.router, prefix="/api/posts", tags=["posts"], dependencies=[Depends(verify_token)])
app.include_router(upload.router, prefix="/api/upload", tags=["upload"], dependencies=[Depends(verify_token)])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"], dependencies=[Depends(verify_token)])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"], dependencies=[Depends(verify_token)])

@app.on_event("startup")
async def startup_event():
    logger.info("Application starting up...")
    
    # Run DB Migrations
    from .migrate import run_migrations
    run_migrations()
    
    from .scheduler import start_scheduler
    logger.info("Starting scheduler...")
    start_scheduler()
    logger.info("Scheduler started successfully.")

@app.get("/api/health")
async def health_check():
    db_status = "ok"
    try:
        db = SessionLocal()
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok", 
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }

@app.get("/")
def read_root():
    return {"message": "X Scheduler API is running"}
