from datetime import datetime

from sqlalchemy import String, DateTime, Boolean, Integer, Numeric, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import DiscountType, Visibility, SettingCategory


class Coupon(Base):
    __tablename__ = "coupons"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    discount_type: Mapped[DiscountType] = mapped_column(Enum(DiscountType))
    discount_value: Mapped[float] = mapped_column(Numeric(10, 2))
    min_order_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    max_uses: Mapped[int | None] = mapped_column(Integer, nullable=True)
    used_count: Mapped[int] = mapped_column(Integer, default=0)
    # "Visible to" — same concept and same enum as Category/Brand/Banner
    # visibility, not a strict single pricing-tier match. A coupon marked
    # "b2b" works for both the Normal and Advance tiers; previously this was
    # a PricingChannel requiring a separate coupon per exact tier.
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility), default=Visibility.b2c)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    valid_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AppSetting(Base):
    """
    Generic key-value store backing both CMS content blocks (e.g. homepage
    hero copy) and store-level settings (e.g. support email, low-stock
    threshold). Deliberately simple — a dedicated table per setting would be
    overkill for what's currently just editable text/number fields.
    """
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    category: Mapped[SettingCategory] = mapped_column(Enum(SettingCategory))
    label: Mapped[str] = mapped_column(String(150))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
