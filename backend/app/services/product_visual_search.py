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
(box, strip, bottle, label). Packaging usually shows BOTH a brand name and a generic/salt name — \
extract both separately, since a pharmacy catalog might be searchable by either one and we don't \
know in advance which.

- "brand_name_guess": the brand/trade name as printed, with strength/pack size if legible \
  (e.g. "Novaclav 625", "Crocin 500mg"). Null if no brand name is visible (generic-only packaging).
- "generic_name_guess": the generic/salt/composition name with strength (e.g. "Amoxycillin \
  Clavulanate 625mg", "Paracetamol 500mg"). Null if not legible.

Keep both SHORT — just the name and strength, not a full sentence or parenthetical explanation.

Respond with ONLY a single JSON object, no markdown fences, no commentary:
{"brand_name_guess": "<short name or null>", "generic_name_guess": "<short name or null>", "confidence": "high|medium|low"}

If the photo doesn't show a medicine/health product clearly enough to identify, respond with:
{"brand_name_guess": null, "generic_name_guess": null, "confidence": "low", "error": "brief reason"}
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


STOPWORDS = {"and", "with", "plus", "&", "the", "a", "an", "of", "for"}


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

    all_words = [w for w in re.split(r"[\s\-/]+", query.strip()) if w]
    # Grammatical filler ("and", "with", ...) is never how a product is
    # actually identified — requiring it present, same as any other word,
    # can silently block an otherwise-correct match just because "and"
    # doesn't literally appear in a catalog name.
    words = [w for w in all_words if w.lower() not in STOPWORDS] or all_words
    if not words:
        return []

    logger.warning(f"[visual-search] cleaned query={query!r} words={words} channels={channels}")

    candidates = _run_word_match(db, words, channels, limit)

    # If the exact word set (including strength, e.g. '625mg') found
    # nothing, the strength on the box may simply differ from what this
    # pharmacy stocks (a real, common case — not a bug). Retrying with just
    # the drug-name words (dropping anything with a digit) surfaces a
    # same-family product instead of a dead end; the person can still see
    # it's a different strength and decide for themselves rather than
    # getting nothing at all.
    name_only_words = [w for w in words if not any(c.isdigit() for c in w)]

    if not candidates and name_only_words and name_only_words != words:
        logger.warning(f"[visual-search] retrying without strength: {name_only_words}")
        candidates = _run_word_match(db, name_only_words, channels, limit)

    # Last resort: just the single most prominent term (typically the
    # primary drug name, e.g. 'Amoxycillin' out of 'Amoxycillin Potassium
    # Clavulanate'). This catalog may simply not stock the exact
    # combination/strength on the box at all — surfacing the closest
    # same-family product beats a dead end, and it's still shown as a
    # candidate to review, never auto-selected.
    if not candidates and name_only_words:
        primary_word = name_only_words[0]
        if [primary_word] != name_only_words:
            logger.warning(f"[visual-search] retrying with primary term only: {primary_word!r}")
            candidates = _run_word_match(db, [primary_word], channels, limit)

    return candidates


def _run_word_match(db: Session, words: list[str], channels: list[PricingChannel], limit: int) -> list[Product]:
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
    brand_guess = data.get("brand_name_guess")
    generic_guess = data.get("generic_name_guess")

    # Try brand first (usually more specific/distinctive), fall back to
    # generic if the brand isn't in the catalog — this pharmacy's data might
    # use either convention, and a box often shows both, so don't stop
    # after only trying one of them.
    matches = []
    matched_via = None
    if brand_guess:
        matches = _find_matches(db, brand_guess, channels)
        if matches:
            matched_via = "brand"
    if not matches and generic_guess:
        matches = _find_matches(db, generic_guess, channels)
        if matches:
            matched_via = "generic"

    logger.warning(f"[visual-search] brand={brand_guess!r} generic={generic_guess!r} matched_via={matched_via} count={len(matches)}")

    # Prefer showing whichever guess actually found something; otherwise
    # show the brand guess if there is one, else the generic one — always
    # give the person *something* to see even when nothing matched.
    display_guess = (brand_guess if matched_via == "brand" else generic_guess) or brand_guess or generic_guess

    return {
        "product_name_guess": display_guess,
        "confidence": data.get("confidence") or "low",
        "error": data.get("error"),
        "matches": matches,
    }
