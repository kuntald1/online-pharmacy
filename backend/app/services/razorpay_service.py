import hmac
import hashlib

import razorpay

from app.core.config import settings

_client = None


def get_client() -> "razorpay.Client":
    global _client
    if _client is None:
        _client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    return _client


def create_razorpay_order(amount_rupees: float, receipt: str) -> dict:
    client = get_client()
    return client.order.create(
        {
            "amount": int(round(amount_rupees * 100)),  # paise
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
        }
    )


def verify_signature(razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str) -> bool:
    payload = f"{razorpay_order_id}|{razorpay_payment_id}"
    generated = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(generated, razorpay_signature)


def refund_payment(razorpay_payment_id: str, amount_rupees: float, notes: dict | None = None) -> dict:
    """Refunds a specific amount back to whatever payment method was
    originally used (card/UPI/netbanking) — Razorpay routes it automatically,
    there's no separate 'which channel' decision to make on our end. Amount
    is in rupees here; Razorpay's API wants paise, same conversion as
    create_razorpay_order."""
    client = get_client()
    return client.payment.refund(
        razorpay_payment_id,
        {"amount": int(round(amount_rupees * 100)), "notes": notes or {}},
    )
