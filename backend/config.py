from pydantic_settings import BaseSettings, SettingsConfigDict
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
