"""
Invoice extraction service. Parses a wholesaler invoice image into
structured line items — the "expected" data that strip scanning later
gets reconciled against. Follows the same Claude-calling pattern as
prescription_extraction.py (raw JSON in the text response, not forced
tool-use) so both services look native to this codebase.
"""
import base64
import json

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.enums import PackType

MODEL = "claude-haiku-4-5-20251001"

EXTRACTION_PROMPT = """You are reading a wholesaler pharmacy invoice (GST invoice) image. Extract every product line item exactly as printed - do not skip any row, and do not merge two different batches of the same product into one row (they must stay as separate line items, since each batch needs separate tracking).

For the "pack" field, read the Pack column exactly as printed (e.g. "10S", "100ML", "10,S", "120"). Classify pack_type as follows:
- "strip": pack ends with S/s (e.g. "10S", "15S") - the medicine comes in tablet strips, and qty is the number of strips ordered.
- "bottle": pack includes ML (e.g. "100ML", "200 ML") - liquid medicine in bottles.
- "unit": pack is a plain number with no S suffix and no ML (e.g. "120" capsules, "10 TAB") - loose countable units, not strip-tracked.
- "other": anything that doesn't clearly fit the above.

If pack_type is "strip", also extract tablets_per_strip as the number immediately before the S (e.g. "10S" -> 10). Omit this field otherwise.

Respond with ONLY a single JSON object of this exact shape, no markdown fences, no commentary:
{
  "wholesaler_name": ...,
  "invoice_no": ...,
  "invoice_date": ...,
  "line_items": [
    {"product_name": ..., "batch_no": ..., "exp_date": ..., "pack": ..., "pack_type": ..., "tablets_per_strip": ..., "qty": ...},
    ...
  ]
}

Do not guess values you cannot read clearly - use null for that field rather than fabricating data.
If the image doesn't look like an invoice at all, respond with:
{"wholesaler_name": null, "invoice_no": null, "invoice_date": null, "line_items": [], "error": "brief reason"}
"""


class StockVerificationInvoiceExtractionError(Exception):
    pass


def _call_claude(file_bytes: bytes, content_type: str) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        raise StockVerificationInvoiceExtractionError("ANTHROPIC_API_KEY isn't set on this server yet")

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
        raise StockVerificationInvoiceExtractionError(f"Unsupported file type '{content_type}' — upload a JPG, PNG, WEBP, or PDF")

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": [content_block, {"type": "text", "text": EXTRACTION_PROMPT}]}],
        )
    except Exception as e:
        raise StockVerificationInvoiceExtractionError(f"Couldn't reach the extraction service: {e}")

    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise StockVerificationInvoiceExtractionError("Couldn't read that clearly enough — try a clearer, well-lit photo")

    data.setdefault("line_items", [])
    return data


def extract_and_save_invoice_for_verification(db: Session, uploaded_by_id: int, file_bytes: bytes, content_type: str) -> Invoice:
    """Extracts invoice data via Claude and persists it as Invoice +
    InvoiceLineItem rows. The photo itself is the caller's responsibility
    to delete after this returns — matching the same
    stage-then-delete-after-success pattern as strip scanning."""
    data = _call_claude(file_bytes, content_type)
    if data.get("error"):
        raise StockVerificationInvoiceExtractionError(data["error"])

    invoice = Invoice(
        uploaded_by_id=uploaded_by_id,
        wholesaler_name=data.get("wholesaler_name"),
        invoice_no=data.get("invoice_no"),
        invoice_date=data.get("invoice_date"),
        image_path=None,  # never persisted — photo deleted by caller after this call succeeds
    )
    db.add(invoice)
    db.flush()  # so invoice.id is available for the line items below

    for item in data.get("line_items", []):
        pack_type_raw = item.get("pack_type") or "other"
        try:
            pack_type = PackType(pack_type_raw)
        except ValueError:
            pack_type = PackType.other

        db.add(InvoiceLineItem(
            invoice_id=invoice.id,
            product_name=item.get("product_name") or "",
            batch_no=item.get("batch_no"),
            exp_date=item.get("exp_date"),
            pack=item.get("pack") or "",
            pack_type=pack_type,
            tablets_per_strip=item.get("tablets_per_strip"),
            qty=item.get("qty") or 0,
        ))

    db.commit()
    db.refresh(invoice)
    return invoice
