from datetime import datetime

from sqlalchemy import String, DateTime, Enum, ForeignKey, Boolean, UniqueConstraint, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import UserRole, B2BApplicationStatus


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        # A phone number can have at most ONE account per role — but the
        # same phone can be a B2C customer, a B2B account, and a CNF account
        # simultaneously, each its own row. Login flows always look up by
        # (phone, role), never phone alone, to keep these separate.
        UniqueConstraint("phone", "role", name="uq_users_phone_role"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str | None] = mapped_column(String(150), unique=True, nullable=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Running total — WalletTransaction rows are the source of truth/audit
    # trail, this is just the current balance kept in sync alongside them
    # so reading a balance doesn't require summing the whole ledger every time.
    wallet_balance: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.b2c)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    addresses: Mapped[list["Address"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    b2b_application: Mapped["B2BApplication | None"] = relationship(
        back_populates="user", uselist=False, foreign_keys="B2BApplication.user_id"
    )
    orders: Mapped[list["Order"]] = relationship(back_populates="user")
    cart: Mapped["Cart | None"] = relationship(back_populates="user", uselist=False)


class B2BApplication(Base):
    """
    KYC form submitted the first time a user selects B2B.
    Reviewed by admin -> on approval, credentials become active (user.role flips usable,
    or a separate flag is_credentialed is set) and status becomes approved.
    """
    __tablename__ = "b2b_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)

    business_name: Mapped[str] = mapped_column(String(200))
    contact_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(20))
    aadhar_no: Mapped[str] = mapped_column(String(20))
    pan_no: Mapped[str] = mapped_column(String(20))
    gst_no: Mapped[str] = mapped_column(String(20))
    driving_licence_no: Mapped[str | None] = mapped_column(String(30), nullable=True)
    trade_licence_no: Mapped[str] = mapped_column(String(30))

    # uploaded document file paths/urls
    aadhar_doc_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    pan_doc_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gst_doc_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    trade_licence_doc_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[B2BApplicationStatus] = mapped_column(
        Enum(B2BApplicationStatus), default=B2BApplicationStatus.pending
    )
    admin_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="b2b_application", foreign_keys=[user_id])


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(20))
    line1: Mapped[str] = mapped_column(String(255))
    line2: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100))
    state: Mapped[str] = mapped_column(String(100))
    pincode: Mapped[str] = mapped_column(String(10))
    latitude: Mapped[float | None] = mapped_column(nullable=True)
    longitude: Mapped[float | None] = mapped_column(nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship(back_populates="addresses")


class OtpCode(Base):
    """
    Short-lived SMS OTP codes for customer login. Not tied to a User row —
    a phone number can request/verify an OTP before any account exists yet
    (verify-otp creates the User on first successful login).
    """
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), index=True)
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(default=0)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
