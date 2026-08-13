from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ScanSessionStatus, OcrStatus  # add these two enums to app/models/enums.py


class ScanSession(Base):
    """One scanning session = one employee verifying one box's worth of
    strips against an expected batch/qty (from an invoice line item, or a
    standalone count if no invoice is attached). Scoping everything to a
    session_id — rather than a shared/global counter — is what lets
    multiple employees scan different boxes at the same time without
    their counts interfering with each other."""
    __tablename__ = "scan_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invoice_line_item_id: Mapped[int | None] = mapped_column(ForeignKey("invoice_line_items.id"), nullable=True)

    product_name: Mapped[str] = mapped_column(String(255))
    batch_no_expected: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expected_qty: Mapped[int] = mapped_column(Integer)
    scanned_qty: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[ScanSessionStatus] = mapped_column(SAEnum(ScanSessionStatus), default=ScanSessionStatus.in_progress)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    employee: Mapped["User"] = relationship()
    strip_scans: Mapped[list["StripScanRecord"]] = relationship(back_populates="session", order_by="StripScanRecord.sequence_no")


class StripScanRecord(Base):
    """One row per physical strip scanned. image_path is intentionally
    nullable and gets set to None once the photo is deleted from local
    disk after successful extraction — the extracted text (batch/mfg/exp)
    is what's kept permanently for audit/recall purposes, not the photo
    itself. While ocr_status is 'needs_retry' the file still exists on
    disk (the service re-derives its path from session_id + sequence_no
    for a retry, rather than persisting the path here); it's deleted on
    the next successful attempt or swept by a periodic cleanup job."""
    __tablename__ = "strip_scan_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("scan_sessions.id"))
    sequence_no: Mapped[int] = mapped_column(Integer)  # 1st, 2nd, 3rd strip scanned in this session

    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)  # always None once processed — see docstring

    extracted_medicine_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extracted_batch_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extracted_mfg_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    extracted_exp_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # high | medium | low

    ocr_status: Mapped[OcrStatus] = mapped_column(SAEnum(OcrStatus), default=OcrStatus.accepted)
    batch_mismatch: Mapped[bool] = mapped_column(default=False)  # true if this strip's batch differs from session's expected batch

    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ScanSession"] = relationship(back_populates="strip_scans")
