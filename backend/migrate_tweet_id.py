import sqlite3

def migrate():
    conn = sqlite3.connect('scheduler.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE posts ADD COLUMN tweet_id TEXT")
        conn.commit()
        print("Migration successful: Added tweet_id column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Migration skipped: Column tweet_id already exists.")
        else:
            print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
