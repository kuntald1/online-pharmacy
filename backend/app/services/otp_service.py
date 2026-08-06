"""
OTP is inherently phone-only, not role-specific — the same 6-digit code
verifies "this person controls this phone number," regardless of which
account (B2C / B2B / CNF) they're then logging into. This module owns that
phone-verification step; each login route (customer_auth.py, b2b.py, cnf.py)
calls verify_otp_code() and then does its own role-scoped User lookup.
"""
import random
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import OtpCode
from app.services.sms import send_otp_sms, SmsNotConfigured

OTP_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60
MAX_VERIFY_ATTEMPTS = 5


def send_otp_code(db: Session, phone: str) -> dict:
    recent = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone)
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if recent and (datetime.utcnow() - recent.created_at) < timedelta(seconds=RESEND_COOLDOWN_SECONDS):
        wait = RESEND_COOLDOWN_SECONDS - int((datetime.utcnow() - recent.created_at).total_seconds())
        raise HTTPException(status_code=429, detail=f"Wait {wait}s before requesting another code")

    code = f"{random.randint(0, 999999):06d}"
    otp = OtpCode(
        phone=phone,
        code_hash=hash_password(code),
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
    )
    db.add(otp)
    db.commit()

    try:
        send_otp_sms(phone, code)
    except SmsNotConfigured:
        db.delete(otp)
        db.commit()
        raise HTTPException(
            status_code=503,
            detail="SMS isn't configured on this server yet — set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER",
        )
    except Exception as e:
        db.delete(otp)
        db.commit()
        raise HTTPException(status_code=502, detail=f"Couldn't send the SMS: {e}")

    return {"status": "sent", "expires_in_minutes": OTP_TTL_MINUTES}


def verify_otp_code(db: Session, phone: str, code: str) -> None:
    """Raises HTTPException on any failure. On success, marks the code
    consumed and returns — it's the caller's job to then look up (or create)
    whichever role-specific User row is relevant to that login flow."""
    otp = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone, OtpCode.consumed == False)  # noqa: E712
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if not otp:
        raise HTTPException(status_code=400, detail="No code was requested for this number — request one first")
    if otp.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="That code expired — request a new one")
    if otp.attempts >= MAX_VERIFY_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many wrong attempts — request a new code")

    if not verify_password(code, otp.code_hash):
        otp.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="That code isn't right")

    otp.consumed = True
    db.commit()
