from datetime import datetime
from pydantic import BaseModel


class ReturnRequestCreate(BaseModel):
    order_item_id: int
    quantity: int
    reason: str


class ReturnRequestOut(BaseModel):
    id: int
    order_id: int
    order_item_id: int
    quantity: int
    reason: str
    image_url: str | None = None
    status: str
    refund_amount: float | None = None
    refund_method: str | None = None
    admin_note: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminReturnRequestOut(ReturnRequestOut):
    order_no: str
    product_name: str
    customer_name: str
    customer_phone: str
    channel: str


class ReturnStatusUpdate(BaseModel):
    status: str  # pickup_scheduled | picked_up | approved | rejected
    admin_note: str | None = None
