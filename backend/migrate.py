from sqlalchemy import text
from backend.db import engine, SessionLocal
from loguru import logger

def run_migrations():
    """
    Checks for missing columns in the 'posts' table and adds them if necessary.
    This is a poor man's migration system for SQLite.
    """
    logger.info("Checking for database migrations...")
    try:
        with engine.connect() as conn:
            # Check existing columns
            result = conn.execute(text("PRAGMA table_info(posts)"))
            columns = [row[1] for row in result.fetchall()]
            
            # 1. Add views_count
            if "views_count" not in columns:
                logger.info("Migrating: Adding views_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN views_count INTEGER DEFAULT 0"))
                
            # 2. Add likes_count
            if "likes_count" not in columns:
                logger.info("Migrating: Adding likes_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN likes_count INTEGER DEFAULT 0"))
                
            # 3. Add reposts_count
            if "reposts_count" not in columns:
                logger.info("Migrating: Adding reposts_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN reposts_count INTEGER DEFAULT 0"))
            
            # 4. Add tweet_id (if missing)
            if "tweet_id" not in columns:
                logger.info("Migrating: Adding tweet_id column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN tweet_id VARCHAR"))
                
            # 5. Add username (if missing)
            if "username" not in columns:
                logger.info("Migrating: Adding username column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN username VARCHAR"))

            conn.commit()
            logger.info("Migrations completed successfully.")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
