from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from ..db import get_db
from ..models import Post, PostMetricSnapshot
from typing import List, Dict

router = APIRouter()

@router.get("/growth")
def get_growth_data(db: Session = Depends(get_db)):
    """
    Returns aggregated engagement data over the last 7 days for the wave chart.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now - timedelta(days=7)
    
    # Query snapshots in the last 7 days
    snapshots = db.query(
        func.date(PostMetricSnapshot.timestamp).label('date'),
        func.sum(PostMetricSnapshot.views).label('views'),
        func.sum(PostMetricSnapshot.likes).label('likes'),
        func.sum(PostMetricSnapshot.reposts).label('reposts')
    ).filter(PostMetricSnapshot.timestamp >= cutoff)\
     .group_by(func.date(PostMetricSnapshot.timestamp))\
     .order_by(func.date(PostMetricSnapshot.timestamp)).all()
    
    return [
        {
            "date": str(s.date),
            "views": s.views,
            "likes": s.likes,
            "reposts": s.reposts,
            "engagement": s.likes + s.reposts
        } for s in snapshots
    ]

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
        if post.scheduled_at:
            hour = post.scheduled_at.hour
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
