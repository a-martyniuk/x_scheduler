from sqlalchemy import text, inspect
from backend.db import engine
from loguru import logger

def run_migrations():
    """
    Checks for missing columns in the 'posts' table and adds them if necessary.
    Database agnostic implementation using SQLAlchemy Inspector.
    """
    logger.info("Checking for database migrations...")
    try:
        inspector = inspect(engine)
        if not inspector.has_table("posts"):
            logger.info("Table 'posts' does not exist yet. Skipping migration (will be created by generic init).")
            return

        columns = [col["name"] for col in inspector.get_columns("posts")]
        
        with engine.connect() as conn:
            # 1. Add views_count
            if "views_count" not in columns:
                logger.info("Migrating: Adding views_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN views_count INTEGER DEFAULT 0"))
            else:
                 conn.execute(text("UPDATE posts SET views_count = 0 WHERE views_count IS NULL"))
                
            # 2. Add likes_count
            if "likes_count" not in columns:
                logger.info("Migrating: Adding likes_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN likes_count INTEGER DEFAULT 0"))
            else:
                 conn.execute(text("UPDATE posts SET likes_count = 0 WHERE likes_count IS NULL"))
                
            # 3. Add reposts_count
            if "reposts_count" not in columns:
                logger.info("Migrating: Adding reposts_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN reposts_count INTEGER DEFAULT 0"))
            else:
                 conn.execute(text("UPDATE posts SET reposts_count = 0 WHERE reposts_count IS NULL"))
            
            # 4. Add tweet_id (if missing)
            if "tweet_id" not in columns:
                logger.info("Migrating: Adding tweet_id column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN tweet_id VARCHAR(255)"))
                
            # 5. Add username (if missing)
            if "username" not in columns:
                logger.info("Migrating: Adding username column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN username VARCHAR(255)"))

            # 6. Sanitize Legacy Data (Fix 500 Errors)
            logger.info("Migrating: Sanitizing legacy data...")
            
            # Fix NULL created_at
            if "created_at" in columns:
                conn.execute(text("UPDATE posts SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
            
            # Fix NULL updated_at
            if "updated_at" in columns:
                conn.execute(text("UPDATE posts SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))
            
            # Fix NULL content
            if "content" in columns:
                conn.execute(text("UPDATE posts SET content = '(No content)' WHERE content IS NULL"))

            conn.commit()
            logger.info("Migrations completed successfully.")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")
