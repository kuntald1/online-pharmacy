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


class StartScanSessionIn(BaseModel):
    invoice_line_item_id: int | None = None
    product_name: str
    batch_no_expected: str | None = None
    expected_qty: int


class ScanSessionOut(BaseModel):
    id: int
    product_name: str
    batch_no_expected: str | None = None
    expected_qty: int
    scanned_qty: int
    status: str

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
    batch_mismatch: bool
    session: ScanSessionOut  # so the client can update its progress display from one response

    class Config:
        from_attributes = True
