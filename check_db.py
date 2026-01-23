from backend.db import SessionLocal
from backend.models import Post

db = SessionLocal()
count = db.query(Post).count()
sent_count = db.query(Post).filter(Post.status == "sent").count()
print(f"Total posts: {count}")
print(f"Sent posts: {sent_count}")
for p in db.query(Post).all():
    print(f"ID: {p.id}, Status: {p.status}, Content: {p.content[:20]}...")
db.close()
