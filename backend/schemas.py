from pydantic import BaseModel, Field, ConfigDict
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
    created_at: datetime
    updated_at: datetime
    logs: Optional[str] = None
    screenshot_path: Optional[str] = None
    tweet_id: Optional[str] = None
    views_count: int = 0
    likes_count: int = 0
    reposts_count: int = 0
    
    @field_validator('views_count', 'likes_count', 'reposts_count', mode='before')
    @classmethod
    def set_zero_if_none(cls, v):
        return v or 0
    
    model_config = ConfigDict(from_attributes=True)

class GlobalStats(BaseModel):
    sent: int
    failed: int
    scheduled: int
    drafts: int
    views: int
    likes: int
    reposts: int
