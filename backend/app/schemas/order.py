from datetime import datetime
from pydantic import BaseModel
from app.models.enums import PricingChannel, OrderStatus, PaymentMode, PaymentStatus


class AddressCreate(BaseModel):
    name: str
    phone: str
    line1: str
    line2: str | None = None
    city: str
    state: str
    pincode: str
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool = False


class AddressUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    line1: str | None = None
    line2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_default: bool | None = None


class AddressOut(AddressCreate):
    id: int

    class Config:
        from_attributes = True


class CartItemIn(BaseModel):
    product_id: int
    channel: PricingChannel
    quantity: int = 1


class CartItemOut(BaseModel):
    id: int
    product_id: int
    channel: PricingChannel
    quantity: int

    class Config:
        from_attributes = True


class CartOut(BaseModel):
    id: int
    items: list[CartItemOut]

    class Config:
        from_attributes = True


class CheckoutRequest(BaseModel):
    address_id: int
    payment_mode: PaymentMode
    coupon_code: str | None = None


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    channel: PricingChannel
    unit_price: float
    quantity: int

    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: int
    order_no: str
    channel: PricingChannel
    status: OrderStatus
    payment_mode: PaymentMode
    payment_status: PaymentStatus
    subtotal: float
    mrp_total: float
    product_discount: float
    delivery_fee: float
    platform_fee: float
    coupon_code: str | None = None
    coupon_discount: float
    total: float
    razorpay_order_id: str | None = None
    created_at: datetime
    items: list[OrderItemOut]

    class Config:
        from_attributes = True


class CouponValidateRequest(BaseModel):
    code: str


class CouponValidateResponse(BaseModel):
    valid: bool
    discount_amount: float = 0
    message: str


class RazorpayVerifyRequest(BaseModel):
    order_id: int
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class AdminOrderOut(OrderOut):
    customer_name: str
    customer_phone: str
    shipping_address: AddressOut


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
