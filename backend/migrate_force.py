from sqlalchemy import text, inspect
from backend.db import engine
from loguru import logger
import sys

# Configure logger
logger.remove()
logger.add(sys.stderr, level="INFO")

def force_migrations():
    """
    Forcefully checks for missing columns and adds them.
    Also ensures NULL values are set to 0 to avoid validation errors.
    """
    logger.info("Starting FORCE database migrations...")
    try:
        inspector = inspect(engine)
        if not inspector.has_table("posts"):
            logger.info("Table 'posts' does not exist yet.")
            return

        columns = [col["name"] for col in inspector.get_columns("posts")]
        logger.info(f"Existing columns: {columns}")
        
        with engine.connect() as conn:
            # 1. Add views_count
            if "views_count" not in columns:
                logger.info("Migrating: Adding views_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN views_count INTEGER DEFAULT 0"))
            else:
                logger.info("Column views_count exists. Updating NULLs...")
                conn.execute(text("UPDATE posts SET views_count = 0 WHERE views_count IS NULL"))

            # 2. Add likes_count
            if "likes_count" not in columns:
                logger.info("Migrating: Adding likes_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN likes_count INTEGER DEFAULT 0"))
            else:
                logger.info("Column likes_count exists. Updating NULLs...")
                conn.execute(text("UPDATE posts SET likes_count = 0 WHERE likes_count IS NULL"))

            # 3. Add reposts_count
            if "reposts_count" not in columns:
                logger.info("Migrating: Adding reposts_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN reposts_count INTEGER DEFAULT 0"))
            else:
                logger.info("Column reposts_count exists. Updating NULLs...")
                conn.execute(text("UPDATE posts SET reposts_count = 0 WHERE reposts_count IS NULL"))
            
            # 4. Add tweet_id (if missing)
            if "tweet_id" not in columns:
                logger.info("Migrating: Adding tweet_id column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN tweet_id VARCHAR(255)"))
                
            # 5. Add username (if missing)
            if "username" not in columns:
                logger.info("Migrating: Adding username column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN username VARCHAR(255)"))

            conn.commit()
            logger.info("FORCE Migrations completed successfully.")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")

if __name__ == "__main__":
    force_migrations()
