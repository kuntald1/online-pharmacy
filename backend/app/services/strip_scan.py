"""
Strip-by-strip scanning service. Mirrors prescription_extraction.py's
Claude-calling pattern, but adds two things prescriptions didn't need:

1. A local staging folder (same UPLOAD_DIR pattern prescriptions.py uses)
   for the photo - uploaded, sent to Claude, then DELETED from disk right
   after a successful save. Only the extracted text (batch/mfg/exp) is
   kept permanently, in Postgres - the photo itself is never retained.
2. Everything scoped to a session_id, so concurrent scans by different
   employees never share or collide on the same counters.
"""
import base64
import json
from pathlib import Path

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.stock_verification import ScanSession, StripScanRecord
from app.models.invoice import InvoiceLineItem
from app.models.enums import ScanSessionStatus, OcrStatus
from app.api.routes.uploads import UPLOAD_DIR

MODEL = "claude-haiku-4-5-20251001"  # cheap, high-volume, well-formatted strips - see extraction prompt notes below

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
        # Deletion failing shouldn't fail the whole scan - the extracted
        # data is already saved. Worth a periodic cleanup script that
        # sweeps STAGING_DIR for anything older than a day, as a safety
        # net for any files this leaves behind.
        pass


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
    """Scans one strip within an existing session. Caller (the API route)
    is responsible for verifying the session belongs to this employee -
    kept here as a defensive check too, since a session_id could otherwise
    be guessed/reused across employees."""
    session_row = db.query(ScanSession).filter(ScanSession.id == session_id).with_for_update().first()
    if not session_row:
        raise StripScanError("Scan session not found")
    if session_row.employee_id != employee_id:
        raise StripScanError("This scan session belongs to a different employee")
    if session_row.status != ScanSessionStatus.in_progress:
        raise StripScanError("This scan session is already completed")

    sequence_no = session_row.scanned_qty + 1
    staged_path = _upload_to_staging(file_bytes, session_id, sequence_no, content_type)

    try:
        data = _call_claude(file_bytes, content_type)
    except StripScanError:
        # keep the photo in staging for a manual retry - don't delete on failure
        raise

    ocr_status = OcrStatus.needs_retry if (data.get("error") or data.get("confidence") == "low") else OcrStatus.accepted
    batch_mismatch = bool(
        session_row.batch_no_expected
        and data.get("batch_no")
        and data["batch_no"] != session_row.batch_no_expected
    )

    record = StripScanRecord(
        session_id=session_id,
        sequence_no=sequence_no,
        image_path=None,  # never persisted to DB - photo is deleted from disk right after this, see below
        extracted_medicine_name=data.get("medicine_name"),
        extracted_batch_no=data.get("batch_no"),
        extracted_mfg_date=data.get("mfg_date"),
        extracted_exp_date=data.get("exp_date"),
        confidence=data.get("confidence"),
        ocr_status=ocr_status,
        batch_mismatch=batch_mismatch,
    )
    db.add(record)

    if ocr_status == OcrStatus.accepted:
        session_row.scanned_qty += 1
        if session_row.scanned_qty >= session_row.expected_qty:
            session_row.status = ScanSessionStatus.completed
            # Mark the invoice line item verified only if EVERY scan in
            # this session matched the expected batch — a completed count
            # with even one mismatched strip is not a clean verification,
            # it's a completed count that also surfaced a problem.
            if session_row.invoice_line_item_id:
                any_mismatch = any(s.batch_mismatch for s in session_row.strip_scans) or batch_mismatch
                if not any_mismatch:
                    line_item = db.get(InvoiceLineItem, session_row.invoice_line_item_id)
                    if line_item:
                        line_item.is_verified = True

    db.commit()
    db.refresh(record)

    # Photo's job is done the moment extraction succeeds - delete it from
    # disk immediately. On needs_retry we deliberately keep it (see the
    # retry endpoint, not shown here) so the employee can re-attempt
    # without re-photographing.
    if ocr_status == OcrStatus.accepted:
        _delete_from_staging(staged_path)

    return record
