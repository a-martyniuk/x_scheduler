from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "uploads"

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Create unique filename
        file_extension = os.path.splitext(file.filename)[1]
        new_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, new_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Return absolute path for worker and relative URL for frontend
        return {
            "filename": new_filename,
            "filepath": os.path.abspath(file_path),
            "url": f"/uploads/{new_filename}" 
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {e}")
