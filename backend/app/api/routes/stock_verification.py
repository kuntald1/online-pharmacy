from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.user import User
from app.models.stock_verification import ScanSession
from app.models.invoice import Invoice
from app.schemas.stock_verification import (
    InvoiceOut, InvoiceSummaryOut, StartScanSessionIn, ScanSessionOut, StripScanOut,
)
from app.services.stock_verification_extraction import extract_and_save_invoice_for_verification, StockVerificationInvoiceExtractionError
from app.services.strip_scan import scan_strip, StripScanError
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/api/stock", tags=["stock-verification"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
ALLOWED_STRIP_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}  # strips are always photos, never PDFs
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
    """Recent invoices, newest first — this is what lets an employee open
    the app on a different device (e.g. their phone, after someone else
    uploaded the invoice from a desktop) and find the right one to scan
    against. Without this, the upload screen only ever showed whatever was
    just uploaded in that same browser session, which is useless the
    moment you switch devices or refresh the page."""
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
    """Reopens one invoice with its full line-item table — this is what
    the employee's device calls after picking an invoice from the list,
    so they land on the exact same screen as if they'd just uploaded it
    themselves."""
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.line_items))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/scan-sessions", response_model=ScanSessionOut)
def start_scan_session(
    body: StartScanSessionIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Starts a new strip-scanning session for one employee verifying one
    box. Each session tracks its own scanned_qty independently, so
    multiple employees scanning different boxes at the same time never
    interfere with each other's counts."""
    session = ScanSession(
        employee_id=admin.id,
        invoice_line_item_id=body.invoice_line_item_id,
        product_name=body.product_name,
        batch_no_expected=body.batch_no_expected,
        expected_qty=body.expected_qty,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.post("/scan-sessions/{session_id}/scan-strip", response_model=StripScanOut)
async def scan_strip_endpoint(
    session_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """One call per strip photographed. Returns the extracted data plus
    the session's updated scanned_qty, so the client can update its live
    progress display ("7 of 10 strips") from this one response."""
    if file.content_type not in ALLOWED_STRIP_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large (max 15MB)")

    try:
        record = scan_strip(db, session_id, admin.id, contents, file.content_type)
    except StripScanError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return record


@router.get("/scan-sessions/{session_id}", response_model=ScanSessionOut)
def get_scan_session(
    session_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """For reloading progress if the employee's page refreshes mid-scan."""
    session = db.get(ScanSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Scan session not found")
    return session
