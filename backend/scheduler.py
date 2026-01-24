from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from backend.db import SessionLocal
from backend.models import Post, PostMetricSnapshot
from worker.publisher import publish_post_task, scrape_stats_task
import asyncio
from loguru import logger

scheduler = AsyncIOScheduler()

async def check_scheduled_posts():
    """
    Checks DB for posts that are 'scheduled' and past their scheduled_at time.
    Triggers publication.
    """
    logger.info(f"Checking for due posts at {datetime.now()}...")
    db: Session = SessionLocal()
    try:
        now = datetime.now(timezone.utc)
        # Fetch scheduled posts OR failed posts with retry_count < 3 (with 10min delay between retries)
        due_posts = db.query(Post).filter(
            (Post.status == "scheduled") & (Post.scheduled_at <= now.replace(tzinfo=None)) |
            (Post.status == "failed") & (Post.retry_count < 3) & (Post.updated_at <= now.replace(tzinfo=None) - timedelta(minutes=10)) |
            (Post.status == "processing") & (Post.updated_at <= now.replace(tzinfo=None) - timedelta(minutes=10))
        ).all()

        for post in due_posts:
            logger.info(f"Triggering post {post.id} (Retry: {post.retry_count})...")
            
            # Increment retry count if it was a failure
            if post.status == "failed":
                post.retry_count += 1
            
            post.status = "processing"
            db.commit()

            # Check for Parent Post (Threading)
            reply_to_id = None
            if post.parent_id:
                parent_post = db.query(Post).filter(Post.id == post.parent_id).first()
                if parent_post:
                    if parent_post.tweet_id:
                        reply_to_id = parent_post.tweet_id
                    elif parent_post.status == 'sent':
                         # Parent sent but no ID? Can't reply properly.
                         logger.warning(f"Parent {parent_post.id} sent but has no tweet_id. Posting as standalone.")
                    else:
                        logger.info(f"Parent {parent_post.id} not yet ready (Status: {parent_post.status}). Skipping child {post.id} for now.")
                        continue # Skip this cycle, wait for parent
                else:
                    logger.info(f"Parent {post.parent_id} not found. Posting as standalone.")

            # Trigger worker with a total task timeout
            try:
                logger.debug(f"Running publish_post_task for {post.id}...")
                # We wrap the await in a wait_for to be 100% sure it doesn't hang the scheduler thread
                result = await asyncio.wait_for(
                    publish_post_task(post.content, post.media_paths, reply_to_id=reply_to_id, username=post.username),
                    timeout=120.0 # 2 minute max
                )
            except asyncio.TimeoutError:
                logger.error(f"Task for post {post.id} TIMED OUT after 2 mins.")
                result = {"success": False, "log": "Scheduler Timeout: Task took too long (>2 mins)"}
            except Exception as e:
                logger.exception(f"Task for post {post.id} CRASHED: {e}")
                result = {"success": False, "log": f"Scheduler Error: {e}"}
            
            # Update result
            post.status = "sent" if result.get("success") else "failed"
            post.logs = (post.logs or "") + f"\n[Retry {post.retry_count}] " + (result.get("log") or "No log provided")
            post.screenshot_path = result.get("screenshot_path")
            if result.get("tweet_id"):
                post.tweet_id = result["tweet_id"]
                # Day 0 baseline snapshot
                snapshot = PostMetricSnapshot(
                    post_id=post.id,
                    views=0,
                    likes=0,
                    reposts=0,
                    timestamp=datetime.now(timezone.utc).replace(tzinfo=None)
                )
                db.add(snapshot)
                
            post.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            db.commit()
            logger.info(f"Post {post.id} processed. Status: {post.status}. ID: {post.tweet_id}")

    except Exception as e:
        logger.exception(f"Scheduler Loop Error: {e}")
    finally:
        db.close()


async def update_analytics():
    """
    Updates stats for posts sent in the last 48 hours.
    """
    logger.info("Running Analytics Update...")
    db: Session = SessionLocal()
    try:
        # Check posts sent recently (e.g. last 48 hours) that have a tweet_id
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        cutoff = now_naive - timedelta(hours=48)
        recent_posts = db.query(Post).filter(
            (Post.status == "sent") & 
            (Post.tweet_id.isnot(None)) & 
            (Post.updated_at >= cutoff)
        ).all()

        for post in recent_posts:
            logger.debug(f"Scraping stats for Post {post.id} ({post.tweet_id})...")
            result = await scrape_stats_task(post.tweet_id, username=post.username)
            if result["success"]:
                stats = result["stats"]
                post.views_count = stats.get("views", 0)
                post.likes_count = stats.get("likes", 0)
                post.reposts_count = stats.get("reposts", 0)
                post.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                post.logs = (post.logs or "") + f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Scraper Success: Views={stats.get('views')}, Likes={stats.get('likes')}"
                
                # Crear Snapshot histórico
                snapshot = PostMetricSnapshot(
                    post_id=post.id,
                    views=post.views_count,
                    likes=post.likes_count,
                    reposts=post.reposts_count
                )
                db.add(snapshot)
                
                db.commit()
                logger.info(f"Updated Post {post.id}: {stats}")
            else:
                logger.warning(f"Failed to scrape Post {post.id}: {result['log']}")
                post.logs = (post.logs or "") + f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Scraper Failed: {result['log']}"
                db.commit()
            
            # Gentle delay between scrapes
            await asyncio.sleep(10) 

    except Exception as e:
        logger.exception(f"Analytics Update Loop Error: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(check_scheduled_posts, "interval", minutes=1)
    # Run analytics every 15 minutes for higher resolution tracking
    scheduler.add_job(update_analytics, "interval", minutes=15)
    
    # Run full history sync every 6 hours to catch up with external changes
    scheduler.add_job(sync_history_job, "interval", hours=6)
    
    scheduler.start()

async def sync_history_job():
    """
    Periodically syncs history for all connected accounts.
    """
    logger.info("Running Periodic History Sync...")
    from backend.services.sync_service import sync_account_history
    import os
    import json
    
    db: Session = SessionLocal()
    try:
        # Discover accounts from file system (similar to get_status)
        worker_dir = os.path.join(os.path.dirname(__file__), "..", "worker")
        accounts_dir = os.path.join(worker_dir, "accounts")
        
        usernames = []
        
        # 1. File based accounts
        if os.path.exists(accounts_dir):
            for username in os.listdir(accounts_dir):
                user_info_path = os.path.join(accounts_dir, username, "user_info.json")
                if os.path.exists(user_info_path):
                    usernames.append(username)

        # 2. Env var account
        env_username = os.environ.get('X_USERNAME')
        if env_username and env_username not in usernames:
             usernames.append(env_username)

        for username in usernames:
            logger.info(f"Auto-Syncing {username}...")
            try:
                await sync_account_history(username, db)
            except Exception as e:
                logger.error(f"Auto-Sync failed for {username}: {e}")
            
            # Sleep between accounts
            await asyncio.sleep(30)

    except Exception as e:
        logger.exception(f"History Sync Loop Error: {e}")
    finally:
        db.close()
