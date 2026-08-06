from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.wallet import WalletTransaction
from app.models.enums import WalletTransactionReason
from app.schemas.wallet import WalletBalanceOut, WalletTransactionOut, WalletTopupCreate, WalletTopupVerify
from app.api.deps import get_current_user
from app.services.wallet_service import credit_wallet
from app.services.razorpay_service import create_razorpay_order, verify_signature, get_client
from app.core.config import settings

router = APIRouter(prefix="/api/wallet", tags=["wallet"])


@router.get("/balance", response_model=WalletBalanceOut)
def get_balance(user: User = Depends(get_current_user)):
    return WalletBalanceOut(balance=float(user.wallet_balance))


@router.get("/transactions", response_model=list[WalletTransactionOut])
def list_transactions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(WalletTransaction)
        .filter(WalletTransaction.user_id == user.id)
        .order_by(WalletTransaction.created_at.desc())
        .all()
    )
    return [
        WalletTransactionOut(
            id=r.id, type=r.type.value, reason=r.reason.value, amount=float(r.amount),
            balance_after=float(r.balance_after), reference_order_id=r.reference_order_id,
            note=r.note, created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("/topup/create-order")
def create_topup_order(payload: WalletTopupCreate, user: User = Depends(get_current_user)):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount greater than zero")
    if payload.amount > 50000:
        raise HTTPException(status_code=400, detail="For amounts above ₹50,000, please contact support")
    try:
        order = create_razorpay_order(payload.amount, receipt=f"wallet-topup-{user.id}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Couldn't start the payment: {e}")
    return {"razorpay_order_id": order["id"], "amount": payload.amount, "key_id": settings.RAZORPAY_KEY_ID}


@router.post("/topup/verify", response_model=WalletBalanceOut)
def verify_topup(payload: WalletTopupVerify, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    # Re-fetch the order from Razorpay itself rather than trusting a
    # client-supplied amount — the signature proves the payment is genuine,
    # but not that the amount we're about to credit matches what was
    # actually paid, unless we check Razorpay's own record of it.
    try:
        client = get_client()
        razorpay_order = client.order.fetch(payload.razorpay_order_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Couldn't confirm the payment with Razorpay: {e}")
    if razorpay_order.get("status") != "paid":
        raise HTTPException(status_code=400, detail="Payment not confirmed as paid yet")
    amount_rupees = razorpay_order["amount"] / 100

    credit_wallet(
        db, user, amount_rupees, WalletTransactionReason.topup,
        note="Wallet top-up via Razorpay", razorpay_payment_id=payload.razorpay_payment_id,
    )
    db.commit()
    db.refresh(user)
    return WalletBalanceOut(balance=float(user.wallet_balance))
