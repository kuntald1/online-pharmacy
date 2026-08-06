from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, Integer, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import Visibility


class HealthPackage(Base):
    """Diagnostic/checkup packages (Heart Test, Master Health Checkup, etc.)
    — a distinct content type from Products. These aren't add-to-cart items;
    the 'view' action links out (to a contact/booking flow), same reasoning
    as why Banners use a plain link_url rather than routing through the cart."""
    __tablename__ = "health_packages"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    image_url: Mapped[str] = mapped_column(String(500))
    mrp: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility), default=Visibility.both)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
