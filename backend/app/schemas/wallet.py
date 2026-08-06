from datetime import datetime
from pydantic import BaseModel


class WalletBalanceOut(BaseModel):
    balance: float


class WalletTransactionOut(BaseModel):
    id: int
    type: str
    reason: str
    amount: float
    balance_after: float
    reference_order_id: int | None = None
    note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class WalletTopupCreate(BaseModel):
    amount: float


class WalletTopupVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
