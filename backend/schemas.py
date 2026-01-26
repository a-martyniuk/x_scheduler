from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from typing import List, Optional

class PostBase(BaseModel):
    content: str = Field(..., min_length=1, max_length=280)
    media_paths: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = "draft"
    parent_id: Optional[int] = None
    username: Optional[str] = None

class PostCreate(PostBase):
    pass

class PostUpdate(PostBase):
    content: Optional[str] = Field(None, min_length=1, max_length=280)

class PostResponse(PostBase):
    id: int
    content: Optional[str] = None # Override base to allow robust read
    media_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    logs: Optional[str] = None
    screenshot_path: Optional[str] = None
    tweet_id: Optional[str] = None
    views_count: int = 0
    likes_count: int = 0

    reposts_count: int = 0
    bookmarks_count: int = 0
    replies_count: int = 0
    url_link_clicks: int = 0
    user_profile_clicks: int = 0
    detail_expands: int = 0
    is_repost: bool = False
    
    @field_validator('views_count', 'likes_count', 'reposts_count', 'bookmarks_count', 'replies_count', 'url_link_clicks', 'user_profile_clicks', 'detail_expands', mode='before')
    @classmethod
    def set_zero_if_none(cls, v):
        return v or 0

    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def set_now_if_none(cls, v):
        if v is None:
            return datetime.now()
        return v

    @field_validator('content', mode='before')
    @classmethod
    def set_placeholder_if_none(cls, v):
        return v or "(No content)"
    
    model_config = ConfigDict(from_attributes=True)

class GlobalStats(BaseModel):
    sent: int
    failed: int
    scheduled: int
    drafts: int
    views: int
    likes: int
    reposts: int
