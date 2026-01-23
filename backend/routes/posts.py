from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..db import get_db
from ..models import Post
from loguru import logger
from ..schemas import PostCreate, PostUpdate, PostResponse, GlobalStats

router = APIRouter()

# CRUD Routes
@router.post("/", response_model=PostResponse)
def create_post(post: PostCreate, db: Session = Depends(get_db)):
    logger.info(f"Creating new post for user: {post.username}")
    db_post = Post(**post.model_dump())
    db.add(db_post)
    db.commit()
    db.refresh(db_post)
    return db_post

@router.get("/", response_model=List[PostResponse])
def read_posts(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    posts = db.query(Post).offset(skip).limit(limit).all()
    return posts

@router.get("/{post_id}", response_model=PostResponse)
def read_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    return post

@router.put("/{post_id}", response_model=PostResponse)
def update_post(post_id: int, post: PostUpdate, db: Session = Depends(get_db)):
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if db_post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    
    for key, value in post.model_dump(exclude_unset=True).items():
        setattr(db_post, key, value)
    
    db.commit()
    db.refresh(db_post)
    return db_post

@router.get("/stats", response_model=GlobalStats)
def get_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    
    total_sent = db.query(Post).filter(Post.status == "sent").count()
    total_failed = db.query(Post).filter(Post.status == "failed").count()
    total_scheduled = db.query(Post).filter(Post.status == "scheduled").count()
    total_drafts = db.query(Post).filter(Post.status == "draft").count()
    
    # Aggregated metrics for sent posts
    metrics = db.query(
        func.sum(Post.views_count).label("views"),
        func.sum(Post.likes_count).label("likes"),
        func.sum(Post.reposts_count).label("reposts")
    ).filter(Post.status == "sent").first()
    
    return {
        "sent": total_sent,
        "failed": total_failed,
        "scheduled": total_scheduled,
        "drafts": total_drafts,
        "views": int(metrics.views or 0),
        "likes": int(metrics.likes or 0),
        "reposts": int(metrics.reposts or 0)
    }

@router.delete("/{post_id}")
def delete_post(post_id: int, db: Session = Depends(get_db)):
    logger.info(f"Deleting post {post_id}")
    db_post = db.query(Post).filter(Post.id == post_id).first()
    if db_post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    
    db.delete(db_post)
    db.commit()
    return {"ok": True}
