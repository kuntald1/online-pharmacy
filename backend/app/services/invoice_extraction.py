"""
Extracts structured line items from a photographed/scanned supplier invoice
using Claude's vision (image) or document (PDF) understanding. This is
read-only extraction — it never writes to the database itself. Matching the
extracted rows to existing products, and applying stock/batch updates, both
happen afterward (see routes/products_import.py: apply_invoice), with an
admin reviewing every row in between. An LLM misreading a quantity or SKU on
a real invoice is a realistic failure mode, not a hypothetical one — nothing
here should auto-apply without a human looking at it first.
"""
import base64
import json

from anthropic import Anthropic

from app.core.config import settings

# Sonnet is the right tier here: this is a bounded extraction task (read an
# invoice, return JSON), not open-ended agentic work — no need for a larger,
# slower, more expensive model.
MODEL = "claude-sonnet-5"

EXTRACTION_PROMPT = """You are looking at a photo or scan of a supplier invoice for a pharmacy/medicine business.

Extract every line item (product) on the invoice into a JSON array. For each line item, extract:
- "name": the product name exactly as written on the invoice
- "sku": any product code/SKU visible on the invoice, or null if none
- "quantity": the quantity received, as a number
- "unit_cost": the price paid per unit, as a number, or null if not visible
- "mrp": the MRP printed for this item, as a number, or null if not visible
- "batch_number": the batch/lot number for this item, or null if not visible
- "expiry_date": the expiry date for this item in YYYY-MM-DD format, or null if not visible (if only month/year is printed, use the first day of that month)
- "manufacturer": the manufacturer name for this item, or null if not visible

Also extract, at the top level (not per-item):
- "supplier_name": the invoice's seller/supplier name, or null
- "invoice_number": the invoice number, or null
- "invoice_date": the invoice date in YYYY-MM-DD format, or null

Respond with ONLY a single JSON object of this exact shape, no markdown fences, no commentary:
{"supplier_name": ..., "invoice_number": ..., "invoice_date": ..., "line_items": [...]}

If you cannot read the invoice clearly enough to extract anything, respond with:
{"supplier_name": null, "invoice_number": null, "invoice_date": null, "line_items": [], "error": "brief reason"}
"""


class InvoiceExtractionError(Exception):
    pass


def extract_invoice(file_bytes: bytes, content_type: str) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        raise InvoiceExtractionError(
            "ANTHROPIC_API_KEY isn't set on this server yet — invoice extraction needs it configured in .env"
        )

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
        raise InvoiceExtractionError(f"Unsupported file type '{content_type}' — upload a JPG, PNG, WEBP, or PDF")

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [content_block, {"type": "text", "text": EXTRACTION_PROMPT}],
            }],
        )
    except Exception as e:
        raise InvoiceExtractionError(f"Couldn't reach the extraction service: {e}")

    text = "".join(block.text for block in response.content if block.type == "text").strip()
    # Strip markdown fences if the model added them despite instructions —
    # cheap insurance, doesn't hurt if they're already absent.
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise InvoiceExtractionError("The extraction service returned something that wasn't valid JSON — try a clearer photo/scan")

    data.setdefault("line_items", [])
    return data
