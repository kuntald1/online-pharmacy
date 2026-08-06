from datetime import datetime
from pydantic import BaseModel
from app.models.enums import CNFStatus


class CNFLeadCreate(BaseModel):
    name: str
    contact_no: str
    email: str | None = None
    business_type: str | None = None
    location: str | None = None
    message: str | None = None
    gst_no: str
    driving_licence_no: str | None = None
    trade_licence_no: str


class CNFLeadOut(CNFLeadCreate):
    id: int
    status: CNFStatus
    whatsapp_notified: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CNFReview(BaseModel):
    approve: bool
    admin_note: str | None = None
