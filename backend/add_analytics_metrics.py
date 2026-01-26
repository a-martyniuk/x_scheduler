"""
Database Migration: Add Analytics Metrics
Adds url_link_clicks, user_profile_clicks, and detail_expands columns
to both posts and post_metrics_snapshots tables.
"""
from sqlalchemy import create_engine, text
from backend.config import DATABASE_URL
from loguru import logger

def run_migration():
    """Run the migration to add new analytics metrics columns"""
    engine = create_engine(DATABASE_URL)
    
    migrations = [
        # Add columns to posts table
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS url_link_clicks INTEGER DEFAULT 0",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS user_profile_clicks INTEGER DEFAULT 0",
        "ALTER TABLE posts ADD COLUMN IF NOT EXISTS detail_expands INTEGER DEFAULT 0",
        
        # Add columns to post_metrics_snapshots table
        "ALTER TABLE post_metrics_snapshots ADD COLUMN IF NOT EXISTS url_link_clicks INTEGER DEFAULT 0",
        "ALTER TABLE post_metrics_snapshots ADD COLUMN IF NOT EXISTS user_profile_clicks INTEGER DEFAULT 0",
        "ALTER TABLE post_metrics_snapshots ADD COLUMN IF NOT EXISTS detail_expands INTEGER DEFAULT 0",
    ]
    
    try:
        with engine.connect() as conn:
            for migration_sql in migrations:
                logger.info(f"Executing: {migration_sql}")
                conn.execute(text(migration_sql))
                conn.commit()
        
        logger.success("✅ Migration completed successfully!")
        logger.info("New columns added:")
        logger.info("  - url_link_clicks")
        logger.info("  - user_profile_clicks")
        logger.info("  - detail_expands")
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise

if __name__ == "__main__":
    logger.info("Starting database migration...")
    run_migration()
