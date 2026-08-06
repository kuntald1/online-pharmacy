"""
Reads a photographed/scanned prescription (often handwritten) and extracts
candidate medicine names, then matches each against the catalog.

Critical framing, not just a comment: doctors' handwriting is frequently
ambiguous even to trained pharmacists, and a wrong drug-name guess here is a
real safety issue, not a cosmetic bug. So this module is built to be honest
about uncertainty (a "confidence" field per item, allowed to say "low") and
never resolves ambiguity by picking the most likely product — that decision
always stays with the person reviewing the results, matched candidates are
offered, never auto-selected upstream of this module.
"""
import base64
import json
import re

from anthropic import Anthropic
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.catalog import Product, ProductPricing
from app.models.enums import PricingChannel

MODEL = "claude-sonnet-5"

EXTRACTION_PROMPT = """You are looking at a photo or scan of a doctor's prescription, which may be handwritten
and may be difficult to read. Your job is to extract what medicines were prescribed — being
HONEST about uncertainty is more important than sounding confident. If handwriting is
ambiguous, still give your best guess but mark it as low confidence rather than omitting it
or inventing a clean-looking name you're not actually sure about.

Extract into a JSON array, one entry per medicine line on the prescription:
- "raw_text": transcribe the line exactly as best you can read it (dosage, frequency, duration if present)
- "medicine_name_guess": just the medicine name portion (e.g. "Amoxycillin 650mg"), or null if truly illegible
- "confidence": "high" (clearly printed/typed or very legible handwriting), "medium" (readable but some doubt), or "low" (a guess — handwriting is unclear)

Also extract, at the top level (not per-item), if visible:
- "patient_name"
- "doctor_name"
- "prescription_date" in YYYY-MM-DD format

Respond with ONLY a single JSON object of this exact shape, no markdown fences, no commentary:
{"patient_name": ..., "doctor_name": ..., "prescription_date": ..., "items": [...]}

If the image doesn't look like a prescription at all, or nothing is legible, respond with:
{"patient_name": null, "doctor_name": null, "prescription_date": null, "items": [], "error": "brief reason"}
"""


class PrescriptionExtractionError(Exception):
    pass


def _call_claude(file_bytes: bytes, content_type: str) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        raise PrescriptionExtractionError("ANTHROPIC_API_KEY isn't set on this server yet")

    if content_type == "application/pdf":
        content_block = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": base64.b64encode(file_bytes).decode()},
        }
    elif content_type in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        content_block = {
            "type": "image",
            "source": {"type": "base64", "media_type": content_type, "data": base64.b64encode(file_bytes).decode()},
        }
    else:
        raise PrescriptionExtractionError(f"Unsupported file type '{content_type}' — upload a JPG, PNG, WEBP, or PDF")

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": [content_block, {"type": "text", "text": EXTRACTION_PROMPT}]}],
        )
    except Exception as e:
        raise PrescriptionExtractionError(f"Couldn't reach the extraction service: {e}")

    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise PrescriptionExtractionError("Couldn't read that clearly enough — try a clearer, well-lit photo")

    data.setdefault("items", [])
    return data


def _estimate_quantity_needed(raw_text: str) -> int | None:
    """Rough estimate of total units needed, from the common shorthand
    'M-A-E x N days' (morning-afternoon-evening × days), e.g. '1-0-1 x 5
    days' = 2 per day × 5 days = 10. Returns None when that specific
    pattern isn't present (e.g. 'SOS' / as-needed dosing, or an
    unrecognized format) — there's no reliable total to estimate in those
    cases, and guessing one would be worse than admitting we don't know."""
    if not raw_text:
        return None
    match = re.search(r"(\d+)\s*-\s*(\d+)\s*-\s*(\d+)\s*[x×]\s*(\d+)\s*day", raw_text, re.IGNORECASE)
    if not match:
        return None
    morning, afternoon, evening, days = (int(g) for g in match.groups())
    return (morning + afternoon + evening) * days


def _extract_pack_size(product_name: str) -> int | None:
    """Pulls a numeric pack size out of a product name — '10 capsules',
    '15 Capsules', "10'S", '30 tablets', etc. Returns None if the name
    doesn't follow a recognizable pattern (nothing to compare against,
    not an error)."""
    match = re.search(r"(\d+)\s*(?:capsules?|tablets?|caps?|tabs?|'s)\b", product_name, re.IGNORECASE)
    return int(match.group(1)) if match else None


def _find_matches(db: Session, query: str, raw_text: str = "", limit: int = 3) -> list[Product]:
    """Substring match against active B2C products — deliberately not
    fuzzy/phonetic matching. A prescription name guess is already
    uncertain; layering approximate string matching on top of an
    approximate OCR read compounds the chance of surfacing the wrong drug.
    A plain substring match keeps the failure mode visible (few or no
    matches) rather than hidden (a confident-looking wrong match).

    What IS ranked, once the candidate set is found by that plain match:
    - In-stock products always rank above out-of-stock ones — a match the
      customer can't actually buy shouldn't be the pre-selected default.
    - Among same-stock-status candidates, the pack size closest to (but
      not under) the quantity implied by the dosage is preferred — e.g.
      '1-0-1 x 5 days' implies 10 units, so a 10-pack ranks above a
      15-pack, which ranks above a 5-pack (a 5-pack alone doesn't cover
      the course, so it's not excluded, just deprioritized).
    Out-of-stock or size-mismatched candidates are never hidden — only
    reordered — so the customer can still see and pick them if they want.
    """
    if not query or not query.strip():
        return []
    like = f"%{query.strip()}%"
    candidates = (
        db.query(Product)
        .join(ProductPricing)
        .options(joinedload(Product.pricing))
        .filter(
            Product.is_active == True,  # noqa: E712
            ProductPricing.channel == PricingChannel.b2c,
            ProductPricing.is_active == True,  # noqa: E712
            Product.name.ilike(like),
        )
        .distinct()
        .limit(limit * 4)  # widen the pool before ranking and trimming, so a better-ranked match isn't cut off early
        .all()
    )

    needed_qty = _estimate_quantity_needed(raw_text)

    def sort_key(p: Product):
        pricing = next((pr for pr in p.pricing if pr.channel == PricingChannel.b2c and pr.is_active), None)
        in_stock = bool(pricing and pricing.stock and pricing.stock > 0)
        pack_size = _extract_pack_size(p.name)
        if needed_qty and pack_size:
            closeness = (pack_size - needed_qty) if pack_size >= needed_qty else (10_000 + (needed_qty - pack_size))
        else:
            closeness = 5_000  # no size info to compare — neutral, not treated as a mismatch
        return (0 if in_stock else 1, closeness)

    candidates.sort(key=sort_key)
    return candidates[:limit]


def extract_and_match(db: Session, file_bytes: bytes, content_type: str) -> dict:
    data = _call_claude(file_bytes, content_type)
    for item in data.get("items", []):
        query = item.get("medicine_name_guess") or item.get("raw_text") or ""
        item["_matched_products"] = _find_matches(db, query, raw_text=item.get("raw_text") or "")
    return data
