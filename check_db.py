from backend.db import SessionLocal
from backend.models import Post

db = SessionLocal()
count = db.query(Post).count()
sent_count = db.query(Post).filter(Post.status == "sent").count()
print(f"Total posts: {count}")
print(f"Sent posts: {sent_count}")
for p in db.query(Post).filter(Post.tweet_id.isnot(None)).order_by(Post.created_at.desc()).all():
    print(f"TweetID: {p.tweet_id} | Date: {p.created_at} | Content: {p.content[:30]}...")
    print(f"  > Metrics: Views={p.views_count}, Likes={p.likes_count}, Clicks={p.url_link_clicks}, Prof={p.user_profile_clicks}, Exp={p.detail_expands}")
