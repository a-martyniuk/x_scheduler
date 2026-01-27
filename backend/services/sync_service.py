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
    
    # 0. One-time Cleanup of Instagram Orphans (to handle the cloud DB)
    try:
        query = db.query(Post).filter(Post.content.like("%New Story Update!%"))
        ig_posts = query.all()
        if ig_posts:
            logger.info(f"Cleanup: Found {len(ig_posts)} orphaned Instagram posts in cloud DB. Purging...")
            for post in ig_posts:
                db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == post.id).delete()
                db.delete(post)
            db.commit()
            logger.info("Instagram cleanup successful.")
    except Exception as e:
        logger.error(f"One-time cleanup failed: {e}")
        db.rollback()

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
    # Also exclude Blacklisted IDs (Manual cleanup for edge cases)
    BLACKLIST_IDS = {
        "2007387117551530408", # No content / Ghost (Fixed ID)
        "1995428955218985118", # No content / Ghost
        "2007404288633712869", # "Amé" (Short reply/quote)
        "2007355606886798455", # "Toda latinoamerica..." (Persistent Quote Tweet)
        "2007929193334738952", # "Domingo en el gym..."
        "2007327615070392726", # "PENTAGON PIZZA..."
    }
    
    # --- PHASE 0: PRE-SYNC CLEANUP (Force Delete Blacklisted IDs) ---
    # Delete them blindly from DB to ensure they are gone regardless of scrape results
    existing_blacklist = db.query(Post).filter(Post.tweet_id.in_(BLACKLIST_IDS)).all()
    if existing_blacklist:
        for bl_post in existing_blacklist:
            logger.info(f"Sync: Force-Deleting blacklisted post {bl_post.tweet_id} from DB.")
            db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == bl_post.id).delete()
            db.delete(bl_post)
        db.commit() # Commit immediately to ensure clear state

    scraped_ids = set()
    count = 0 
    
    for post_data in result["posts"]:
        tweet_id = str(post_data["tweet_id"])
        scraped_ids.add(tweet_id)

        # Check blacklist or empty policy for INCOMING data to prevent re-insertion
        is_blacklisted = tweet_id in BLACKLIST_IDS
        is_empty = (not post_data.get("content") or post_data["content"].strip() == "") and not post_data.get("media_url")
        is_repost_flag = post_data.get("is_repost", False)

        if is_blacklisted:
            logger.info(f"Sync: Skipping blacklisted post {tweet_id}")
            continue
        
        if is_repost_flag:
            logger.info(f"Sync: Skipping repost {tweet_id}")
            continue

        if is_empty:
            logger.info(f"Sync: Skipping empty post {tweet_id}")
            continue

        # Determine date
        pub_date = None
        try:
            dt_str = post_data.get("created_at") or post_data.get("published_at")
            if dt_str:
                pub_date = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception as e:
            logger.error(f"Error parsing date {dt_str}: {e}")

        # Fallback date used ONLY for creation if pub_date is missing
        final_date = pub_date or datetime.now(timezone.utc).replace(tzinfo=None)

        # Use tweet_id for identification
        existing_post = db.query(Post).filter(Post.tweet_id == tweet_id).first()
        
        # Additional cleanup: If we find a repost/empty that somehow exists, kill it
        if existing_post and (is_repost_flag or is_empty):
            logger.info(f"Sync: Removing invalid existing post {existing_post.id}")
            db.delete(existing_post)
            db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == existing_post.id).delete()
            continue

        if existing_post:
            # UPDATE existing record
            if existing_post.is_repost: 
                # Double check: if DB thinks it's a repost, purge it.
                logger.info(f"Sync: Purging legacy repost {existing_post.id}")
                db.delete(existing_post)
                db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == existing_post.id).delete()
                continue

            if existing_post.status == "deleted_on_x":
                existing_post.status = "sent"
                existing_post.logs = (existing_post.logs or "") + "\n[Sync] Restored from deleted_on_x (Found in scan)"
            
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
            
            # CRITICAL: Always overwrite dates if worker provided a VALID pub_date from Snowflake
            if pub_date:
                existing_post.created_at = pub_date
                existing_post.updated_at = pub_date 
            else:
                pass # Keep existing date

            if post_data.get("content") and (not existing_post.content or existing_post.content == "(No content)"):
                existing_post.content = post_data["content"]
            
            # Update Snapshot for existing
            try:
                latest_snap = db.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == existing_post.id).order_by(PostMetricSnapshot.timestamp.desc()).first()
                
                has_changes = not latest_snap or (
                    latest_snap.views_count != post_data["views"] or 
                    latest_snap.likes_count != post_data["likes"] or 
                    latest_snap.reposts_count != post_data["reposts"] or
                    latest_snap.bookmarks_count != post_data.get("bookmarks", 0) or
                    latest_snap.replies_count != post_data.get("replies", 0)
                )

                if has_changes:
                        snapshot = PostMetricSnapshot(
                        post_id=existing_post.id,
                        views_count=post_data["views"],
                        likes_count=post_data["likes"],
                        reposts_count=post_data["reposts"],
                        bookmarks_count=post_data.get("bookmarks", 0),
                        replies_count=post_data.get("replies", 0),
                        timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
                    )
                        db.add(snapshot)
            except Exception as e:
                logger.error(f"Sync: Snapshot error existing: {e}")

            count += 1 
        else:
            # CREATE new record
            if not pub_date:
                    logger.error(f"Sync: Creating NEW post {post_data['tweet_id']} without a valid date. Defaulting to now.")

            new_post = Post(
                tweet_id=tweet_id,
                content=post_data["content"] or "(No content)",
                media_url=post_data.get("media_url"),
                created_at=final_date,
                updated_at=final_date,
                status="sent",
                username=username,
                views_count=post_data["views"],
                likes_count=post_data["likes"],
                reposts_count=post_data["reposts"],
                bookmarks_count=post_data.get("bookmarks", 0),
                replies_count=post_data.get("replies", 0),
                url_link_clicks=post_data.get("url_link_clicks", 0),
                user_profile_clicks=post_data.get("user_profile_clicks", 0),
                detail_expands=post_data.get("detail_expands", 0),
                is_repost=False
            )
            db.add(new_post)
            try:
                db.flush()
                # Create Day 0 snapshot for new post
                snap = PostMetricSnapshot(
                    post_id=new_post.id,
                    views_count=new_post.views_count,
                    likes_count=new_post.likes_count,
                    reposts_count=new_post.reposts_count,
                    bookmarks_count=new_post.bookmarks_count,
                    replies_count=new_post.replies_count,
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
