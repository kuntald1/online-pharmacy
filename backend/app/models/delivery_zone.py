from datetime import datetime

from sqlalchemy import String, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class DeliveryZone(Base):
    """Admin-configured delivery estimate per pincode. Deliberately not a
    range/prefix system — a pincode either has an explicit entry here (with
    a real delivery-day count the admin has actually decided on) or it
    doesn't, in which case the storefront says so honestly rather than
    guessing a number that might be wrong for an area nobody's confirmed."""
    __tablename__ = "delivery_zones"

    id: Mapped[int] = mapped_column(primary_key=True)
    pincode: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "Kolkata Metro"
    delivery_days: Mapped[int] = mapped_column(Integer, default=1)
    is_deliverable: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
