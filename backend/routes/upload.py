from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
import uuid
from loguru import logger
from backend.config import settings

router = APIRouter()

UPLOAD_DIR = os.path.join(settings.DATA_DIR, "uploads")

@router.post("/")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Get original filename and extension
        original_filename = file.filename or "unknown"
        file_extension = os.path.splitext(original_filename)[1].lower()
        
        # Default to .jpg if no extension found (common for some mobile captures)
        if not file_extension:
            file_extension = ".jpg"
            logger.warning(f"No extension found for {original_filename}, defaulting to .jpg")

        new_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, new_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        logger.info(f"Successfully saved upload: {original_filename} -> {new_filename} ({file_path})")

        # Return absolute path for worker and relative URL for frontend
        return {
            "filename": new_filename,
            "filepath": os.path.abspath(file_path),
            "url": f"/uploads/{new_filename}" 
        }
    except Exception as e:
        logger.error(f"Failed to save upload {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")
