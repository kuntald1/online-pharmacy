from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.auth import SendOtpRequest, VerifyOtpRequest, TokenResponse
from app.services.otp_service import send_otp_code, verify_otp_code

router = APIRouter(prefix="/api/auth/customer", tags=["customer-auth"])


@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    return send_otp_code(db, payload.phone.strip())


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    phone = payload.phone.strip()
    verify_otp_code(db, phone, payload.code)

    # Scoped to role=b2c specifically — the same phone may also have a
    # separate B2B or CNF account (each its own User row); this endpoint
    # only ever logs into (or creates, on first use) the B2C one.
    user = db.query(User).filter(User.phone == phone, User.role == UserRole.b2c).first()
    if not user:
        user = User(name="Customer", phone=phone, password_hash=None, role=UserRole.b2c)
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account not active")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, name=user.name)
