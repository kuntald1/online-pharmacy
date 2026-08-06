import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_via_twilio(to_number: str, message: str) -> bool:
    """Reuses the exact same Twilio credentials already configured for OTP
    delivery (app/services/sms.py) — no separate WhatsApp setup needed.

    Important caveat: if TWILIO_FROM_NUMBER is Twilio's public WhatsApp
    Sandbox number (whatsapp:+14155238886), Twilio will only deliver to
    phone numbers that have first sent the sandbox join code to that number
    from WhatsApp. That's fine for testing with your own number, but real
    customers won't have joined it — for actual production delivery to
    arbitrary customers, this needs either a Twilio-hosted WhatsApp Business
    sender or your own number approved through Meta, which involves a
    business verification process (typically a few days), not just an env
    var change.
    """
    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM_NUMBER]):
        return False

    from twilio.rest import Client  # imported lazily so the app can start without twilio configured
    from app.services.sms import to_e164

    from_number = settings.TWILIO_FROM_NUMBER
    is_whatsapp_sender = from_number.strip().lower().startswith("whatsapp:")
    to = to_e164(to_number)
    if is_whatsapp_sender:
        to = f"whatsapp:{to}"

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        client.messages.create(body=message, from_=from_number, to=to)
        return True
    except Exception as e:
        logger.warning(f"Twilio WhatsApp send failed: {e}")
        return False


def _send_via_meta_cloud_api(to_number: str, message: str) -> bool:
    """Optional alternative path — only used if WHATSAPP_API_URL and
    WHATSAPP_ACCESS_TOKEN are explicitly set (Meta's own Cloud API, separate
    from Twilio). Most setups won't need this; Twilio is tried first."""
    if not settings.WHATSAPP_API_URL or not settings.WHATSAPP_ACCESS_TOKEN:
        return False

    payload = {
        "messaging_product": "whatsapp",
        "to": to_number,
        "type": "text",
        "text": {"body": message},
    }
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}"}

    try:
        resp = httpx.post(settings.WHATSAPP_API_URL, json=payload, headers=headers, timeout=10)
        return resp.status_code < 300
    except httpx.HTTPError:
        return False


def send_whatsapp_message(to_number: str, message: str) -> bool:
    """Tries Twilio first (reuses existing OTP credentials), then Meta's
    Cloud API if that's configured instead. Fails silently (returns False)
    either way so a WhatsApp outage never blocks the actual business flow —
    the CNF lead/order/application is still saved regardless."""
    if _send_via_twilio(to_number, message):
        return True
    return _send_via_meta_cloud_api(to_number, message)


def notify_admin_of_cnf_lead(lead) -> bool:
    message = (
        f"New CNF request on Healthycian\n"
        f"Name: {lead.name}\n"
        f"Contact: {lead.contact_no}\n"
        f"Business type: {lead.business_type or '-'}\n"
        f"Location: {lead.location or '-'}"
    )
    return send_whatsapp_message(settings.ADMIN_WHATSAPP_NUMBER, message)


def notify_customer_of_order(phone: str, order_no: str, total: float, items: list[tuple[str, int]]) -> bool:
    """Sent once an order is actually confirmed — for COD that's immediately
    at checkout, for Razorpay that's after payment verification succeeds
    (never at order creation, since a Razorpay order can still fail/be
    abandoned before payment goes through)."""
    item_lines = "\n".join(f"- {name} x{qty}" for name, qty in items)
    message = (
        f"Your Healthycian order {order_no} is confirmed!\n\n"
        f"{item_lines}\n\n"
        f"Total: Rs.{total:.2f}\n"
        f"We'll notify you when it ships. Thanks for shopping with us!"
    )
    return send_whatsapp_message(phone, message)
