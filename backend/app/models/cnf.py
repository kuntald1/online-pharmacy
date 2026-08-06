from datetime import datetime

from sqlalchemy import String, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import CNFStatus


class CNFLead(Base):
    __tablename__ = "cnf_leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    contact_no: Mapped[str] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(150), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    gst_no: Mapped[str | None] = mapped_column(String(20), nullable=True)
    driving_licence_no: Mapped[str | None] = mapped_column(String(30), nullable=True)
    trade_licence_no: Mapped[str | None] = mapped_column(String(30), nullable=True)
    status: Mapped[CNFStatus] = mapped_column(Enum(CNFStatus), default=CNFStatus.new)
    whatsapp_notified: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Same pattern as B2BApplication: a User shell (role=cnf, inactive) is
    # created the moment someone submits this form, one per phone number.
    # Login only works once an admin approves and activates it.
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    admin_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
