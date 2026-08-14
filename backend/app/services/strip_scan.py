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
from difflib import SequenceMatcher
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


def save_manual_scan(
    db: Session, session_id: int, employee_id: int,
    medicine_name: str | None, batch_no: str | None, mfg_date: str | None, exp_date: str | None,
    attempts_taken: int = 1,
) -> StripScanRecord:
    """Saves a strip scan that was already read by the mobile app's free,
    on-device OCR (ML Kit) — this function makes NO Claude API call and
    involves NO cost whatsoever. It exists specifically because per-strip
    Claude calls were the wrong default for this app: the mobile app does
    its own free text recognition and sends only the resulting fields
    here to be persisted.

    Deliberately NOT restricted to the employee who started the session —
    sessions are shared per-invoice (see start_scan_session in the
    router), so Employee A and Employee B scanning the same box both need
    to be able to write into the same session. scanned_by_id records
    which employee actually made THIS scan, so the shared session still
    keeps a per-scan audit trail even though it's collaborative."""
    session_row = db.query(ScanSession).filter(ScanSession.id == session_id).with_for_update().first()
    if not session_row:
        raise StripScanError("Scan session not found")

    sequence_no = len(session_row.strip_scans) + 1
    record = StripScanRecord(
        session_id=session_id,
        sequence_no=sequence_no,
        scanned_by_id=employee_id,
        image_path=None,  # no photo ever leaves the phone in this path
        extracted_medicine_name=medicine_name,
        extracted_batch_no=batch_no,
        extracted_mfg_date=mfg_date,
        extracted_exp_date=exp_date,
        confidence="on_device",  # marks this came from free OCR, not Claude, for audit clarity
        ocr_status=OcrStatus.accepted,
        attempts_taken=max(1, attempts_taken),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_grouped_scan_rows(db: Session, session_id: int) -> list[dict]:
    """Groups this session's accepted strip scans by (medicine name, batch
    number) and counts them — this IS the 'Medicine X / Batch Y / Qty N'
    table the employee sees live while scanning. Computed fresh from the
    raw scan records every time, so it can never drift out of sync with
    what was actually scanned.

    Two passes:
    1. Exact grouping by (medicine name, batch number) — same as before.
    2. Fuzzy merge: OCR occasionally misreads the same physical strip's
       batch slightly differently between attempts (e.g. "DT2B091" vs
       "DT28091" vs "DT33091" — all the same real strip, one digit/letter
       confused each time). Groups with a similar-enough batch string
       (SequenceMatcher ratio >= 0.7) AND the same EXP date get merged
       into one — medicine name is deliberately NOT part of this check
       (see the merge loop below for why). The canonical batch number
       shown is whichever exact reading occurred most often (the
       most-repeated, and therefore most likely correct, OCR result)."""
    records = (
        db.query(StripScanRecord)
        .filter(StripScanRecord.session_id == session_id, StripScanRecord.ocr_status == OcrStatus.accepted)
        .order_by(StripScanRecord.sequence_no)
        .all()
    )

    # Pass 1 — exact grouping, same as before.
    exact_groups: dict[tuple[str, str], dict] = {}
    for r in records:
        name_key = (r.extracted_medicine_name or "").strip().lower()
        batch_key = (r.extracted_batch_no or "").strip().lower()
        key = (name_key, batch_key)
        if key not in exact_groups:
            exact_groups[key] = {
                "_name_key": name_key,
                "_batch_variants": {},  # batch_no -> count, to pick the canonical spelling later
                "medicine_name": r.extracted_medicine_name,
                "batch_no": r.extracted_batch_no,
                "exp_date": r.extracted_exp_date,
                "qty": 0,
                "confidence": r.confidence,
                "attempts_taken": 0,
                "scanned_by_label": None,
            }
        g = exact_groups[key]
        g["qty"] += 1
        g["attempts_taken"] += r.attempts_taken or 1
        g["_batch_variants"][r.extracted_batch_no or ""] = g["_batch_variants"].get(r.extracted_batch_no or "", 0) + 1
        if r.scanned_by is not None:
            g["scanned_by_label"] = getattr(r.scanned_by, "name", None) or getattr(r.scanned_by, "phone", None)

    # Pass 2 — fuzzy-merge near-duplicate batch reads. Deliberately does
    # NOT require the medicine-name guess to match — that guess is just
    # "the longest printed line," which often grabs different boilerplate
    # warning text on different attempts of the SAME strip (confirmed in
    # testing: three misreads of one real strip had three different name
    # guesses but a consistently correct EXP date). Batch similarity + a
    # matching EXP date together are a strong enough signal on their own.
    merged: list[dict] = []
    for g in exact_groups.values():
        target = None
        for m in merged:
            same_exp = (
                not g["exp_date"] or not m["exp_date"]
                or (g["exp_date"] or "").strip() == (m["exp_date"] or "").strip()
            )
            batch_sim = SequenceMatcher(None, (g["batch_no"] or "").lower(), (m["batch_no"] or "").lower()).ratio()
            if same_exp and batch_sim >= 0.7:
                target = m
                break

        if target:
            target["qty"] += g["qty"]
            target["attempts_taken"] += g["attempts_taken"]
            for variant, count in g["_batch_variants"].items():
                target["_batch_variants"][variant] = target["_batch_variants"].get(variant, 0) + count
            if g["scanned_by_label"]:
                target["scanned_by_label"] = g["scanned_by_label"]
            if not target["exp_date"] and g["exp_date"]:
                target["exp_date"] = g["exp_date"]
        else:
            merged.append(g)

    # Pick the most-frequently-read spelling as the canonical batch number
    # shown, and drop the internal bookkeeping fields before returning.
    result = []
    for g in merged:
        canonical_batch = max(g["_batch_variants"].items(), key=lambda kv: kv[1])[0] if g["_batch_variants"] else g["batch_no"]
        result.append({
            "medicine_name": g["medicine_name"],
            "batch_no": canonical_batch,
            "exp_date": g["exp_date"],
            "qty": g["qty"],
            "confidence": g["confidence"],
            "attempts_taken": g["attempts_taken"],
            "scanned_by_label": g["scanned_by_label"],
            "batch_variants": list(g["_batch_variants"].keys()),
        })
    return result


def delete_scanned_batch(db: Session, session_id: int, batch_variants: list[str]) -> int:
    """Deletes every underlying StripScanRecord in this session whose
    extracted_batch_no is one of the given variants — i.e. deletes an
    entire merged row from the web admin table in one go, not just one of
    the several raw scans that got fuzzy-merged into it. Returns the
    number of rows deleted."""
    if not batch_variants:
        return 0
    deleted = (
        db.query(StripScanRecord)
        .filter(StripScanRecord.session_id == session_id, StripScanRecord.extracted_batch_no.in_(batch_variants))
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted


def edit_scanned_batch(
    db: Session, session_id: int, employee_id: int,
    batch_variants: list[str],
    new_medicine_name: str | None, new_batch_no: str, new_exp_date: str | None, new_qty: int | None,
) -> int:
    """Full-row edit for the web admin table. Two situations, handled the
    same way:

    1. batch_variants is non-empty (this row already had scans): corrects
       every underlying StripScanRecord's medicine/batch/exp to the
       admin-confirmed values.
    2. batch_variants is EMPTY (nothing scanned yet for this line item):
       there's nothing to rename — this becomes a manual entry, letting
       an admin record a count directly from the web without anyone
       having scanned it on a phone at all.

    In both cases, if new_qty is given and differs from the row's current
    count, rows are added or removed to match it: added rows are tagged
    confidence='admin_edit' so they're visibly distinguishable from a
    real phone scan in the data, with attempts_taken=0 since no camera
    was involved. Returns the final row count for this batch."""
    if batch_variants:
        query = db.query(StripScanRecord).filter(
            StripScanRecord.session_id == session_id, StripScanRecord.extracted_batch_no.in_(batch_variants)
        )
        update_values = {"extracted_batch_no": new_batch_no}
        if new_medicine_name is not None:
            update_values["extracted_medicine_name"] = new_medicine_name
        if new_exp_date is not None:
            update_values["extracted_exp_date"] = new_exp_date
        query.update(update_values, synchronize_session=False)
        db.commit()
        current_count = (
            db.query(StripScanRecord)
            .filter(StripScanRecord.session_id == session_id, StripScanRecord.extracted_batch_no == new_batch_no)
            .count()
        )
    else:
        current_count = 0

    if new_qty is not None and new_qty != current_count:
        session_row = db.query(ScanSession).filter(ScanSession.id == session_id).with_for_update().first()
        if not session_row:
            raise StripScanError("Scan session not found")

        if new_qty > current_count:
            to_add = new_qty - current_count
            next_seq = len(session_row.strip_scans) + 1
            for i in range(to_add):
                db.add(StripScanRecord(
                    session_id=session_id,
                    sequence_no=next_seq + i,
                    scanned_by_id=employee_id,
                    image_path=None,
                    extracted_medicine_name=new_medicine_name,
                    extracted_batch_no=new_batch_no,
                    extracted_exp_date=new_exp_date,
                    confidence="admin_edit",  # distinguishes manually-added counts from real phone scans
                    ocr_status=OcrStatus.accepted,
                    attempts_taken=0,
                ))
            db.commit()
        else:
            to_remove = current_count - new_qty
            excess = (
                db.query(StripScanRecord)
                .filter(StripScanRecord.session_id == session_id, StripScanRecord.extracted_batch_no == new_batch_no)
                .order_by(StripScanRecord.sequence_no.desc())
                .limit(to_remove)
                .all()
            )
            for r in excess:
                db.delete(r)
            db.commit()
        current_count = new_qty

    return current_count


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
            "attempts_taken": scanned["attempts_taken"] if scanned else 0,
            "scanned_by_label": scanned["scanned_by_label"] if scanned else None,
            "batch_variants": scanned["batch_variants"] if scanned else [],
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
