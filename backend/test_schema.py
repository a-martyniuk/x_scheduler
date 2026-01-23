from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models import Post, Base
from backend.config import settings

def test_schema():
    print("Testing DB Schema...")
    engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Try to select all posts
        print("Querying posts...")
        posts = db.query(Post).all()
        print(f"Success! Found {len(posts)} posts.")
        
        # Try to insert a new dummy post
        print("Inserting dummy post...")
        new_post = Post(content="Test Schema", views_count=0, likes_count=0, reposts_count=0)
        db.add(new_post)
        db.commit()
        print("Insert successful.")
        
        # Clean up
        db.delete(new_post)
        db.commit()
    except Exception as e:
        print("SCHEMA ERROR:", e)
    finally:
        db.close()

if __name__ == "__main__":
    test_schema()
