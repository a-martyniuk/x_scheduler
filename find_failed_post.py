import sqlite3
import os

db_path = "x_scheduler.db"

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Find the most recent failed posts
    print("Listing last 3 failed posts:")
    cursor.execute("SELECT id, content, status, logs, screenshot_path FROM posts WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 3")
    rows = cursor.fetchall()
    if rows:
        for row in rows:
            print(f"ID: {row[0]}")
            print(f"Content: {row[1]}")
            print(f"Status: {row[2]}")
            print(f"Logs: {row[3]}")
            print(f"Screenshot: {row[4]}")
            print("-" * 20)
    else:
        print("No failed posts found in the DB.")
        
    conn.close()
else:
    print("DB NOT FOUND")
