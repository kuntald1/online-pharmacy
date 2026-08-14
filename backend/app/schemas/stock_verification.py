from datetime import datetime
from pydantic import BaseModel


class InvoiceLineItemOut(BaseModel):
    id: int
    product_name: str
    batch_no: str | None = None
    exp_date: str | None = None
    pack: str
    pack_type: str
    tablets_per_strip: int | None = None
    qty: int
    is_verified: bool

    class Config:
        from_attributes = True


class InvoiceOut(BaseModel):
    id: int
    wholesaler_name: str | None = None
    invoice_no: str | None = None
    invoice_date: str | None = None
    created_at: datetime
    line_items: list[InvoiceLineItemOut] = []

    class Config:
        from_attributes = True


class InvoiceSummaryOut(BaseModel):
    """Lightweight — used for the 'recent invoices' list, without the full
    line-item table, so opening the Stock Verification page doesn't pull
    every line item of every invoice just to render a list of names."""
    id: int
    wholesaler_name: str | None = None
    invoice_no: str | None = None
    invoice_date: str | None = None
    created_at: datetime
    line_item_count: int

    class Config:
        from_attributes = True


class ScanSessionOut(BaseModel):
    """No expected_qty/scanned_qty anymore — a session now spans the whole
    invoice, potentially many medicines and batches, so there's no single
    running count to show. The grouped rows (GroupedScanRowOut, below) are
    what the client polls/displays live instead."""
    id: int
    invoice_id: int
    status: str
    created_at: datetime
    completed_at: datetime | None = None

    class Config:
        from_attributes = True


class StripScanOut(BaseModel):
    id: int
    sequence_no: int
    extracted_medicine_name: str | None = None
    extracted_batch_no: str | None = None
    extracted_mfg_date: str | None = None
    extracted_exp_date: str | None = None
    confidence: str | None = None
    ocr_status: str
    scanned_at: datetime

    class Config:
        from_attributes = True


class GroupedScanRowOut(BaseModel):
    """One row of the live 'Medicine X / Batch Y / Qty N' table — computed
    by grouping accepted strip scans, not a persisted row itself."""
    medicine_name: str | None = None
    batch_no: str | None = None
    mfg_date: str | None = None
    exp_date: str | None = None
    qty: int
    confidence: str | None = None
    attempts_taken: int = 0  # total capture attempts across every scan in this group — the "Scan Attempt" column
    scanned_by_label: str | None = None  # name/initial of whoever made the most recent scan in this group


class ManualStripScanIn(BaseModel):
    """What the mobile app sends after its own free, on-device OCR (ML
    Kit) has already read the strip — no image, no Claude call, just the
    text fields the employee has reviewed and confirmed."""
    medicine_name: str | None = None
    batch_no: str | None = None
    mfg_date: str | None = None
    exp_date: str | None = None
    attempts_taken: int = 1  # how many camera captures it took to get here (auto-detect retries count as one "attempt" each)


class StripScanResultOut(BaseModel):
    """Returned after each scan-strip call: the individual scan that was
    just recorded, plus the freshly recomputed grouped table — this is
    all the mobile app needs to update both the scan log and the live
    Qty table in one response."""
    scan: StripScanOut
    grouped_rows: list[GroupedScanRowOut]


class CompareRowOut(BaseModel):
    product_name: str
    batch_no: str | None = None
    expected_qty: int
    scanned_qty: int
    status: str  # matched | short | excess | not_scanned
    attempts_taken: int = 0
    scanned_by_label: str | None = None


class CompareResultOut(BaseModel):
    session_id: int
    invoice_id: int
    rows: list[CompareRowOut]
    unexpected_scans: list[GroupedScanRowOut]  # scanned batches that don't belong to any line item on this invoice
