from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Integer, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PackType


class Invoice(Base):
    """A wholesaler invoice, uploaded and parsed via Claude vision
    (see services/invoice_extraction.py). This is the "expected" side of
    stock receiving — line items here get reconciled against what
    employees actually scan strip-by-strip."""
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True)
    uploaded_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    wholesaler_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    invoice_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[str | None] = mapped_column(String(20), nullable=True)  # as printed, not normalized — source formats vary
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)  # local staging path, nulled after processing — same pattern as strip scans

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    uploaded_by: Mapped["User"] = relationship()
    line_items: Mapped[list["InvoiceLineItem"]] = relationship(back_populates="invoice", order_by="InvoiceLineItem.id")


class InvoiceLineItem(Base):
    """One product/batch row from an invoice. pack_type decides whether
    this item goes through strip-level scan verification at all — only
    'strip' type items get a ScanSession; 'bottle'/'unit' items are just
    counted as whole pieces without per-unit OCR."""
    __tablename__ = "invoice_line_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))

    product_name: Mapped[str] = mapped_column(String(255))
    batch_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    exp_date: Mapped[str | None] = mapped_column(String(20), nullable=True)  # as printed, e.g. "4/29" or "04/2029"

    pack: Mapped[str] = mapped_column(String(50))  # raw string as printed, e.g. "10S", "100ML", "120"
    pack_type: Mapped[PackType] = mapped_column(SAEnum(PackType))
    tablets_per_strip: Mapped[int | None] = mapped_column(Integer, nullable=True)  # only set when pack_type == strip

    qty: Mapped[int] = mapped_column(Integer)  # quantity ordered, in units of `pack`
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)  # true once its ScanSession completes with no mismatch

    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")
