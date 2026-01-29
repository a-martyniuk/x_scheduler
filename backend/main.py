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
from .routes import posts, upload, auth, analytics, health
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
SCREENSHOTS_PATH = os.path.join(settings.DATA_DIR, "screenshots")
os.makedirs(UPLOAD_PATH, exist_ok=True)
os.makedirs(LOG_PATH, exist_ok=True)
os.makedirs(SCREENSHOTS_PATH, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=UPLOAD_PATH), name="uploads")
app.mount("/screenshots", StaticFiles(directory=SCREENSHOTS_PATH), name="screenshots")

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
app.include_router(health.router, prefix="/api/health", tags=["health"])

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



from fastapi.responses import HTMLResponse

@app.get("/")
def read_root():
    return {"message": "X Scheduler API is running"}

@app.get("/debug/screenshots", response_class=HTMLResponse)
async def list_screenshots():
    files = []
    if os.path.exists(SCREENSHOTS_PATH):
        # List all png and html files
        for f in os.listdir(SCREENSHOTS_PATH):
            if f.lower().endswith(('.png', '.html')):
                fp = os.path.join(SCREENSHOTS_PATH, f)
                files.append({
                    "name": f,
                    "time": os.path.getmtime(fp),
                    "type": "image" if f.endswith('.png') else "code"
                })
    
    # Sort by time, newest first
    files.sort(key=lambda x: x['time'], reverse=True)
    
    html = """
    <html>
    <head>
        <title>Debug Screenshots</title>
        <style>
            body { font-family: sans-serif; padding: 20px; background: #111; color: #eee; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; }
            .card { background: #222; padding: 10px; border-radius: 8px; border: 1px solid #333; }
            .card img { width: 100%; height: auto; border-radius: 4px; display: block; margin-bottom: 10px; }
            .card a { color: #4af; text-decoration: none; word-break: break-all; font-size: 12px; }
            .card date { display: block; font-size: 10px; color: #888; margin-top: 5px; }
            .btn-clear { background: #d33; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-weight: bold; }
            h1 { color: #f0f0f0; margin: 0; }
        </style>
        <script>
            async function clearScreenshots() {
                if (!confirm('Clear all diagnostic screenshots?')) return;
                try {
                    const res = await fetch('/debug/screenshots/clear', { method: 'POST' });
                    const result = await res.json();
                    if (result.success) {
                        alert('Gallery cleared!');
                        location.reload();
                    }
                } catch (e) { alert('Failed to clear: ' + e); }
            }
        </script>
    </head>
    <body>
        <div class="header">
            <h1>Debug Gallery</h1>
            <button class="btn-clear" onclick="clearScreenshots()">Clear All</button>
        </div>
        <div class="grid">
    """
    
    for f in files:
        date_str = datetime.fromtimestamp(f['time']).strftime('%Y-%m-%d %H:%M:%S')
        url = f"/screenshots/{f['name']}"
        thumb = url if f['type'] == 'image' else ''
        
        card = f"""
        <div class="card">
            {f'<a href="{url}" target="_blank"><img src="{thumb}" loading="lazy"></a>' if thumb else ''}
            <a href="{url}" target="_blank">{f['name']}</a>
            <date>{date_str}</date>
        </div>
        """
        html += card
        
    html += "</div></body></html>"
    return html

@app.post("/debug/screenshots/clear")
async def clear_all_screenshots():
    if not os.path.exists(SCREENSHOTS_PATH):
        return {"success": False, "error": "Path not found"}
    
    count = 0
    for f in os.listdir(SCREENSHOTS_PATH):
        if f.lower().endswith(('.png', '.html')):
            try:
                os.remove(os.path.join(SCREENSHOTS_PATH, f))
                count += 1
            except Exception as e:
                logger.error(f"Failed to delete {f}: {e}")
    
    logger.info(f"Screenshot gallery cleared. {count} files removed.")
    return {"success": True, "cleared": count}

