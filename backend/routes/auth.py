from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.db import get_db
from worker.publisher import login_to_x
from loguru import logger
from backend.main import verify_token

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
    """
    from worker.publisher import sync_history_task
    from backend.models import Post, PostMetricSnapshot
    from datetime import datetime, timezone
    
    logger.info(f"Syncing history for {username}...")
    try:
        result = await sync_history_task(username)
    except Exception as e:
        logger.error(f"Worker crashed during sync: {e}")
        raise HTTPException(status_code=500, detail=f"Worker error: {str(e)}")
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["log"])
    
    count = 0
    for post_data in result["posts"]:
        # Check if already exists
        exists = db.query(Post).filter(Post.tweet_id == post_data["tweet_id"]).first()
        if not exists:
            # Parse historical date if available
            pub_date = None
            if post_data.get("published_at"):
                try:
                    # ISO string to datetime
                    pub_date = datetime.fromisoformat(post_data["published_at"].replace("Z", "+00:00")).replace(tzinfo=None)
                except:
                    pass
            
            final_date = pub_date or datetime.now(timezone.utc).replace(tzinfo=None)
            
            new_post = Post(
                content=post_data["content"],
                tweet_id=post_data["tweet_id"],
                username=username,
                status="sent",
                views_count=post_data["views"],
                likes_count=post_data["likes"],
                reposts_count=post_data["reposts"],
                updated_at=final_date
            )
            db.add(new_post)
            db.flush() # Get ID
            
            # Day 0 baseline (current stats as baseline)
            # Use the historical date for the snapshot so it shows in the chart
            snapshot = PostMetricSnapshot(
                post_id=new_post.id,
                views=new_post.views_count,
                likes=new_post.likes_count,
                reposts=new_post.reposts_count,
                timestamp=final_date
            )
            db.add(snapshot)
            count += 1
            
    db.commit()
    return {"status": "success", "imported": count, "log": result["log"]}

@router.get("/status")
async def get_status():
    """
    Returns a list of all connected accounts.
    """
    import os
    import json
    
    worker_dir = os.path.join(os.path.dirname(__file__), "..", "..", "worker")
    accounts_dir = os.path.join(worker_dir, "accounts")
    
    accounts = []
    
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
                            "last_connected": data.get("connected_at")
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
                "is_legacy": True
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
                    "is_legacy": False
                })
                logger.info(f"Detected environment variable cookies for {env_username}")
        except json.JSONDecodeError:
            logger.error("X_COOKIES_JSON is not valid JSON")

    return {"accounts": accounts}


