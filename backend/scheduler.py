from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from datetime import datetime
from .db import SessionLocal
from .models import Post
from worker.publisher import publish_post_task, scrape_stats_task
import asyncio
from datetime import datetime, timedelta
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
        now = datetime.utcnow()
        # Fetch scheduled posts OR failed posts with retry_count < 3
        # Note: In a real app we'd add a delay between retries. Here we just retry next cycle (1 min).
        due_posts = db.query(Post).filter(
            (Post.status == "scheduled") & (Post.scheduled_at <= now) |
            (Post.status == "failed") & (Post.retry_count < 3) |
            (Post.status == "processing") & (Post.updated_at <= now - timedelta(minutes=10))
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
                
            post.updated_at = datetime.utcnow()
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
        cutoff = datetime.utcnow() - timedelta(hours=48)
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
                post.updated_at = datetime.utcnow()
                db.commit()
                logger.info(f"Updated Post {post.id}: {stats}")
            else:
                logger.warning(f"Failed to scrape Post {post.id}: {result['log']}")
            
            # Gentle delay between scrapes
            await asyncio.sleep(10) 

    except Exception as e:
        logger.exception(f"Analytics Update Loop Error: {e}")
    finally:
        db.close()

def start_scheduler():
    scheduler.add_job(check_scheduled_posts, "interval", minutes=1)
    # Run analytics every hour
    scheduler.add_job(update_analytics, "interval", minutes=60)
    scheduler.start()
