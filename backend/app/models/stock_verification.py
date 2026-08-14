from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Integer, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ScanSessionStatus, OcrStatus


class ScanSession(Base):
    """One scanning session = one employee scanning strips against ONE
    invoice, freely — not restricted to a single pre-chosen product. As
    strips come in, they're grouped by (medicine name, batch number) on
    the fly (see services/strip_scan.py: get_grouped_scan_rows), so a
    running "Medicine X / Batch Y / Qty N" table builds up without a
    separate table to keep in sync. Matching against what the invoice
    actually expected happens later, on demand, via the Compare step —
    not per-scan — since a session can span many different medicines and
    batches, there's no longer a single "expected_qty" to compare against
    as each strip comes in."""
    __tablename__ = "scan_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    status: Mapped[ScanSessionStatus] = mapped_column(SAEnum(ScanSessionStatus), default=ScanSessionStatus.in_progress)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    invoice: Mapped["Invoice"] = relationship()
    employee: Mapped["User"] = relationship()
    strip_scans: Mapped[list["StripScanRecord"]] = relationship(back_populates="session", order_by="StripScanRecord.sequence_no")


class StripScanRecord(Base):
    """One row per physical strip scanned — the raw evidence. The grouped
    "Medicine X / Batch Y / Qty N" table the employee sees while scanning
    is computed by grouping these rows (COUNT of rows sharing the same
    medicine+batch within a session), not stored separately — so there's
    no risk of a counter drifting out of sync with the actual scans.

    image_path is intentionally nullable and gets set to None once the
    photo is deleted from local disk after successful extraction — the
    extracted text is what's kept permanently for audit, not the photo
    itself. While ocr_status is 'needs_retry' the file still exists on
    disk (the service re-derives its path from session_id + sequence_no
    for a retry); it's deleted on the next successful attempt or swept by
    a periodic cleanup job."""
    __tablename__ = "strip_scan_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("scan_sessions.id"))
    sequence_no: Mapped[int] = mapped_column(Integer)  # 1st, 2nd, 3rd strip scanned in this session, any medicine
    scanned_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)  # which employee made THIS scan — sessions are shared, so this isn't always session.employee_id

    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)  # always None once processed — see docstring

    extracted_medicine_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    extracted_batch_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extracted_mfg_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    extracted_exp_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confidence: Mapped[str | None] = mapped_column(String(10), nullable=True)  # high | medium | low

    ocr_status: Mapped[OcrStatus] = mapped_column(SAEnum(OcrStatus), default=OcrStatus.accepted)
    attempts_taken: Mapped[int] = mapped_column(Integer, default=1)  # how many camera captures the app needed before THIS strip was successfully read — shown as "Scan Attempt" in the web admin table

    scanned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["ScanSession"] = relationship(back_populates="strip_scans")
    scanned_by: Mapped["User"] = relationship()
