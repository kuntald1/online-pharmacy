from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.models.cnf import CNFLead
from app.models.user import User
from app.models.enums import CNFStatus, UserRole
from app.schemas.cnf import CNFLeadCreate, CNFLeadOut, CNFReview
from app.schemas.auth import SendOtpRequest, VerifyOtpRequest, TokenResponse
from app.services.whatsapp import notify_admin_of_cnf_lead, send_whatsapp_message
from app.services.otp_service import send_otp_code, verify_otp_code
from app.api.deps import require_admin

router = APIRouter(prefix="/api/cnf", tags=["cnf"])


@router.post("", response_model=CNFLeadOut)
def submit_cnf_lead(payload: CNFLeadCreate, db: Session = Depends(get_db)):
    """
    Same shape as the B2B apply flow: creates a User shell (role=cnf,
    inactive until approved) alongside the lead, scoped to
    (phone, role=cnf) — the same phone may already have a B2C or B2B
    account, which is fine, those are separate rows. Submitting the CNF
    form *is* applying for a CNF/Distributor account; login afterward is
    phone + OTP, no password anywhere in this flow.
    """
    existing_user = db.query(User).filter(User.phone == payload.contact_no, User.role == UserRole.cnf).first()
    if existing_user:
        existing_lead = db.query(CNFLead).filter(CNFLead.user_id == existing_user.id).first()
        if existing_lead:
            raise HTTPException(status_code=400, detail="A request already exists for this phone number")
    else:
        existing_user = User(
            name=payload.name,
            phone=payload.contact_no,
            password_hash=None,
            role=UserRole.cnf,
            is_active=False,
        )
        db.add(existing_user)
        db.flush()

    lead = CNFLead(**payload.model_dump(), user_id=existing_user.id)
    db.add(lead)
    db.commit()
    db.refresh(lead)

    lead.whatsapp_notified = notify_admin_of_cnf_lead(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/status/{phone}", response_model=CNFLeadOut)
def check_status(phone: str, db: Session = Depends(get_db)):
    """Public status check by phone (used before an account is active)."""
    lead = db.query(CNFLead).filter(CNFLead.contact_no == phone).order_by(CNFLead.id.desc()).first()
    if not lead:
        raise HTTPException(status_code=404, detail="No request found for this phone number")
    return lead


@router.get("/admin", response_model=list[CNFLeadOut])
def list_cnf_leads(
    status_filter: CNFStatus | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(CNFLead)
    if status_filter:
        q = q.filter(CNFLead.status == status_filter)
    return q.order_by(CNFLead.created_at.desc()).all()


@router.post("/admin/{lead_id}/review", response_model=CNFLeadOut)
def review_cnf_lead(
    lead_id: int,
    payload: CNFReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Admin approves/rejects. On approval: just activates the account (no
    password) and sends a WhatsApp letting them know they can now log in
    with phone + OTP. 'new'/'contacted'/'closed' remain available as
    informal follow-up notes independent of the approve/reject decision."""
    lead = db.get(CNFLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Request not found")

    lead.status = CNFStatus.approved if payload.approve else CNFStatus.rejected
    lead.admin_note = payload.admin_note
    lead.reviewed_by = admin.id
    lead.reviewed_at = datetime.utcnow()

    if payload.approve and lead.user_id:
        user = db.get(User, lead.user_id)
        if not user or user.role != UserRole.cnf:
            raise HTTPException(
                status_code=409,
                detail="This request's linked account isn't a CNF account. This needs manual cleanup in the database.",
            )
        user.is_active = True

        message = (
            f"Your Healthycian CNF/Distributor account has been approved!\n"
            f"You can now log in with phone {lead.contact_no} using the CNF / Distributor login "
            f"(phone number + OTP — no password needed)."
        )
        send_whatsapp_message(lead.contact_no, message)

    db.commit()
    db.refresh(lead)
    return lead


# ---------- OTP login (post-approval) ----------

@router.post("/send-otp")
def send_otp(payload: SendOtpRequest, db: Session = Depends(get_db)):
    return send_otp_code(db, payload.phone.strip())


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    phone = payload.phone.strip()
    verify_otp_code(db, phone, payload.code)

    user = db.query(User).filter(User.phone == phone, User.role == UserRole.cnf).first()
    if not user:
        raise HTTPException(status_code=404, detail="No CNF account for this phone number — apply first")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your CNF request is still pending review")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenResponse(access_token=token, role=user.role, user_id=user.id, name=user.name)
