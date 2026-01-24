from sqlalchemy.orm import Session
from datetime import datetime, timezone
from loguru import logger
from fastapi import HTTPException
from backend.models import Post, PostMetricSnapshot, AccountMetricSnapshot
from worker.publisher import sync_history_task

async def sync_account_history(username: str, db: Session):
    """
    Orchestrates the sync process:
    1. Calls worker to scrape X.
    2. Updates Account Metrics (Followers).
    3. Auto-heals 'deleted_on_x' false positives.
    4. Upserts Posts and creates metric snapshots.
    """
    logger.info(f"Syncing history for {username}...")
    
    # 1. Call Worker
    try:
        result = await sync_history_task(username)
    except Exception as e:
        logger.error(f"Worker crashed during sync: {e}")
        raise HTTPException(status_code=500, detail=f"Worker error: {str(e)}")
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["log"])

    # 2. Save Profile Stats (Followers)
    if "profile" in result and result["profile"]:
        try:
            profile = result["profile"]
            # Only save if we got valid numbers
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
    
    # 3. Auto-Heal False Positives
    healed_count = db.query(Post).filter(
        Post.username == username, 
        Post.status == "deleted_on_x"
    ).update({"status": "sent"})
    if healed_count > 0:
        logger.info(f"Restored {healed_count} posts from 'deleted_on_x' to 'sent' status.")
    
    # 4. Upsert Posts
    count = 0
    for post_data in result["posts"]:
        existing_post = db.query(Post).filter(Post.tweet_id == post_data["tweet_id"]).first()
        
        # Parse date
        pub_date = None
        if post_data.get("published_at"):
            try:
                pub_date = datetime.fromisoformat(post_data["published_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            except:
                pass
        final_date = pub_date or datetime.now(timezone.utc).replace(tzinfo=None)

        if existing_post:
            # UPDATE
            if existing_post.status == "deleted_on_x":
                existing_post.status = "sent"
                existing_post.logs = (existing_post.logs or "") + "\n[Sync] Restored from deleted_on_x (Found in scan)"

            existing_post.views_count = post_data["views"]
            existing_post.likes_count = post_data["likes"]
            existing_post.reposts_count = post_data["reposts"]
            if post_data.get("media_url"):
                existing_post.media_url = post_data["media_url"]
            existing_post.is_repost = post_data.get("is_repost", False)
            
            if pub_date:
                existing_post.updated_at = pub_date
                existing_post.created_at = pub_date

            if post_data.get("content") and (not existing_post.content or existing_post.content == "(No content)"):
                existing_post.content = post_data["content"]
            
            count += 1 
        else:
            # CREATE
            new_post = Post(
                content=post_data["content"] or "(No content)",
                tweet_id=post_data["tweet_id"],
                username=username,
                status="sent",
                views_count=post_data["views"],
                likes_count=post_data["likes"],
                reposts_count=post_data["reposts"],
                updated_at=final_date,
                created_at=final_date, # Sync creation time too
                media_url=post_data.get("media_url"),
                is_repost=post_data.get("is_repost", False)
            )
            db.add(new_post)
            db.flush()
            existing_post = new_post
            count += 1
            
        # Create Snapshot
        latest_snap = db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == existing_post.id).order_by(PostMetricSnapshot.timestamp.desc()).first()
        
        if not latest_snap or (latest_snap.views != post_data["views"] or latest_snap.likes != post_data["likes"]):
             snapshot = PostMetricSnapshot(
                post_id=existing_post.id,
                views=post_data["views"],
                likes=post_data["likes"],
                reposts=post_data["reposts"],
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
            )
             db.add(snapshot)

    db.commit()
    
    return {
        "status": "success", 
        "imported": count, 
        "log": result["log"]
    }
