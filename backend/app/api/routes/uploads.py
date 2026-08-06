import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.models.user import User
from app.api.deps import require_admin

router = APIRouter(prefix="/api/admin", tags=["uploads"])

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB per file


@router.post("/upload")
async def upload_images(
    files: list[UploadFile] = File(...),
    _admin: User = Depends(require_admin),
):
    """
    Accepts one or more image files (multipart/form-data, field name 'files',
    repeated). Returns a list of {filename, url} for each saved file — the
    caller (product/category/brand forms) joins the URLs as needed.
    """
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Upload at most 10 files at once")

    saved = []
    for file in files:
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"{file.filename} is larger than 5MB")

        ext = Path(file.filename or "").suffix.lower() or ".jpg"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        dest = UPLOAD_DIR / unique_name
        dest.write_bytes(contents)

        saved.append({"filename": file.filename, "url": f"/uploads/{unique_name}"})

    return saved
