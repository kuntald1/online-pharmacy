from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PrescriptionUpload(Base):
    """A record of every prescription a customer uploads through 'Upload Rx',
    kept regardless of whether they end up ordering anything from it. This is
    a compliance/audit log a pharmacist can browse (Admin > Prescriptions),
    not an authoritative source the app trusts — extraction from a photo of
    handwriting is a best-effort guess, and the actual dispensing decision
    for prescription-required items still needs a human to look at the
    original image, not just the AI's reading of it."""
    __tablename__ = "prescription_uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    file_url: Mapped[str] = mapped_column(String(500))
    extracted_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # raw extraction result, for audit/debugging
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship()
