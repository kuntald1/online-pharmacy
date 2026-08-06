from datetime import datetime
from pydantic import BaseModel
from app.models.enums import B2BApplicationStatus


class B2BApplicationCreate(BaseModel):
    business_name: str
    contact_name: str
    phone: str
    aadhar_no: str
    pan_no: str
    gst_no: str
    driving_licence_no: str | None = None
    trade_licence_no: str


class B2BApplicationOut(BaseModel):
    id: int
    business_name: str
    contact_name: str
    phone: str
    status: B2BApplicationStatus
    admin_note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class B2BApplicationReview(BaseModel):
    approve: bool
    admin_note: str | None = None
