"""
SMS OTP delivery via Twilio. Credentials come from environment variables
only — never hardcoded, never logged. Uses a real Twilio account (trial or
paid); on a trial account, Twilio only delivers to phone numbers you've
manually verified in the Twilio console, and messages carry a
"Sent from a Twilio trial account" prefix. That's a Twilio-side limitation
that goes away once the account is upgraded — no code change needed here.
"""
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_COUNTRY_CODE = "91"  # India — this system's only market today


class SmsNotConfigured(Exception):
    pass


def to_e164(phone: str) -> str:
    """Twilio requires E.164 (+<country code><number>, digits only after the
    +). Numbers typed/stored without a country code (e.g. '9732609965')
    aren't valid E.164 — Twilio's API can still accept the call and queue
    the message, then fail delivery asynchronously with no visible error in
    our own request/response cycle. Normalizing here closes that gap."""
    digits = "".join(ch for ch in phone.strip() if ch.isdigit() or ch == "+")
    if digits.startswith("+"):
        return digits
    if digits.startswith("00"):
        return "+" + digits[2:]
    # A 10-digit number with no country code — assume the default market.
    if len(digits) == 10:
        return f"+{DEFAULT_COUNTRY_CODE}{digits}"
    # Already has a country code prefix but no '+' (e.g. '919732609965')
    return f"+{digits}"


def send_otp_sms(phone: str, code: str) -> None:
    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_FROM_NUMBER]):
        raise SmsNotConfigured(
            "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER must all be set"
        )

    from twilio.rest import Client  # imported lazily so the app can start without twilio configured

    from_number = settings.TWILIO_FROM_NUMBER
    # Twilio requires From and To to be on the same channel. If the sender
    # is a WhatsApp number ("whatsapp:+1..."), the recipient must be
    # addressed the same way, or Twilio rejects the request outright
    # (HTTP 400, "Invalid From and To pair"). Plain SMS numbers need no
    # prefix on either side.
    is_whatsapp = from_number.strip().lower().startswith("whatsapp:")
    to_number = to_e164(phone)
    if is_whatsapp:
        to_number = f"whatsapp:{to_number}"

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    client.messages.create(
        body=f"Your Healthycian verification code is {code}. It expires in 10 minutes. Don't share this code with anyone.",
        from_=from_number,
        to=to_number,
    )
    logger.info(f"OTP SMS dispatched to {phone[:5]}***")  # never log the full phone or the code
