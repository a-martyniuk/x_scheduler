from sqlalchemy.orm import Session
from datetime import datetime, timezone
from loguru import logger
from fastapi import HTTPException
from backend.models import Post, PostMetricSnapshot, AccountMetricSnapshot
from worker.publisher import sync_history_task
from backend.schemas import ScrapedTweet

async def sync_account_history(username: str, db: Session):
    """
    Orchestrates the sync process:
    1. Calls worker to scrape X.
    2. Updates Account Metrics (Followers).
    3. Auto-heals 'deleted_on_x' false positives.
    4. Upserts Posts and creates metric snapshots.
    """
    logger.info(f"Syncing history for {username}...")
    
    # 0. One-time Cleanup: Removed (Legacy)

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
            # Save snapshot regardless of count to record the sync timestamp
            acc_metric = AccountMetricSnapshot(
                username=username,
                followers_count=profile.get("followers", 0),
                following_count=profile.get("following", 0),
                timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
            )
            db.add(acc_metric)
        except Exception as e:
             logger.error(f"Failed to save account metrics: {e}")
    
    # 3. Detect Deletions (Reverse Sync)
    # If a post was 'sent' in our DB, has a tweet_id, and is older than the oldest scanned date,
    # but wasn't found in current 'result["posts"]', it might be deleted.
    if "oldest_scanned_date" in result and result["oldest_scanned_date"]:
        try:
            oldest_date = datetime.fromisoformat(result["oldest_scanned_date"]).replace(tzinfo=None)
            
            # Find all 'sent' posts that should have been in the scanned range
            scanned_tweet_ids = {p["tweet_id"] for p in result["posts"]}
            
            # We only check posts that are NEWER than the oldest scanned date.
            # If a post is newer than oldest_date but NOT in scanned_tweet_ids, it was deleted.
            # EXCEPTION: Do not mark Reposts as deleted, as they are often elusive in scrapes.
            orphans = db.query(Post).filter(
                Post.username == username,
                Post.status == "sent",
                Post.tweet_id.isnot(None),
                Post.created_at >= oldest_date,
                Post.is_repost.is_(False) # Ignore known reposts from deletion check
            ).all()
            
            deleted_count = 0
            for post in orphans:
                if post.tweet_id not in scanned_tweet_ids:
                    logger.warning(f"Post {post.id} (tweet_id: {post.tweet_id}) not found in X scan. Marking as deleted.")
                    post.status = "deleted_on_x"
                    post.logs = (post.logs or "") + f"\n[Sync] {datetime.now().isoformat()} - Post not found on X profile. Marked as deleted."
                    deleted_count += 1
            
            if deleted_count > 0:
                logger.info(f"Marked {deleted_count} posts as deleted_on_x.")
        except Exception as e:
            logger.error(f"Failed during deletion detection: {e}")

    # 4. Auto-Heal False Positives
    healed_count = db.query(Post).filter(
        Post.username == username, 
        Post.status == "deleted_on_x"
    ).update({"status": "sent"})
    if healed_count > 0:
        logger.info(f"Restored {healed_count} posts from 'deleted_on_x' to 'sent' status.")
    
    # 5. Upsert Posts
    # POLICY: Exclude Reposts entirely to keep analytics clean.

    scraped_ids = set()
    count = 0 
    
    for raw_data in result["posts"]:
        # 1. STRICT TYPING VALIDATION
        try:
            post_data = ScrapedTweet(**raw_data).model_dump()
        except Exception as e:
            logger.warning(f"Sync: Skipping invalid data item: {e}")
            continue

        tweet_id = post_data["tweet_id"]
        scraped_ids.add(tweet_id)

        # 2. QUARANTINE LOGIC
        # Instead of skipping, we determine if it's 'suspicious'
        is_empty = (not post_data.get("content") or post_data["content"].strip() == "") and not post_data.get("media_url")
        is_repost_flag = post_data.get("is_repost", False)
        
        # If it's a known repost, we still skip it entirely (Clean Policy)
        if is_repost_flag:
            continue

        # Determine date
        pub_date = None
        date_error = None
        try:
            dt_str = post_data.get("created_at") or post_data.get("published_at")
            if dt_str:
                pub_date = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception as e:
            logger.error(f"Error parsing date {dt_str}: {e}")
            date_error = str(e)

        # Fallback date used ONLY for creation if pub_date is missing
        final_date = pub_date or datetime.now(timezone.utc).replace(tzinfo=None)
        
        # QUARANTINE DECISION
        # If it's empty OR has a date error, it goes to quarantine
        is_quarantined = is_empty or (pub_date is None)
        quarantine_reason = ""
        if is_empty: quarantine_reason += "[Empty Content] "
        if pub_date is None: quarantine_reason += "[Missing Date] "

        # Use tweet_id for identification
        existing_post = db.query(Post).filter(Post.tweet_id == tweet_id).first()
        
        if existing_post:
            # UPDATE existing record
            if existing_post.status == "deleted_on_x":
                existing_post.status = "sent"
                existing_post.logs = (existing_post.logs or "") + "\n[Sync] Restored from deleted_on_x"

            # Use quarantine status if applicable, otherwise keep existing valid status
            if is_quarantined:
                existing_post.status = "quarantine"
                existing_post.logs = (existing_post.logs or "") + f"\n[Sync] Quarantined: {quarantine_reason}"
            
            # Update real-time metrics
            existing_post.views_count = post_data["views"]
            existing_post.likes_count = post_data["likes"]
            existing_post.reposts_count = post_data["reposts"]
            existing_post.bookmarks_count = post_data.get("bookmarks", 0)
            existing_post.replies_count = post_data.get("replies", 0)
            existing_post.url_link_clicks = post_data.get("url_link_clicks", 0)
            existing_post.user_profile_clicks = post_data.get("user_profile_clicks",0)
            existing_post.detail_expands = post_data.get("detail_expands", 0)

            if post_data.get("media_url"):
                existing_post.media_url = post_data["media_url"]
            
            if pub_date:
                existing_post.created_at = pub_date
                existing_post.updated_at = pub_date 

            if post_data.get("content") and (not existing_post.content or existing_post.content == "(No content)"):
                existing_post.content = post_data["content"]
            
            # Update Snapshot for existing
            try:
                latest_snap = db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == existing_post.id).order_by(PostMetricSnapshot.timestamp.desc()).first()
                
                has_changes = not latest_snap or (
                    latest_snap.views != post_data["views"] or 
                    latest_snap.likes != post_data["likes"] or 
                    latest_snap.reposts != post_data["reposts"] or
                    latest_snap.bookmarks != post_data.get("bookmarks", 0) or
                    latest_snap.replies != post_data.get("replies", 0) or
                    latest_snap.url_link_clicks != post_data.get("url_link_clicks", 0) or
                    latest_snap.user_profile_clicks != post_data.get("user_profile_clicks", 0) or
                    latest_snap.detail_expands != post_data.get("detail_expands", 0)
                )

                if has_changes:
                        snapshot = PostMetricSnapshot(
                        post_id=existing_post.id,
                        views=post_data["views"],
                        likes=post_data["likes"],
                        reposts=post_data["reposts"],
                        bookmarks=post_data.get("bookmarks", 0),
                        replies=post_data.get("replies", 0),
                        url_link_clicks=post_data.get("url_link_clicks", 0),
                        user_profile_clicks=post_data.get("user_profile_clicks", 0),
                        detail_expands=post_data.get("detail_expands", 0),
                        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
                    )
                        db.add(snapshot)
            except Exception as e:
                logger.error(f"Sync: Snapshot error existing: {e}")

            count += 1 
        else:
            # CREATE new record
            if not pub_date:
                    logger.warning(f"Sync: Creating QUARANTINED post {post_data['tweet_id']} (No Date).")
            
            new_status = "quarantine" if is_quarantined else "sent"
            initial_logs = f"[Sync] Created in Quarantine: {quarantine_reason}" if is_quarantined else None

            new_post = Post(
                tweet_id=tweet_id,
                content=post_data["content"] or "(No content)",
                media_url=post_data.get("media_url"),
                created_at=final_date,
                updated_at=final_date,
                status=new_status,
                username=username,
                views_count=post_data["views"],
                likes_count=post_data["likes"],
                reposts_count=post_data["reposts"],
                bookmarks_count=post_data.get("bookmarks", 0),
                replies_count=post_data.get("replies", 0),
                url_link_clicks=post_data.get("url_link_clicks", 0),
                user_profile_clicks=post_data.get("user_profile_clicks", 0),
                detail_expands=post_data.get("detail_expands", 0),
                is_repost=False,
                logs=initial_logs
            )
            db.add(new_post)
            try:
                db.flush()
                # Create Day 0 snapshot for new post
                snap = PostMetricSnapshot(
                    post_id=new_post.id,
                    views=new_post.views_count,
                    likes=new_post.likes_count,
                    reposts=new_post.reposts_count,
                    bookmarks=new_post.bookmarks_count,
                    replies=new_post.replies_count,
                    url_link_clicks=new_post.url_link_clicks,
                    user_profile_clicks=new_post.user_profile_clicks,
                    detail_expands=new_post.detail_expands,
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
                )
                db.add(snap)
                count += 1
            except Exception as e:
                logger.error(f"Sync: Failed to flush post {tweet_id}: {e}")
                db.rollback()
                continue

    try:
        db.commit()
        logger.info(f"Sync: Successfully committed {count} posts to DB.")
    except Exception as e:
        logger.error(f"Sync: CRITICAL DB COMMIT FAILED: {e}")
        db.rollback()
    
    return {
        "status": "success", 
        "imported": count, 
        "log": result["log"]
    }
