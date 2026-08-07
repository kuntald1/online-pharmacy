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
import logging
import re

from anthropic import Anthropic
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.catalog import Product, ProductPricing, Brand
from app.models.enums import PricingChannel

logger = logging.getLogger("visual_search")

MODEL = "claude-sonnet-5"

VISUAL_SEARCH_PROMPT = """You are looking at a photo of a medicine, health product, or its packaging \
(box, strip, bottle, label). Identify what product this is from what's visible.

Give a SHORT, concise name — the way it would appear as a catalog product name, e.g. \
"Novaclav 625" or "Amoxycillin 650mg Capsule" — brand name and/or strength/pack size only. \
Do NOT include a parenthetical explanation, generic/salt-name breakdown, or full description; \
that level of detail makes the guess useless for a catalog search.

Respond with ONLY a single JSON object, no markdown fences, no commentary:
{"product_name_guess": "<short catalog-style name>", "confidence": "high|medium|low"}

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


def _clean_guess(text: str) -> str:
    """Defensive safety net independent of prompt compliance — strips
    parenthetical detail and anything after a comma, since a verbose guess
    (e.g. 'Novaclav-625 (Amoxycillin and Potassium Clavulanate Tablets IP,
    625mg, 10's Pack)') will never substring-match a real catalog name like
    'Novaclav 625 Tablet 10's', even when the identification itself was
    completely correct."""
    text = re.sub(r"\([^)]*\)", "", text)
    text = text.split(",")[0]
    return text.strip()


def _find_matches(db: Session, query: str, channels: list[PricingChannel], limit: int = 8) -> list[Product]:
    """Word-based match (every word must appear somewhere in the product
    name OR its linked brand name, in any order) rather than one
    whole-string substring match against Product.name alone.

    This catalog stores brand and product name separately (Product.brand_id
    -> Brand.name) — a photo of the box very often reads the *brand*
    ('Novaclav'), which may not appear anywhere in Product.name if that
    field holds the generic/salt name instead ('Amoxycillin & Potassium
    Clavulanate 625'). Searching only Product.name would then silently miss
    a completely correct identification. Matching against either field
    (per word) covers both brand-named and generic-named catalog
    conventions without knowing in advance which one a given pharmacy uses.

    Still deliberately non-fuzzy/non-phonetic — same philosophy as
    prescription matching: a failure should stay visible (few/no matches)
    rather than hidden behind a confident-looking wrong match."""
    query = _clean_guess(query) if query else query
    if not query or not query.strip():
        return []

    words = [w for w in re.split(r"[\s\-/]+", query.strip()) if w]
    if not words:
        return []

    logger.warning(f"[visual-search] cleaned query={query!r} words={words} channels={channels}")

    conditions = [
        or_(Product.name.ilike(f"%{w}%"), Brand.name.ilike(f"%{w}%"))
        for w in words
    ]
    candidates = (
        db.query(Product)
        .join(ProductPricing)
        .outerjoin(Brand, Product.brand_id == Brand.id)
        .options(joinedload(Product.pricing))
        .filter(
            Product.is_active == True,  # noqa: E712
            ProductPricing.channel.in_(channels),
            ProductPricing.is_active == True,  # noqa: E712
            and_(*conditions),
        )
        .distinct()
        .limit(limit)
        .all()
    )
    logger.warning(f"[visual-search] found {len(candidates)} candidates: {[p.name for p in candidates]}")

    # Diagnostic only, doesn't affect the response: if the strict AND-of-words
    # search found nothing, check whether a name/brand match exists AT ALL
    # (ignoring channel/active filters) — tells us in the logs whether this
    # was a naming mismatch or a channel/active-status mismatch.
    if not candidates:
        any_name_hit = (
            db.query(Product)
            .outerjoin(Brand, Product.brand_id == Brand.id)
            .filter(and_(*conditions))
            .limit(5)
            .all()
        )
        logger.warning(
            f"[visual-search] zero results with channel/active filters — "
            f"without those filters, name/brand match found: {[(p.name, p.is_active) for p in any_name_hit]}"
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
