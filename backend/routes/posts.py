from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from backend.db import SessionLocal, get_db
from backend.models import Post
from loguru import logger
from backend.schemas import PostCreate, PostUpdate, PostResponse, GlobalStats
from worker.publisher import publish_post_task, import_single_tweet
from backend.schemas import PostCreate, PostUpdate, PostResponse, GlobalStats, ImportTweetRequest
import json

router = APIRouter()

async def run_immediate_publish(post_id: int):
    """
    Background task to publish a post immediately.
    """
    logger.info(f"Running immediate publish for post {post_id}")
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            return

        # Handle reply_to_id logic
        reply_to_id = None
        if post.parent_id:
            parent = db.query(Post).filter(Post.id == post.parent_id).first()
            if parent and parent.tweet_id:
                reply_to_id = parent.tweet_id

        # Publish
        result = await publish_post_task(
            post.content, 
            post.media_paths, 
            reply_to_id=reply_to_id, 
            username=post.username
        )

        # Update status
        post.status = "sent" if result.get("success") else "failed"
        post.logs = (post.logs or "") + f"\n[Immediate] " + (result.get("log") or "No log provided")
        post.screenshot_path = result.get("screenshot_path")
        if result.get("tweet_id"):
            post.tweet_id = result["tweet_id"]
            # Day 0 baseline snapshot
            from backend.models import PostMetricSnapshot
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
        logger.info(f"Immediate publish for post {post_id} finished. Status: {post.status}")
    except Exception as e:
        logger.error(f"Error in immediate publish for post {post_id}: {e}")
    finally:
        db.close()

@router.get("/stats", response_model=GlobalStats)
def get_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    total_sent = db.query(Post).filter(Post.status == "sent", Post.is_repost.isnot(True)).count()
    total_failed = db.query(Post).filter(Post.status == "failed").count()
    total_scheduled = db.query(Post).filter(Post.status == "scheduled").count()
    total_drafts = db.query(Post).filter(Post.status == "draft").count()
    
    # Aggregated metrics for sent posts (Excluding reposts)
    metrics = db.query(
        func.sum(Post.views_count).label("views"),
        func.sum(Post.likes_count).label("likes"),
        func.sum(Post.reposts_count).label("reposts")
    ).filter(Post.status == "sent", Post.is_repost.isnot(True)).first()
    
    return {
        "sent": total_sent,
        "failed": total_failed,
        "scheduled": total_scheduled,
        "drafts": total_drafts,
        "views": int(metrics.views or 0),
        "likes": int(metrics.likes or 0),
        "reposts": int(metrics.reposts or 0)
    }

# CRUD Routes
@router.post("/", response_model=PostResponse)
def create_post(post: PostCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    logger.info(f"Creating new post for user: {post.username}")
    
    is_immediate = post.status == "immediate"
    post_data = post.model_dump()
    
    if is_immediate:
        post_data["status"] = "processing"
        # Immediate posts don't need a scheduled_at, but we can keep it as now
        post_data["scheduled_at"] = datetime.now(timezone.utc).replace(tzinfo=None)
    
    db_post = Post(**post_data)
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    
    if is_immediate:
        background_tasks.add_task(run_immediate_publish, db_post.id)
        
    return db_post

@router.post("/import", response_model=PostResponse)
async def import_tweet(request: ImportTweetRequest, db: Session = Depends(get_db)):
    """
    Import a tweet by URL.
    """
    logger.info(f"Importing tweet from {request.url} for user {request.username}")
    
    # 1. Run the worker task synchronously (or async await) to get data
    result = await import_single_tweet(request.url, request.username)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=f"Import failed: {result.get('log')}")
    
    tweet_data = result.get("tweet")
    if not tweet_data:
         raise HTTPException(status_code=404, detail="Tweet data not found in result.")

    # 2. Upsert logic
    tweet_id = tweet_data['tweet_id']
    existing_post = db.query(Post).filter(Post.tweet_id == tweet_id).first()
    
    # Default values for fields not in scraped data or differently named
    post_data = {
        "content": tweet_data.get("content") or "(No content)",
        "media_paths": json.dumps([tweet_data.get("media_url")]) if tweet_data.get("media_url") else None,
        "status": "sent",
        "username": request.username,
        "is_repost": tweet_data.get("is_repost", False),
        "tweet_id": tweet_id,
        "views_count": tweet_data.get("views", 0),
        "likes_count": tweet_data.get("likes", 0),
        "reposts_count": tweet_data.get("reposts", 0),
        "replies_count": tweet_data.get("replies", 0),
        "bookmarks_count": tweet_data.get("bookmarks", 0),
        "url_link_clicks": tweet_data.get("url_link_clicks", 0),
        "user_profile_clicks": tweet_data.get("user_profile_clicks", 0),
        "detail_expands": tweet_data.get("detail_expands", 0),
        # Use published_at for created_at if available
        "created_at": datetime.fromisoformat(tweet_data["published_at"].replace("Z", "+00:00")).replace(tzinfo=None) if tweet_data.get("published_at") else datetime.now(),
        "updated_at": datetime.now()
    }

    if existing_post:
        # Update
        for key, value in post_data.items():
            if key != "created_at": # Don't overwrite creation date on update usually, but maybe for sync?
                setattr(existing_post, key, value)
        db_post = existing_post
    else:
        # Create
        db_post = Post(**post_data)
        db.add(db_post)
    
    db.commit()
    db.refresh(db_post)
    
    return db_post

@router.get("/latest", response_model=PostResponse)
def read_latest_post(db: Session = Depends(get_db)):
    logger.info("Fetching latest sent post")
    # Order by created_at (which reflects publish date) instead of updated_at (which changes on sync)
    # Also exclude reposts to show USER's last post
    post = db.query(Post).filter(
        Post.status == "sent", 
        Post.is_repost.isnot(True)
    ).order_by(Post.created_at.desc()).first()
    
    if post is None:
        raise HTTPException(status_code=404, detail="No sent posts found")
    return post

@router.get("/", response_model=List[PostResponse])
def read_posts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    posts = db.query(Post).order_by(Post.id.desc()).offset(skip).limit(limit).all()
    return posts

@router.get("/{post_id}", response_model=PostResponse)
def read_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

@router.put("/{post_id}", response_model=PostResponse)
def update_post(post_id: int, post: PostUpdate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if db_post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    
    is_immediate = post.status == "immediate"
    update_data = post.model_dump(exclude_unset=True)
    
    if is_immediate:
        update_data["status"] = "processing"
        update_data["scheduled_at"] = datetime.now(timezone.utc).replace(tzinfo=None)
    
    for key, value in update_data.items():
        setattr(db_post, key, value)
    
    db.commit()
    db.refresh(db_post)
    
    if is_immediate:
        background_tasks.add_task(run_immediate_publish, db_post.id)
        
    return db_post



@router.delete("/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db)):
    logger.info(f"Deleting post {post_id}")
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if db_post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    
    db.delete(db_post)
    db.commit()
    return {"ok": True}
