import sqlite3

def migrate():
    conn = sqlite3.connect('scheduler.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE posts ADD COLUMN parent_id INTEGER REFERENCES posts(id)")
        conn.commit()
        print("Migration successful: Added parent_id column.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Migration skipped: Column parent_id already exists.")
        else:
            print(f"Migration failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
