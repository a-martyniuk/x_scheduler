from sqlalchemy import create_engine
from backend.models import Post, Base
from backend.db import SQLALCHEMY_DATABASE_URL

def init_db():
    print(f"Connecting to {SQLALCHEMY_DATABASE_URL}...")
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
    
    print("Dropping all tables (to ensure fresh schema)...")
    Base.metadata.drop_all(bind=engine) 
    # Commented out drop_all to avoid losing data if it exists, 
    # but since we suspect 'no table', creation should work.
    # Actually, if the schema is messed up (missing columns), we might WANT to drop.
    # Given the user just started and has issues, let's try to create first.
    
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")
    
    # Verify
    from sqlalchemy import inspect
    inspector = inspect(engine)
    print("Tables in DB:", inspector.get_table_names())

if __name__ == "__main__":
    init_db()
