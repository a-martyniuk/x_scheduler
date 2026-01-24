from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from backend.db import get_db
from backend.models import Post, PostMetricSnapshot, AccountMetricSnapshot
from typing import List, Dict

router = APIRouter()

@router.get("/growth")
def get_growth_data(db: Session = Depends(get_db)):
    """
    Returns aggregated engagement data over the last 30 days based on Post publication date.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(days=30)
    
    # Query Posts directly to reconstruct history
    # We use updated_at because that's where we store the legacy publish date
    stats = db.query(
        func.date(Post.updated_at).label('date'),
        func.sum(Post.views_count).label('views'),
        func.sum(Post.likes_count).label('likes'),
        func.sum(Post.reposts_count).label('reposts'),
        func.sum(Post.bookmarks_count).label('bookmarks'),
        func.sum(Post.replies_count).label('replies'),
        func.count(Post.id).label('post_count')
    ).filter(
        Post.status == 'sent',
        Post.updated_at >= cutoff,
        Post.is_repost.isnot(True) # Exclude reposts from growth chart too
    )\
     .group_by(func.date(Post.updated_at))\
     .order_by(func.date(Post.updated_at)).all()
    
    return [
        {
            "date": str(s.date),
            "views": s.views or 0,
            "likes": s.likes or 0,
            "reposts": s.reposts or 0,
            "bookmarks": s.bookmarks or 0,
            "replies": s.replies or 0,
            "engagement": (s.likes or 0) + (s.reposts or 0) + (s.bookmarks or 0) + (s.replies or 0),
            "posts": s.post_count
        } for s in stats
    ]

@router.get("/performance")
def get_performance_data(db: Session = Depends(get_db)):
    """
    Compares performance between Text-only and Media posts.
    """
    sent_posts = db.query(Post).filter(Post.status == "sent", Post.is_repost.isnot(True)).all()
    
    performance = {
        "text": {"count": 0, "views": 0, "engagement": 0},
        "media": {"count": 0, "views": 0, "engagement": 0}
    }
    
    for post in sent_posts:
        # Check both local media paths AND imported media URLs
        has_media = bool(post.media_paths) or bool(post.media_url)
        type_key = "media" if has_media else "text"
        
        performance[type_key]["count"] += 1
        performance[type_key]["views"] += (post.views_count or 0)
        performance[type_key]["engagement"] += ((post.likes_count or 0) + (post.reposts_count or 0))
    
    # Calculate averages
    for key in performance:
        if performance[key]["count"] > 0:
            performance[key]["avg_engagement"] = performance[key]["engagement"] / performance[key]["count"]
            performance[key]["engagement_rate"] = (performance[key]["engagement"] / performance[key]["views"] * 100) if performance[key]["views"] > 0 else 0
        else:
            performance[key]["avg_engagement"] = 0
            performance[key]["engagement_rate"] = 0
            
    return performance

@router.get("/best-times")
def get_best_times(db: Session = Depends(get_db)):
    """
    Calculates the best hours to post based on historical performance.
    """
    # Group 'sent' posts by hour and calculate average engagement
    posts = db.query(Post).filter(Post.status == "sent").all()
    
    if not posts:
        return {"best_hours": [9, 12, 18, 21], "reason": "Default slots (not enough data yet)"}
    
    hourly_engagement = {}
    for post in posts:
        # Use scheduled_at, or updated_at (for imported posts), or created_at
        timestamp = post.scheduled_at or post.updated_at or post.created_at
        if timestamp:
            hour = timestamp.hour
            # Simple engagement formula: (likes + RT) / views * 1000 (to avoid small floats)
            engagement = (post.likes_count + post.reposts_count)
            if post.views_count > 0:
                 engagement = (engagement / post.views_count) * 100
            
            if hour not in hourly_engagement:
                hourly_engagement[hour] = []
            hourly_engagement[hour].append(engagement)
    
    # Average engagement per hour
    avg_engagement = {h: sum(e)/len(e) for h, e in hourly_engagement.items()}
    # Sort by engagement
    sorted_hours = sorted(avg_engagement.items(), key=lambda x: x[1], reverse=True)
    
    best_slots = [h for h, e in sorted_hours[:4]]
    
    return {
        "best_hours": best_slots if best_slots else [9, 12, 18, 21],
        "hourly_data": avg_engagement,
        "total_posts_analyzed": len(posts)
    }

@router.get("/account-growth")
def get_account_growth(db: Session = Depends(get_db)):
    """
    Returns follower count history aggregated by day (taking the latest snapshot of each day).
    """
    # Get all snapshots ordered by date
    snapshots = db.query(
        AccountMetricSnapshot.timestamp,
        AccountMetricSnapshot.followers_count,
        AccountMetricSnapshot.following_count
    ).order_by(AccountMetricSnapshot.timestamp).all()
    
    # Aggregate by day in Python
    daily_stats = {}
    for s in snapshots:
        # Key by date (YYYY-MM-DD)
        date_key = s.timestamp.strftime("%Y-%m-%d")
        # Since we iterate ordered by timestamp, this effectively keeps the latest for each day
        daily_stats[date_key] = {
            "date": s.timestamp.isoformat(), # Keep full timestamp of the specific snapshot
            "followers": s.followers_count,
            "following": s.following_count
        }
        
    return list(daily_stats.values())
