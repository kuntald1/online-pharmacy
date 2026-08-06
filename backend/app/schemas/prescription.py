from datetime import datetime
from pydantic import BaseModel


class RxProductMatch(BaseModel):
    id: int
    name: str
    slug: str
    image_url: str | None = None
    price: float | None = None
    is_prescription_required: bool = False


class RxExtractedItem(BaseModel):
    raw_text: str  # exactly what's written on the prescription for this line, unedited
    medicine_name_guess: str | None = None
    confidence: str = "low"  # high | medium | low — handwriting is often genuinely ambiguous
    matches: list[RxProductMatch] = []


class RxExtractOut(BaseModel):
    prescription_id: int
    file_url: str
    patient_name: str | None = None
    doctor_name: str | None = None
    prescription_date: str | None = None
    items: list[RxExtractedItem] = []
    warning: str | None = None


class AdminPrescriptionOut(BaseModel):
    id: int
    user_id: int
    customer_name: str
    customer_phone: str
    file_url: str
    created_at: datetime

    class Config:
        from_attributes = True
