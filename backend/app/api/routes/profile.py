import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.schemas.profile import ProfileOut, ProfileUpdate
from app.api.deps import get_current_user
from app.api.routes.uploads import UPLOAD_DIR

router = APIRouter(prefix="/api/profile", tags=["profile"])

PROFILE_IMG_DIR = UPLOAD_DIR / "profile_images"
PROFILE_IMG_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


@router.get("", response_model=ProfileOut)
def get_profile(user: User = Depends(get_current_user)):
    return user


@router.post("/image", response_model=ProfileOut)
async def upload_profile_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Image is too large (max 5MB)")

    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    (PROFILE_IMG_DIR / unique_name).write_bytes(contents)

    user.profile_image_url = f"/uploads/profile_images/{unique_name}"
    db.commit()
    db.refresh(user)
    return user


@router.patch("", response_model=ProfileOut)
def update_profile(payload: ProfileUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    updates = payload.model_dump(exclude_unset=True)

    if "email" in updates:
        # Blank string means "clear it", not "set email to empty string" —
        # email has a unique constraint, and multiple users with "" would
        # collide on that constraint the moment a second person cleared theirs.
        email = (updates["email"] or "").strip() or None
        if email:
            existing = db.query(User).filter(User.email == email, User.id != user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="That email is already in use on another account")
        updates["email"] = email

    if "name" in updates and not (updates["name"] or "").strip():
        raise HTTPException(status_code=400, detail="Name can't be blank")

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user
