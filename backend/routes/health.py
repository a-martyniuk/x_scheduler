from fastapi import APIRouter
from worker.publisher import check_login_state
from backend.db import SessionLocal
from datetime import datetime
from sqlalchemy import text

router = APIRouter()

@router.get("/")
async def health_check():
    db_status = "ok"
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok", 
        "database": db_status,
        "timestamp": datetime.now().isoformat()
    }

@router.get("/session/{username}")
async def check_session_health(username: str):
    """
    Checks if the session for the given username is still valid.
    """
    result = await check_login_state(username)
    return result
