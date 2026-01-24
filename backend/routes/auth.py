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
    """
    from worker.publisher import sync_history_task
    from backend.models import Post, PostMetricSnapshot, AccountMetricSnapshot
    from datetime import datetime, timezone
    
    logger.info(f"Syncing history for {username}...")
    try:
        result = await sync_history_task(username)
    except Exception as e:
        logger.error(f"Worker crashed during sync: {e}")
        raise HTTPException(status_code=500, detail=f"Worker error: {str(e)}")
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["log"])

    # --- SAVE PROFILE STATS ---
    if "profile" in result and result["profile"]:
        try:
            profile = result["profile"]
            logger.info(f"Saving profile stats: {profile}")
            if profile.get("followers", 0) > 0:
                acc_metric = AccountMetricSnapshot(
                    username=username,
                    followers_count=profile.get("followers", 0),
                    following_count=profile.get("following", 0),
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
                )
                db.add(acc_metric)
        except Exception as e:
             logger.error(f"Failed to save account metrics: {e}")
    
    # --- AUTO-HEAL: Bulk restore false positives ---
    # We previously marked posts as deleted if they weren't in the top ~15.
    # We now revert them all to 'sent' to fix the database state.
    healed_count = db.query(Post).filter(
        Post.username == username, 
        Post.status == "deleted_on_x"
    ).update({"status": "sent"})
    if healed_count > 0:
        logger.info(f"Restored {healed_count} posts from 'deleted_on_x' to 'sent' status.")
    
    count = 0
    for post_data in result["posts"]:
        # Check if already exists
        existing_post = db.query(Post).filter(Post.tweet_id == post_data["tweet_id"]).first()
        
        # Parse date
        pub_date = None
        if post_data.get("published_at"):
            try:
                # ISO string to datetime
                pub_date = datetime.fromisoformat(post_data["published_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            except:
                pass
        final_date = pub_date or datetime.now(timezone.utc).replace(tzinfo=None)

        if existing_post:
            # UPDATE existing
            if existing_post.status == "deleted_on_x":
                existing_post.status = "sent"
                existing_post.logs = (existing_post.logs or "") + "\n[Sync] Restored from deleted_on_x (Found in scan)"

            existing_post.views_count = post_data["views"]
            existing_post.likes_count = post_data["likes"]
            existing_post.reposts_count = post_data["reposts"]
            if post_data.get("media_url"):
                existing_post.media_url = post_data["media_url"]
            # Update repost status
            existing_post.is_repost = post_data.get("is_repost", False)
            
            # Fix dates if available (Corrección de fechas históricas)
            if pub_date:
                existing_post.updated_at = pub_date
                # For historical accuracy, we can align created_at too
                existing_post.created_at = pub_date

            # Also update content if it was empty before
            if post_data.get("content") and (not existing_post.content or existing_post.content == "(No content)"):
                existing_post.content = post_data["content"]
            
            count += 1 # Count updates as "imports" or activity
        else:
            # CREATE new
            new_post = Post(
                content=post_data["content"] or "(No content)",
                tweet_id=post_data["tweet_id"],
                username=username,
                status="sent",
                views_count=post_data["views"],
                likes_count=post_data["likes"],
                reposts_count=post_data["reposts"],
                updated_at=final_date,
                media_url=post_data.get("media_url"),
                is_repost=post_data.get("is_repost", False)
            )
            db.add(new_post)
            db.flush() # Get ID
            existing_post = new_post
            count += 1
            
        # Create metric snapshot (for both new and updated)
        # Check if recent snapshot exists to avoid duplicates
        latest_snap = db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == existing_post.id).order_by(PostMetricSnapshot.timestamp.desc()).first()
        
        # Simple debounce: only add snapshot if values changed or it's been > 6 hours (simplified)
        # For now, let's just add it if it's new data
        if not latest_snap or (latest_snap.views != post_data["views"] or latest_snap.likes != post_data["likes"]):
             snapshot = PostMetricSnapshot(
                post_id=existing_post.id,
                views=post_data["views"],
                likes=post_data["likes"],
                reposts=post_data["reposts"],
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None) # Snapshot time is NOW
            )
             db.add(snapshot)
            
    # --- Detection of Deleted Posts (DISABLED due to false positives) ---
    # Only if we have a valid scan range
    # oldest_scanned = result.get("oldest_scanned_date")
    # if oldest_scanned:
    #     try:
    #         min_date = datetime.fromisoformat(oldest_scanned)
    #         
    #         # Find posts that SHOULD have been in the feed
    #         # i.e., Sent posts, with tweet_id, belonging to user, newer than min_date
    #         # We use updated_at or created_at as proxy for "published_at" if not stored perfectly, 
    #         # but ideally we should store `published_at` in DB. 
    #         # For now, updated_at is usually setted to published time during sync.
    #         
    #         candidates = db.query(Post).filter(
    #             Post.username == username,
    #             Post.status == "sent",
    #             Post.tweet_id.isnot(None),
    #             Post.updated_at >= min_date
    #         ).all()
    #         
    #         scanned_ids = [p["tweet_id"] for p in result["posts"]]
    #         
    #         for candidate in candidates:
    #             if candidate.tweet_id not in scanned_ids:
    #                 logger.warning(f"Post {candidate.id} (Tweet {candidate.tweet_id}) missing from X feed. Marking as deleted_on_x.")
    #                 candidate.status = "deleted_on_x"
    #                 candidate.logs = (candidate.logs or "") + f"\n[Sync] Marked as deleted_on_x (Missing in scan > {min_date})"
    #                 count += 1 # Count as a sync change
    #                 
    #     except Exception as e:
    #         logger.error(f"Error detecting deleted posts: {e}")

    db.commit()
    
    # Debug screenshot logic removed
    
    return {
        "status": "success", 
        "imported": count, 
        "log": result["log"]
    }

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


