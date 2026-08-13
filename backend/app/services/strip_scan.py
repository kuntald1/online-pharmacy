"""
Strip-by-strip scanning service, redesigned for free-form scanning: an
employee scans strips against ONE invoice, in any order, any medicine.
Matching medicine+batch combinations accumulate as grouped rows (computed
live from StripScanRecord, not stored as a separate counter). Comparing
against what the invoice actually expected happens on demand via
compare_session(), not per-scan.
"""
import base64
import json
from pathlib import Path

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.stock_verification import ScanSession, StripScanRecord
from app.models.invoice import InvoiceLineItem
from app.models.enums import OcrStatus, PackType
from app.api.routes.uploads import UPLOAD_DIR

MODEL = "claude-haiku-4-5-20251001"

STAGING_DIR = UPLOAD_DIR / "strip_scans_staging"
STAGING_DIR.mkdir(parents=True, exist_ok=True)

STRIP_EXTRACTION_PROMPT = """You are looking at a photo of a single medicine strip (blister pack). Read the printed
text and extract, being HONEST about uncertainty rather than guessing confidently:

- "medicine_name": the medicine name as printed on the strip
- "batch_no": the batch number (often labeled "B.No." or "Batch No.")
- "mfg_date": manufacturing date as printed (e.g. "05/2026")
- "exp_date": expiry date as printed (e.g. "04/2029")
- "confidence": "high" (clearly printed, fully legible), "medium" (readable but some doubt),
  or "low" (partially obscured, curved/distorted foil, or a guess)

Respond with ONLY a single JSON object, no markdown fences, no commentary:
{"medicine_name": ..., "batch_no": ..., "mfg_date": ..., "exp_date": ..., "confidence": ...}

If a field is not legible at all, use null for that field rather than guessing a clean-looking value.
If the image doesn't look like a medicine strip, respond with:
{"medicine_name": null, "batch_no": null, "mfg_date": null, "exp_date": null, "confidence": "low", "error": "brief reason"}
"""


class StripScanError(Exception):
    pass


def _upload_to_staging(file_bytes: bytes, session_id: int, sequence_no: int, content_type: str) -> Path:
    ext = "jpg" if content_type == "image/jpeg" else content_type.split("/")[-1]
    session_dir = STAGING_DIR / str(session_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    dest = session_dir / f"{sequence_no}.{ext}"
    dest.write_bytes(file_bytes)
    return dest


def _delete_from_staging(file_path: Path) -> None:
    try:
        file_path.unlink(missing_ok=True)
    except Exception:
        pass  # extracted data is already saved; a periodic sweep of STAGING_DIR is the safety net


def _call_claude(file_bytes: bytes, content_type: str) -> dict:
    if not settings.ANTHROPIC_API_KEY:
        raise StripScanError("ANTHROPIC_API_KEY isn't set on this server yet")

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": content_type, "data": base64.b64encode(file_bytes).decode()}},
                    {"type": "text", "text": STRIP_EXTRACTION_PROMPT},
                ],
            }],
        )
    except Exception as e:
        raise StripScanError(f"Couldn't reach the extraction service: {e}")

    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        raise StripScanError("Couldn't read that clearly enough - try a clearer, well-lit photo")


def scan_strip(db: Session, session_id: int, employee_id: int, file_bytes: bytes, content_type: str) -> StripScanRecord:
    """Scans one strip and saves it as raw evidence. Does NOT do any
    matching against the invoice here — that's deliberately deferred to
    compare_session(), since at scan time we don't know yet whether this
    strip is expected, extra, or belongs to a different box entirely."""
    session_row = db.query(ScanSession).filter(ScanSession.id == session_id).with_for_update().first()
    if not session_row:
        raise StripScanError("Scan session not found")
    if session_row.employee_id != employee_id:
        raise StripScanError("This scan session belongs to a different employee")

    sequence_no = len(session_row.strip_scans) + 1
    staged_path = _upload_to_staging(file_bytes, session_id, sequence_no, content_type)

    try:
        data = _call_claude(file_bytes, content_type)
    except StripScanError:
        raise  # keep the photo staged for a manual retry — don't delete on failure

    ocr_status = OcrStatus.needs_retry if (data.get("error") or data.get("confidence") == "low") else OcrStatus.accepted

    record = StripScanRecord(
        session_id=session_id,
        sequence_no=sequence_no,
        image_path=None,
        extracted_medicine_name=data.get("medicine_name"),
        extracted_batch_no=data.get("batch_no"),
        extracted_mfg_date=data.get("mfg_date"),
        extracted_exp_date=data.get("exp_date"),
        confidence=data.get("confidence"),
        ocr_status=ocr_status,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    if ocr_status == OcrStatus.accepted:
        _delete_from_staging(staged_path)

    return record


def get_grouped_scan_rows(db: Session, session_id: int) -> list[dict]:
    """Groups this session's accepted strip scans by (medicine name, batch
    number) and counts them — this IS the 'Medicine X / Batch Y / Qty N'
    table the employee sees live while scanning. Computed fresh from the
    raw scan records every time, so it can never drift out of sync with
    what was actually scanned."""
    records = (
        db.query(StripScanRecord)
        .filter(StripScanRecord.session_id == session_id, StripScanRecord.ocr_status == OcrStatus.accepted)
        .order_by(StripScanRecord.sequence_no)
        .all()
    )

    groups: dict[tuple[str, str], dict] = {}
    for r in records:
        # Normalize just enough to group sensibly (case/whitespace) without
        # rewriting what was actually read off the strip.
        name_key = (r.extracted_medicine_name or "").strip().lower()
        batch_key = (r.extracted_batch_no or "").strip().lower()
        key = (name_key, batch_key)
        if key not in groups:
            groups[key] = {
                "medicine_name": r.extracted_medicine_name,
                "batch_no": r.extracted_batch_no,
                "mfg_date": r.extracted_mfg_date,
                "exp_date": r.extracted_exp_date,
                "qty": 0,
                "confidence": r.confidence,
            }
        groups[key]["qty"] += 1

    return list(groups.values())


def compare_session(db: Session, session_id: int) -> dict:
    """Reconciles the grouped scan rows against the invoice's line items.
    Matching is done by batch number, not medicine name — batch numbers
    are precise alphanumeric codes, while medicine names read off a strip
    photo vs. an invoice photo can have small spelling/formatting
    differences even when they're clearly the same product. A batch
    number match is a much more reliable signal of "this is the same
    thing" than a fuzzy name match would be."""
    session_row = db.query(ScanSession).filter(ScanSession.id == session_id).first()
    if not session_row:
        raise StripScanError("Scan session not found")

    scanned_rows = get_grouped_scan_rows(db, session_id)
    scanned_by_batch = {(row["batch_no"] or "").strip().lower(): row for row in scanned_rows}
    matched_batch_keys: set[str] = set()

    line_items = (
        db.query(InvoiceLineItem)
        .filter(InvoiceLineItem.invoice_id == session_row.invoice_id, InvoiceLineItem.pack_type == PackType.strip)
        .all()
    )

    comparison_rows = []
    for item in line_items:
        batch_key = (item.batch_no or "").strip().lower()
        scanned = scanned_by_batch.get(batch_key)

        if scanned:
            matched_batch_keys.add(batch_key)
            scanned_qty = scanned["qty"]
            if scanned_qty == item.qty:
                status = "matched"
            elif scanned_qty < item.qty:
                status = "short"
            else:
                status = "excess"
        else:
            scanned_qty = 0
            status = "not_scanned"

        comparison_rows.append({
            "product_name": item.product_name,
            "batch_no": item.batch_no,
            "expected_qty": item.qty,
            "scanned_qty": scanned_qty,
            "status": status,
        })

    # Scanned batches that don't correspond to ANY line item on this
    # invoice — e.g. a strip from a completely different box got mixed in,
    # like the Norfloxacin-vs-Telmikind case seen in testing.
    unexpected_scans = [
        row for key, row in scanned_by_batch.items()
        if key not in matched_batch_keys and key != ""
    ]

    return {
        "session_id": session_id,
        "invoice_id": session_row.invoice_id,
        "rows": comparison_rows,
        "unexpected_scans": unexpected_scans,
    }
