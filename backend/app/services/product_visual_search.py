"""
Identifies a product from a photo (e.g. a medicine strip/box held up to the
camera) using Claude vision, then searches the catalog by the guessed name.

Same honesty-about-uncertainty framing as prescription_extraction.py: this
returns a best-guess name and a confidence level, and never silently
resolves to a single product — matched candidates are offered, the person
picks. A wrong "confident" guess here would send someone to browse or buy
the wrong medicine, which is a real risk, not just an annoying miss.
"""
import base64
import json

from anthropic import Anthropic
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.catalog import Product, ProductPricing
from app.models.enums import PricingChannel

MODEL = "claude-sonnet-5"

VISUAL_SEARCH_PROMPT = """You are looking at a photo of a medicine, health product, or its packaging \
(box, strip, bottle, label). Identify what product this is, as specifically as you can from \
what's visible — brand name, generic/salt name, strength/dosage, and pack size if legible.

Respond with ONLY a single JSON object, no markdown fences, no commentary:
{"product_name_guess": "<your best guess, e.g. 'Amoxycillin 650mg Capsule'>", "confidence": "high|medium|low"}

If the photo doesn't show a medicine/health product clearly enough to identify, respond with:
{"product_name_guess": null, "confidence": "low", "error": "brief reason"}
"""


class VisualSearchError(Exception):
    pass


def _call_claude(file_bytes: bytes, content_type: str) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        raise VisualSearchError("ANTHROPIC_API_KEY isn't set on this server yet")

    if content_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        raise VisualSearchError(f"Unsupported file type '{content_type}' — upload a JPG, PNG, WEBP, or GIF")

    content_block = {
        "type": "image",
        "source": {"type": "base64", "media_type": content_type, "data": base64.b64encode(file_bytes).decode()},
    }

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": [content_block, {"type": "text", "text": VISUAL_SEARCH_PROMPT}]}],
        )
    except Exception as e:
        raise VisualSearchError(f"Couldn't reach the identification service: {e}")

    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise VisualSearchError("Couldn't read that clearly enough — try a clearer, well-lit photo")

    return data


def _find_matches(db: Session, query: str, channels: list[PricingChannel], limit: int = 8) -> list[Product]:
    """Plain substring match against active products in the requested
    channel(s) — same deliberate choice as prescription matching: no
    fuzzy/phonetic matching layered on top of an already-uncertain visual
    guess, so failures stay visible (few/no matches) instead of hidden
    (a confident-looking wrong match)."""
    if not query or not query.strip():
        return []
    like = f"%{query.strip()}%"
    candidates = (
        db.query(Product)
        .join(ProductPricing)
        .options(joinedload(Product.pricing))
        .filter(
            Product.is_active == True,  # noqa: E712
            ProductPricing.channel.in_(channels),
            ProductPricing.is_active == True,  # noqa: E712
            Product.name.ilike(like),
        )
        .distinct()
        .limit(limit)
        .all()
    )
    for p in candidates:
        p.pricing = [pr for pr in p.pricing if pr.channel in channels]
    return candidates


def identify_and_match(db: Session, file_bytes: bytes, content_type: str, channels: list[PricingChannel]) -> dict:
    data = _call_claude(file_bytes, content_type)
    guess = data.get("product_name_guess")
    matches = _find_matches(db, guess, channels) if guess else []
    return {
        "product_name_guess": guess,
        "confidence": data.get("confidence") or "low",
        "error": data.get("error"),
        "matches": matches,
    }
