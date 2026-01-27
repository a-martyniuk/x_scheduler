import sqlite3
import os

# Try common paths
db_paths = [
    "x_scheduler.db",
    "backend/x_scheduler.db",
    "../x_scheduler.db"
]

tweet_id = "2007404288633712869"

for path in db_paths:
    if os.path.exists(path):
        print(f"Connecting to {path}...")
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        
        # Check if it exists
        cursor.execute("SELECT id, content FROM posts WHERE tweet_id = ?", (tweet_id,))
        row = cursor.fetchone()
        if row:
            print(f"Found post {row[0]}: {row[1]}")
            cursor.execute("DELETE FROM posts WHERE tweet_id = ?", (tweet_id,))
            conn.commit()
            print("Successfully deleted.")
        else:
            print("Post not found in this DB.")
        conn.close()
