from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import Optional
import os

class Settings(BaseSettings):
    DATA_DIR: str = "data"
    DATABASE_URL: str = "sqlite:///./x_scheduler.db"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    
    # X Credentials
    X_USERNAME: Optional[str] = None
    X_PASSWORD: Optional[str] = None
    X_COOKIES_JSON: Optional[str] = None
    
    # Security
    ADMIN_TOKEN: Optional[str] = "196677d"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v or str(v).strip() == "":
            return "sqlite:///./x_scheduler.db"
        
        # Si es un path relativo de SQLite, asegurar que se interprete bien
        if str(v).startswith("sqlite:///./") or (str(v).startswith("sqlite:///") and not str(v).startswith("sqlite:////")):
             pass # El default es manejable
        if str(v).startswith("postgres://"):
            return str(v).replace("postgres://", "postgresql://", 1)
            
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
