"""
Database Migration: Add Analytics Metrics
Adds url_link_clicks, user_profile_clicks, and detail_expands columns
to both posts and post_metrics_snapshots tables.
"""
from sqlalchemy import create_engine, text
from backend.config import settings
from loguru import logger

def run_migration():
    """Run the migration to add new analytics metrics columns"""
    engine = create_engine(settings.DATABASE_URL)
    
    new_columns = [
        ('posts', 'url_link_clicks'),
        ('posts', 'user_profile_clicks'),
        ('posts', 'detail_expands'),
        ('post_metrics_snapshots', 'url_link_clicks'),
        ('post_metrics_snapshots', 'user_profile_clicks'),
        ('post_metrics_snapshots', 'detail_expands'),
    ]
    
    try:
        with engine.connect() as conn:
            for table_name, column_name in new_columns:
                # Check if column already exists
                check_query = text(f"PRAGMA table_info({table_name})")
                result = conn.execute(check_query)
                columns = [row[1] for row in result]
                
                if column_name not in columns:
                    logger.info(f"Adding column {column_name} to {table_name}...")
                    alter_query = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} INTEGER DEFAULT 0")
                    conn.execute(alter_query)
                    conn.commit()
                    logger.success(f"✅ Added {column_name} to {table_name}")
                else:
                    logger.info(f"⏭️  Column {column_name} already exists in {table_name}, skipping")
        
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
