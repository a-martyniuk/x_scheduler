from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.db import get_db
from worker.publisher import login_to_x
from loguru import logger
from backend.dependencies import verify_token

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str

async def background_login(username, password):
    # This runs in background to avoid blocking API
    logger.info(f"Starting background login for {username}...")
    result = await login_to_x(username, password)
    logger.info(f"Background login result: {result}")

@router.post("/verify-token")
async def verify_admin_token(token: str = Depends(verify_token)):
    """
    Endpoint to verify the Admin Token from the Login Screen.
    Uses the global dependency verify_token. If it passes, ret 200.
    """
    return {"status": "valid"}

@router.post("/login")
async def login(request: LoginRequest, background_tasks: BackgroundTasks):
    logger.info(f"Login request received for {request.username}")
    background_tasks.add_task(background_login, request.username, request.password)
    logger.debug("Background task queued")
    
    return {
        "status": "processing", 
        "message": "Login process started. This may take up to 30-60 seconds. Please check server logs or wait a minute before posting."
    }

@router.post("/sync/{username}")
async def sync_history(username: str, db: Session = Depends(get_db)):
    """
    Triggers a manual sync of account history.
    Delegates to Sync Service.
    """
    from backend.services.sync_service import sync_account_history
    
    return await sync_account_history(username, db)

@router.get("/status")
async def get_status(db: Session = Depends(get_db)):
    """
    Returns a list of all connected accounts.
    """
    import os
    import json
    from backend.models import AccountMetricSnapshot
    
    worker_dir = os.path.join(os.path.dirname(__file__), "..", "..", "worker")
    accounts_dir = os.path.join(worker_dir, "accounts")
    
    accounts = []
    
    def get_last_synced(username: str) -> str | None:
        try:
            snapshot = db.query(AccountMetricSnapshot).filter(
                AccountMetricSnapshot.username == username
            ).order_by(AccountMetricSnapshot.timestamp.desc()).first()
            if snapshot and snapshot.timestamp:
                return snapshot.timestamp.isoformat()
        except:
            pass
        return None

    if os.path.exists(accounts_dir):
        for username in os.listdir(accounts_dir):
            user_dir = os.path.join(accounts_dir, username)
            if not os.path.isdir(user_dir):
                continue
                
            user_info_path = os.path.join(user_dir, "user_info.json")
            cookies_path = os.path.join(user_dir, "cookies.json")
            
            if os.path.exists(user_info_path):
                try:
                    with open(user_info_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        is_cookies_valid = os.path.exists(cookies_path) and os.path.getsize(cookies_path) > 2
                        accounts.append({
                            "username": username,
                            "connected": is_cookies_valid,
                            "last_connected": data.get("connected_at"),
                            "last_synced": get_last_synced(username)
                        })
                except Exception as e:
                    logger.error(f"Failed to load {username} info: {e}")
    
    # Also check legacy cookies.json at root for backward compatibility
    legacy_cookies = os.path.join(worker_dir, "cookies.json")
    if os.path.exists(legacy_cookies) and os.path.getsize(legacy_cookies) > 2:
        # Try to find user info for legacy
        legacy_info = os.path.join(worker_dir, "user_info.json")
        username = "Legacy User"
        last_connected = None
        if os.path.exists(legacy_info):
            try:
                with open(legacy_info, 'r', encoding='utf-8') as f:
                    d = json.load(f)
                    username = d.get("username", "Legacy User")
                    last_connected = d.get("connected_at")
            except: pass
        
        # Only add if not already in accounts
        if not any(a["username"] == username for a in accounts):
            accounts.append({
                "username": username,
                "connected": True,
                "last_connected": last_connected,
                "is_legacy": True,
                "last_synced": get_last_synced(username)
            })
    
    # Check for environment variable cookies (Railway deployment)
    env_cookies = os.environ.get('X_COOKIES_JSON')
    env_username = os.environ.get('X_USERNAME')
    
    if env_cookies and env_username:
        # Verify the JSON is valid
        try:
            json.loads(env_cookies)
            # Only add if not already in accounts
            if not any(a["username"] == env_username for a in accounts):
                accounts.append({
                    "username": env_username,
                    "connected": True,
                    "last_connected": None,
                    "is_legacy": False,
                    "last_synced": get_last_synced(env_username)
                })
                logger.info(f"Detected environment variable cookies for {env_username}")
        except json.JSONDecodeError:
            logger.error("X_COOKIES_JSON is not valid JSON")

    return {"accounts": accounts}


