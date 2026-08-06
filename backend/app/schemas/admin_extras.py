from datetime import datetime, date
from pydantic import BaseModel
from app.models.enums import UserRole, DiscountType, PricingChannel, Visibility, SettingCategory


# ---------- Customers ----------

class CustomerOut(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None = None
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ---------- Inventory ----------

class InventoryPricingOut(BaseModel):
    id: int
    channel: PricingChannel
    price: float
    stock: int
    min_quantity: int
    reorder_level: int
    is_active: bool

    class Config:
        from_attributes = True


class InventoryProductOut(BaseModel):
    id: int
    name: str
    sku: str
    image_urls: str | None = None
    reorder_level: int
    batch_number: str | None = None
    expiry_date: date | None = None
    rack_place: str | None = None
    pricing: list[InventoryPricingOut]

    class Config:
        from_attributes = True


class StockUpdate(BaseModel):
    stock: int


# ---------- Coupons ----------

class CouponCreate(BaseModel):
    code: str
    description: str | None = None
    discount_type: DiscountType
    discount_value: float
    min_order_amount: float = 0
    max_uses: int | None = None
    visibility: Visibility = Visibility.b2c
    valid_from: datetime | None = None
    valid_until: datetime | None = None


class CouponOut(CouponCreate):
    id: int
    used_count: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CouponUpdate(BaseModel):
    code: str | None = None
    description: str | None = None
    discount_type: DiscountType | None = None
    discount_value: float | None = None
    min_order_amount: float | None = None
    max_uses: int | None = None
    visibility: Visibility | None = None
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    is_active: bool | None = None


# ---------- App Settings ----------

class AppSettingOut(BaseModel):
    key: str
    value: str
    category: SettingCategory
    label: str
    updated_at: datetime

    class Config:
        from_attributes = True


class AppSettingUpsert(BaseModel):
    value: str
    category: SettingCategory
    label: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
