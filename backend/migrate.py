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

            # 6. Add media_url (for thumbnails)
            if "media_url" not in columns:
                logger.info("Migrating: Adding media_url column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN media_url VARCHAR(500)"))

            # 7. Add is_repost
            if "is_repost" not in columns:
                logger.info("Migrating: Adding is_repost column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN is_repost BOOLEAN DEFAULT FALSE"))

            # 8. Add bookmarks_count
            if "bookmarks_count" not in columns:
                logger.info("Migrating: Adding bookmarks_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN bookmarks_count INTEGER DEFAULT 0"))

            # 9. Add replies_count
            if "replies_count" not in columns:
                logger.info("Migrating: Adding replies_count column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN replies_count INTEGER DEFAULT 0"))

            # 10. Add tags
            if "tags" not in columns:
                logger.info("Migrating: Adding tags column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN tags VARCHAR(500)"))

            # 11. Add url_link_clicks
            if "url_link_clicks" not in columns:
                logger.info("Migrating: Adding url_link_clicks column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN url_link_clicks INTEGER DEFAULT 0"))

            # 12. Add user_profile_clicks
            if "user_profile_clicks" not in columns:
                logger.info("Migrating: Adding user_profile_clicks column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN user_profile_clicks INTEGER DEFAULT 0"))

            # 13. Add detail_expands
            if "detail_expands" not in columns:
                logger.info("Migrating: Adding detail_expands column")
                conn.execute(text("ALTER TABLE posts ADD COLUMN detail_expands INTEGER DEFAULT 0"))

            # --- Check post_metrics_snapshots table ---
            if inspector.has_table("post_metrics_snapshots"):
                snap_columns = [col["name"] for col in inspector.get_columns("post_metrics_snapshots")]
                
                if "bookmarks" not in snap_columns:
                    logger.info("Migrating: Adding bookmarks column to post_metrics_snapshots")
                    conn.execute(text("ALTER TABLE post_metrics_snapshots ADD COLUMN bookmarks INTEGER DEFAULT 0"))

                if "replies" not in snap_columns:
                    logger.info("Migrating: Adding replies column to post_metrics_snapshots")
                    conn.execute(text("ALTER TABLE post_metrics_snapshots ADD COLUMN replies INTEGER DEFAULT 0"))

                if "url_link_clicks" not in snap_columns:
                    logger.info("Migrating: Adding url_link_clicks column to post_metrics_snapshots")
                    conn.execute(text("ALTER TABLE post_metrics_snapshots ADD COLUMN url_link_clicks INTEGER DEFAULT 0"))

                if "user_profile_clicks" not in snap_columns:
                    logger.info("Migrating: Adding user_profile_clicks column to post_metrics_snapshots")
                    conn.execute(text("ALTER TABLE post_metrics_snapshots ADD COLUMN user_profile_clicks INTEGER DEFAULT 0"))

                if "detail_expands" not in snap_columns:
                    logger.info("Migrating: Adding detail_expands column to post_metrics_snapshots")
                    conn.execute(text("ALTER TABLE post_metrics_snapshots ADD COLUMN detail_expands INTEGER DEFAULT 0"))

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

            # 14. Deduplicate Posts (Merge Strategy Cleanup)
            # Find groups of posts with same content same tweet_id (or one has null)
            # Strategy: If found multiple posts with same tweet_id, keep the one with most recent updated_at
            # If found multiple posts with same content, and one has tweet_id and other doesn't, DELETE the one without tweet_id (assuming it was the draft)
            
            logger.info("Migrating: Checking for duplicates to clean up...")
            
            # 1. Deduplicate by tweet_id (strict duplicates)
            # Delete older duplicates of the same tweet_id
            conn.execute(text("""
                DELETE FROM posts 
                WHERE id NOT IN (
                    SELECT MAX(id) 
                    FROM posts 
                    WHERE tweet_id IS NOT NULL 
                    GROUP BY tweet_id
                ) 
                AND tweet_id IS NOT NULL
            """))

            # 2. Match Imports to Drafts (The implementation of merge strategy for OLD imports)
            # If we have a post with tweet_id='X' and content='ABC'
            # AND a post with tweet_id=NULL and content='ABC'
            # We should assume the one with tweet_id is the Import, and the other is the Draft that SHOULD have been merged.
            # So we delete the Draft.
            
            # Note: This is aggressive. We only do it for status='sent' vs status='scheduled'/'draft'? 
            # Or just content match.
            # Let's be careful: Only delete if content is long enough to be unique (> 20 chars) matching "Acabo de lanzar un pane"
            
            # 2. Match Imports to Drafts (Fuzzy Match)
            # Use the first 30 characters to match drafts to imported tweets.
            # This handles cases where X modifies whitespace or links.
            
            logger.info("Migrating: Running fuzzy deduplication...")
            conn.execute(text("""
                DELETE FROM posts 
                WHERE tweet_id IS NULL 
                AND EXISTS (
                    SELECT 1 
                    FROM posts p2 
                    WHERE p2.tweet_id IS NOT NULL 
                    AND p2.id != posts.id
                    AND substr(p2.content, 1, 30) = substr(posts.content, 1, 30)
                )
                AND length(content) > 15
            """))

            # 3. Clean up specific noise (pizzeria retweet)
            logger.info("Migrating: Removing specific noisy retweet...")
            conn.execute(text("""
                DELETE FROM posts 
                WHERE content LIKE '%La pizzeria 24/7 cerca del pentágono esta repotando%'
            """))

            conn.commit()
            logger.info("Migrations completed successfully.")
            
    except Exception as e:
        logger.error(f"Migration failed: {e}")

if __name__ == "__main__":
    run_migrations()
