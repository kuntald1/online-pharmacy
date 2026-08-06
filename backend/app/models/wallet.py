from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, Numeric, Enum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import WalletTransactionType, WalletTransactionReason


class WalletTransaction(Base):
    """Append-only ledger — every credit/debit to a user's wallet gets a row
    here, never edited or deleted after the fact. User.wallet_balance is
    kept in sync as a convenience running total, but this table is the real
    record if the two ever need reconciling."""
    __tablename__ = "wallet_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    type: Mapped[WalletTransactionType] = mapped_column(Enum(WalletTransactionType))
    reason: Mapped[WalletTransactionReason] = mapped_column(Enum(WalletTransactionReason))
    amount: Mapped[float] = mapped_column(Numeric(10, 2))
    balance_after: Mapped[float] = mapped_column(Numeric(10, 2))
    reference_order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), nullable=True)
    reference_return_id: Mapped[int | None] = mapped_column(ForeignKey("return_requests.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    razorpay_payment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)  # for online top-ups
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship()
