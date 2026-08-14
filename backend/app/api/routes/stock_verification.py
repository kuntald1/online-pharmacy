from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User
from app.models.stock_verification import ScanSession
from app.models.invoice import Invoice
from app.models.enums import ScanSessionStatus
from app.schemas.stock_verification import (
    InvoiceOut, InvoiceSummaryOut, ScanSessionOut, StripScanResultOut,
    GroupedScanRowOut, CompareResultOut, ManualStripScanIn,
    DeleteScannedBatchIn, EditScannedBatchIn,
)
from app.services.stock_verification_extraction import extract_and_save_invoice_for_verification, StockVerificationInvoiceExtractionError
from app.services.strip_scan import (
    get_grouped_scan_rows, compare_session, save_manual_scan,
    delete_scanned_batch, edit_scanned_batch, StripScanError,
)
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/api/stock", tags=["stock-verification"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB


@router.post("/invoices/extract", response_model=InvoiceOut)
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Staff-only — uploads and parses a wholesaler invoice into expected
    product/batch/qty rows. This is the "target" data strip scanning gets
    reconciled against."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large (max 15MB)")

    try:
        invoice = extract_and_save_invoice_for_verification(db, admin.id, contents, file.content_type)
    except StockVerificationInvoiceExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return invoice


@router.get("/invoices", response_model=list[InvoiceSummaryOut])
def list_invoices(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Recent invoices, newest first — lets an employee open the mobile
    app on their own device and find the right invoice to scan against."""
    invoices = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .order_by(Invoice.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        InvoiceSummaryOut(
            id=inv.id,
            wholesaler_name=inv.wholesaler_name,
            invoice_no=inv.invoice_no,
            invoice_date=inv.invoice_date,
            created_at=inv.created_at,
            line_item_count=len(inv.line_items),
        )
        for inv in invoices
    ]


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/invoices/{invoice_id}/scan-sessions", response_model=ScanSessionOut)
def start_scan_session(
    invoice_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Starts (or JOINS) a free-form scanning session for one invoice.
    Deliberately shared, not per-employee: if another employee already
    has an in-progress session for this same invoice, this returns THAT
    session rather than creating a new isolated one — so Employee A and
    Employee B scanning the same box's strips both contribute to the same
    running Medicine+Batch+Qty table, instead of each seeing only their
    own scans. The row lock in save_manual_scan (strip_scan.py) is what
    keeps two employees scanning at the exact same moment from stepping
    on each other's sequence numbers."""
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    existing = (
        db.query(ScanSession)
        .filter(ScanSession.invoice_id == invoice_id, ScanSession.status == ScanSessionStatus.in_progress)
        .order_by(ScanSession.created_at.desc())
        .first()
    )
    if existing:
        return existing

    session = ScanSession(invoice_id=invoice_id, employee_id=admin.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


# NOTE: the paid, Claude-based per-strip endpoint that used to live here
# has been deliberately removed. Strip scanning must never incur a
# per-scan API cost — the mobile app does its own free on-device OCR and
# posts to /scan-strip-manual below instead. If a future need for a paid,
# higher-accuracy fallback ever comes up, that decision should be made
# explicitly, not reintroduced by default.


@router.get("/invoices/{invoice_id}/scan-session", response_model=ScanSessionOut)
def get_invoice_scan_session(
    invoice_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Finds the current (or most recent) scan session for this invoice —
    this is what lets the web admin page show live scanning progress from
    the mobile app, without the admin needing to know a session_id."""
    session = (
        db.query(ScanSession)
        .filter(ScanSession.invoice_id == invoice_id)
        .order_by(ScanSession.created_at.desc())
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="No scanning has started for this invoice yet")
    return session


@router.post("/scan-sessions/{session_id}/scan-strip-manual", response_model=StripScanResultOut)
def scan_strip_manual_endpoint(
    session_id: int,
    body: ManualStripScanIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """FREE path — no Claude API call, no cost. The mobile app has already
    run its own on-device OCR (ML Kit) and the employee has reviewed the
    result; this just persists it. This is the endpoint the mobile app
    actually uses for every scan."""
    try:
        record = save_manual_scan(
            db, session_id, admin.id,
            body.medicine_name, body.batch_no, body.mfg_date, body.exp_date,
            attempts_taken=body.attempts_taken,
        )
    except StripScanError as e:
        raise HTTPException(status_code=422, detail=str(e))

    grouped = get_grouped_scan_rows(db, session_id)
    return StripScanResultOut(scan=record, grouped_rows=[GroupedScanRowOut(**row) for row in grouped])


@router.get("/invoices/{invoice_id}/latest-session", response_model=ScanSessionOut)
def get_latest_session_for_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Finds the most recent scan session (in-progress or completed) for
    this invoice, if any exists — this is what lets the WEB admin page
    show mobile-app scanning progress without an admin needing to open
    the mobile app themselves. Returns 404 if scanning hasn't started yet
    for this invoice from any device."""
    session = (
        db.query(ScanSession)
        .filter(ScanSession.invoice_id == invoice_id)
        .order_by(ScanSession.created_at.desc())
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="No scanning has started for this invoice yet")
    return session


@router.get("/scan-sessions/{session_id}", response_model=ScanSessionOut)
def get_scan_session(
    session_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """For reloading the session if the employee's app restarts mid-scan."""
    session = db.get(ScanSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Scan session not found")
    return session


@router.get("/scan-sessions/{session_id}/rows", response_model=list[GroupedScanRowOut])
def get_session_rows(
    session_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """The live grouped table on its own — useful for re-rendering the
    scan screen without re-fetching the whole session."""
    session = db.get(ScanSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Scan session not found")
    grouped = get_grouped_scan_rows(db, session_id)
    return [GroupedScanRowOut(**row) for row in grouped]


@router.post("/scan-sessions/{session_id}/complete", response_model=ScanSessionOut)
def complete_scan_session(
    session_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Employee marks scanning done for this invoice. This doesn't run the
    comparison itself — it just closes the session so it stops appearing
    as 'in progress'. Call /compare separately (before or after marking
    complete) to see the match/mismatch report."""
    session = db.get(ScanSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Scan session not found")
    session.status = ScanSessionStatus.completed
    session.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return session


@router.get("/scan-sessions/{session_id}/compare", response_model=CompareResultOut)
def compare_scan_session(
    session_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """The 'Compare' button — reconciles everything scanned in this
    session against the invoice's strip-type line items, matched by batch
    number. Can be called any time, even mid-scan, to check progress —
    doesn't require the session to be marked complete first."""
    try:
        result = compare_session(db, session_id)
    except StripScanError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return result


@router.delete("/scan-sessions/{session_id}/scanned-batch")
def delete_scanned_batch_endpoint(
    session_id: int,
    body: DeleteScannedBatchIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Web-admin 'delete' action on a scanned row — e.g. a garbled OCR
    read that shouldn't count at all. batch_variants comes straight from
    the row's own batch_variants field (see GroupedScanRowOut /
    CompareRowOut), so this targets exactly the underlying scans that
    were merged into that one displayed row, nothing else."""
    deleted = delete_scanned_batch(db, session_id, body.batch_variants)
    return {"deleted": deleted}


@router.patch("/scan-sessions/{session_id}/scanned-batch")
def edit_scanned_batch_endpoint(
    session_id: int,
    body: EditScannedBatchIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Web-admin 'edit' action — corrects a consistently-misread batch
    number (and optionally EXP date) across every underlying scan that
    was merged into this row. Typical use: OCR read a batch as
    'DT2B091' but it should be 'DT28091' — this fixes it so the row
    correctly matches against the invoice."""
    if not body.new_batch_no or not body.new_batch_no.strip():
        raise HTTPException(status_code=400, detail="New batch number can't be empty")
    updated = edit_scanned_batch(db, session_id, body.batch_variants, body.new_batch_no.strip(), body.new_exp_date)
    return {"updated": updated}
