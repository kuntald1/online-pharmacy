from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.auth import SignupRequest, LoginRequest, TokenResponse, UserOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """
    Generic B2C signup. B2B accounts are created implicitly the first time a user
    submits the B2B onboarding form (see /api/b2b/apply) — they do not sign up here first.
    """
    existing = db.query(User).filter(User.phone == payload.phone, User.role == UserRole.b2c).first()
    if existing:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = User(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.b2c,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, name=user.name)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Password login. Now that phone is unique per (phone, role) rather than
    globally, this is scoped to accounts that actually have a password set
    (password_hash IS NOT NULL) — B2C, B2B, and CNF are all OTP-only going
    forward, so in practice this only ever matches an admin account (or a
    legacy password-based signup predating the OTP flows).
    """
    user = (
        db.query(User)
        .filter(User.phone == payload.phone, User.password_hash.isnot(None))
        .first()
    )
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid phone or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account not active")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, name=user.name)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
