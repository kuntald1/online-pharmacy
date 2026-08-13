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
)
from app.services.stock_verification_extraction import extract_and_save_invoice_for_verification, StockVerificationInvoiceExtractionError
from app.services.strip_scan import get_grouped_scan_rows, compare_session, save_manual_scan, StripScanError
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
    """Starts a free-form scanning session against one invoice. The
    employee can now scan strips for ANY medicine on this invoice in any
    order — matching against expected batches/quantities happens later,
    via the Compare endpoint, not as each strip is scanned."""
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

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


@router.get("/scan-sessions/{session_id}", response_model=ScanSessionOut)


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
        )
    except StripScanError as e:
        raise HTTPException(status_code=422, detail=str(e))

    grouped = get_grouped_scan_rows(db, session_id)
    return StripScanResultOut(scan=record, grouped_rows=[GroupedScanRowOut(**row) for row in grouped])


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
