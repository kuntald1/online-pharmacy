from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Integer, Numeric, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import ReturnStatus, RefundMethod


class ReturnRequest(Base):
    """One request per (order_item, quantity) — a customer can return part
    of a line item's quantity, not necessarily all of it. Refund method and
    amount are only set once an admin approves it; until then they're None,
    not a guess at what they'll end up being."""
    __tablename__ = "return_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    quantity: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[ReturnStatus] = mapped_column(Enum(ReturnStatus), default=ReturnStatus.requested)
    refund_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    refund_method: Mapped[RefundMethod | None] = mapped_column(Enum(RefundMethod), nullable=True)

    admin_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order: Mapped["Order"] = relationship()
    order_item: Mapped["OrderItem"] = relationship()
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
