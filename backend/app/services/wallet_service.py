from sqlalchemy.orm import Session

from app.models.user import User
from app.models.wallet import WalletTransaction
from app.models.enums import WalletTransactionType, WalletTransactionReason


def credit_wallet(
    db: Session,
    user: User,
    amount: float,
    reason: WalletTransactionReason,
    reference_order_id: int | None = None,
    reference_return_id: int | None = None,
    note: str | None = None,
    razorpay_payment_id: str | None = None,
) -> WalletTransaction:
    """The only place User.wallet_balance is ever changed — every call site
    (top-up, return refund, admin adjustment) goes through here so the
    running balance and the ledger can never drift apart."""
    user.wallet_balance = float(user.wallet_balance) + amount
    txn = WalletTransaction(
        user_id=user.id,
        type=WalletTransactionType.credit,
        reason=reason,
        amount=amount,
        balance_after=user.wallet_balance,
        reference_order_id=reference_order_id,
        reference_return_id=reference_return_id,
        note=note,
        razorpay_payment_id=razorpay_payment_id,
    )
    db.add(txn)
    return txn


def debit_wallet(
    db: Session,
    user: User,
    amount: float,
    reason: WalletTransactionReason,
    reference_order_id: int | None = None,
    note: str | None = None,
) -> WalletTransaction:
    if float(user.wallet_balance) < amount:
        raise ValueError("Insufficient wallet balance")
    user.wallet_balance = float(user.wallet_balance) - amount
    txn = WalletTransaction(
        user_id=user.id,
        type=WalletTransactionType.debit,
        reason=reason,
        amount=amount,
        balance_after=user.wallet_balance,
        reference_order_id=reference_order_id,
        note=note,
    )
    db.add(txn)
    return txn
