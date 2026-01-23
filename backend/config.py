from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional
import os

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./x_scheduler.db"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # X Credentials
    X_USERNAME: Optional[str] = None
    X_PASSWORD: Optional[str] = None
    X_COOKIES_JSON: Optional[str] = None
    
    # Security
    ADMIN_TOKEN: Optional[str] = "admin123" # Default for easy start, but should be changed

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v or str(v).strip() == "":
            return "sqlite:///./x_scheduler.db"
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
