import sqlite3
import os

db_path = "x_scheduler.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List all posts to see what we have
    print("Listing last 5 posts:")
    cursor.execute("SELECT id, content, tweet_id, status FROM posts ORDER BY id DESC LIMIT 5")
    for row in cursor.fetchall():
        print(row)
    
    # Search specifically for anything containing "Amé"
    print("\nSearching for 'Amé':")
    cursor.execute("SELECT id, content, tweet_id, status FROM posts WHERE content LIKE '%Amé%'")
    for row in cursor.fetchall():
        print(row)
        
    conn.close()
else:
    print("DB NOT FOUND")
