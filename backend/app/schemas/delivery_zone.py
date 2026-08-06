from datetime import datetime
from pydantic import BaseModel


class DeliveryZoneOut(BaseModel):
    id: int
    pincode: str
    label: str | None = None
    delivery_days: int
    is_deliverable: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryZoneCreate(BaseModel):
    pincode: str
    label: str | None = None
    delivery_days: int = 1
    is_deliverable: bool = True


class DeliveryZoneUpdate(BaseModel):
    pincode: str | None = None
    label: str | None = None
    delivery_days: int | None = None
    is_deliverable: bool | None = None


class DeliveryEstimateOut(BaseModel):
    deliverable: bool
    pincode: str
    delivery_days: int | None = None
    delivery_date: str | None = None  # ISO date, e.g. "2026-08-02"
    message: str
