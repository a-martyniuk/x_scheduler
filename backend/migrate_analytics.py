import sqlite3

def migrate():
    conn = sqlite3.connect('scheduler.db')
    cursor = conn.cursor()
    
    columns = [
        ("views_count", "INTEGER DEFAULT 0"),
        ("likes_count", "INTEGER DEFAULT 0"),
        ("reposts_count", "INTEGER DEFAULT 0")
    ]
    
    for col_name, col_type in columns:
        try:
            cursor.execute(f"ALTER TABLE posts ADD COLUMN {col_name} {col_type}")
            print(f"Added column {col_name}.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e):
                print(f"Skipped {col_name}: Already exists.")
            else:
                print(f"Failed to add {col_name}: {e}")
                
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
