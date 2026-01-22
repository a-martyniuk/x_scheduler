from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from datetime import datetime
from .db import Base

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    media_paths = Column(String, nullable=True) # Comma separated paths
    scheduled_at = Column(DateTime, nullable=True)
    status = Column(String, default="draft")  # draft, scheduled, sent, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    logs = Column(Text, nullable=True) # Simple text log for now
    screenshot_path = Column(String, nullable=True)
    retry_count = Column(Integer, default=0)
    parent_id = Column(Integer, ForeignKey('posts.id'), nullable=True)
    tweet_id = Column(String, nullable=True) # The actual ID on X
    views_count = Column(Integer, default=0)
    likes_count = Column(Integer, default=0)
    reposts_count = Column(Integer, default=0)
    username = Column(String, nullable=True) # Account to post from
