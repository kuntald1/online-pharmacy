from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User, B2BApplication
from app.models.enums import UserRole, B2BApplicationStatus
from app.schemas.b2b import B2BApplicationCreate, B2BApplicationOut, B2BApplicationReview
from app.schemas.auth import SendOtpRequest, VerifyOtpRequest, TokenResponse
from app.api.deps import require_admin
from app.services.whatsapp import send_whatsapp_message
from app.services.otp_service import send_otp_code, verify_otp_code

router = APIRouter(prefix="/api/b2b", tags=["b2b"])


@router.post("/apply", response_model=B2BApplicationOut)
def apply_b2b(payload: B2BApplicationCreate, db: Session = Depends(get_db)):
    """
    First-time B2B flow: creates a User shell (role=b2b, inactive login until
    approved) plus the KYC application. Looked up/created scoped to
    (phone, role=b2b) specifically — the same phone may already have a B2C
    or CNF account, which is fine and expected, those are separate rows.
    No password is set anywhere in this flow — B2B accounts log in with
    phone + OTP, same as B2C, just gated on is_active until approved.
    """
    existing_user = db.query(User).filter(User.phone == payload.phone, User.role == UserRole.b2b).first()
    if existing_user and existing_user.b2b_application:
        raise HTTPException(status_code=400, detail="An application already exists for this phone number")

    if not existing_user:
        existing_user = User(
            name=payload.contact_name,
            phone=payload.phone,
            password_hash=None,
            role=UserRole.b2b,
            is_active=False,  # cannot log in until approved
        )
        db.add(existing_user)
        db.flush()

    application = B2BApplication(
        user_id=existing_user.id,
        business_name=payload.business_name,
        contact_name=payload.contact_name,
        phone=payload.phone,
        aadhar_no=payload.aadhar_no,
        pan_no=payload.pan_no,
        gst_no=payload.gst_no,
        driving_licence_no=payload.driving_licence_no,
        trade_licence_no=payload.trade_licence_no,
        status=B2BApplicationStatus.pending,
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return application


@router.get("/status/{phone}", response_model=B2BApplicationOut)
def check_status(phone: str, db: Session = Depends(get_db)):
    """Public status check by phone (used before an account is active)."""
    application = (
        db.query(B2BApplication).filter(B2BApplication.phone == phone).order_by(B2BApplication.id.desc()).first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="No application found for this phone number")
    return application


@router.get("/applications", response_model=list[B2BApplicationOut])
def list_applications(
    status_filter: B2BApplicationStatus | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(B2BApplication)
    if status_filter:
        q = q.filter(B2BApplication.status == status_filter)
    return q.order_by(B2BApplication.created_at.desc()).all()


@router.post("/applications/{application_id}/review", response_model=B2BApplicationOut)
def review_application(
    application_id: int,
    payload: B2BApplicationReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Admin approves/rejects. On approval: just activates the account (no
    password to generate or leak) and sends a WhatsApp letting them know
    they can now log in with phone + OTP.
    """
    application = db.get(B2BApplication, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.status = B2BApplicationStatus.approved if payload.approve else B2BApplicationStatus.rejected
    application.admin_note = payload.admin_note
    application.reviewed_by = admin.id
    application.reviewed_at = datetime.utcnow()

    if payload.approve:
        user = db.get(User, application.user_id)
        if not user or user.role != UserRole.b2b:
            # Should be unreachable given the role-scoped lookup in apply_b2b,
            # but refuse rather than silently activating the wrong account.
            raise HTTPException(
                status_code=409,
                detail="This application's linked account isn't a B2B account. This needs manual cleanup in the database.",
            )
        user.is_active = True

        message = (
            f"Your Healthycian B2B account for {application.business_name} has been approved!\n"
            f"You can now log in with phone {application.phone} using the B2B Wholesale login "
            f"(phone number + OTP — no password needed)."
        )
        send_whatsapp_message(application.phone, message)

    db.commit()
    db.refresh(application)
    return application


# ---------- OTP login (post-approval) ----------

@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    return send_otp_code(db, payload.phone.strip())


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    phone = payload.phone.strip()
    verify_otp_code(db, phone, payload.code)

    user = db.query(User).filter(User.phone == phone, User.role == UserRole.b2b).first()
    if not user:
        raise HTTPException(status_code=404, detail="No B2B account for this phone number — apply first")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your B2B application is still pending review")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, name=user.name)
