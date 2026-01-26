
import os
import sys
import json
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import settings
from backend.models import Post, PostMetricSnapshot

def cleanup_instagram_orphans():
    db_url = settings.DATABASE_URL
    if "sqlite" in db_url and "///" not in db_url:
        db_url = f"sqlite:///{os.path.join(settings.BASE_DIR, 'x_scheduler.db')}"
    
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        print("Searching for Instagram orphaned posts...")
        # 1. Identify Instagram posts
        # These was created with "New Story Update! 📸" or similar
        query = session.query(Post).filter(Post.content.like("%New Story Update!%"))
        ig_posts = query.all()
        
        print(f"Found {len(ig_posts)} orphaned Instagram posts.")
        
        for post in ig_posts:
            print(f"Deleting Post ID {post.id}: {post.content[:30]}...")
            
            # Delete associated snapshots
            session.query(PostMetricSnapshot).filter(PostMetricSnapshot.post_id == post.id).delete()
            
            # Cleanup media files
            if post.media_paths:
                try:
                    paths = json.loads(post.media_paths)
                    if isinstance(paths, list):
                        for p in paths:
                            if os.path.exists(p):
                                os.remove(p)
                                print(f"  Removed media file: {p}")
                except Exception as e:
                    print(f"  Error cleaning media for post {post.id}: {e}")
            
            session.delete(post)
        
        session.commit()
        print("Cleanup completed successfully.")

    except Exception as e:
        print(f"Error during cleanup: {e}")
        session.rollback()
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_instagram_orphans()
