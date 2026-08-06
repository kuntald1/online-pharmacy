from datetime import date, datetime
from pydantic import BaseModel
from app.models.enums import PricingChannel, Visibility


class CategoryCreate(BaseModel):
    name: str
    slug: str
    image_url: str | None = None
    parent_id: int | None = None
    sort_order: int = 0
    visibility: Visibility = Visibility.both


class CategoryOut(CategoryCreate):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    image_url: str | None = None
    sort_order: int | None = None
    visibility: Visibility | None = None
    is_active: bool | None = None


class BrandCreate(BaseModel):
    name: str
    slug: str
    logo_url: str | None = None
    is_featured: bool = False
    visibility: Visibility = Visibility.both


class BrandOut(BrandCreate):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class BrandUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    logo_url: str | None = None
    is_featured: bool | None = None
    visibility: Visibility | None = None
    is_active: bool | None = None


class PricingIn(BaseModel):
    channel: PricingChannel
    mrp: float | None = None
    price: float
    min_quantity: int = 1
    stock: int = 0
    reorder_level: int = 0


class PricingOut(PricingIn):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class ManufacturerCreate(BaseModel):
    name: str
    address: str | None = None


class ManufacturerOut(ManufacturerCreate):
    id: int

    class Config:
        from_attributes = True


class MarketerCreate(BaseModel):
    name: str
    address: str | None = None


class MarketerOut(MarketerCreate):
    id: int

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    slug: str
    sku: str
    description: str | None = None
    image_urls: str | None = None
    category_id: int | None = None
    brand_id: int | None = None
    is_prescription_required: bool = False
    reorder_level: int = 0
    batch_number: str | None = None
    expiry_date: date | None = None
    rack_place: str | None = None
    variant_label: str | None = None
    manufacturer_id: int | None = None
    marketer_id: int | None = None
    country_of_origin: str | None = None
    expiry_month: int | None = None
    expiry_year: int | None = None
    is_spotlighted: bool = False
    spotlight_order: int = 0
    auto_generate_relations: bool = True
    pricing: list[PricingIn] = []


class ProductOut(BaseModel):
    id: int
    name: str
    slug: str
    sku: str
    description: str | None = None
    image_urls: str | None = None
    category_id: int | None = None
    brand_id: int | None = None
    is_prescription_required: bool
    is_active: bool
    reorder_level: int
    batch_number: str | None = None
    expiry_date: date | None = None
    rack_place: str | None = None
    variant_group_id: str | None = None
    variant_label: str | None = None
    manufacturer_id: int | None = None
    marketer_id: int | None = None
    manufacturer: ManufacturerOut | None = None
    marketer: MarketerOut | None = None
    country_of_origin: str | None = None
    expiry_month: int | None = None
    expiry_year: int | None = None
    is_spotlighted: bool
    spotlight_order: int
    auto_generate_relations: bool
    updated_at: datetime
    pricing: list[PricingOut] = []

    class Config:
        from_attributes = True


class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    image_urls: str | None = None
    category_id: int | None = None
    brand_id: int | None = None
    is_prescription_required: bool | None = None
    is_active: bool | None = None
    reorder_level: int | None = None
    batch_number: str | None = None
    expiry_date: date | None = None
    rack_place: str | None = None
    variant_label: str | None = None
    manufacturer_id: int | None = None
    marketer_id: int | None = None
    country_of_origin: str | None = None
    expiry_month: int | None = None
    expiry_year: int | None = None
    is_spotlighted: bool | None = None
    spotlight_order: int | None = None
    auto_generate_relations: bool | None = None
    pricing: list[PricingIn] | None = None


class ProductVariantOut(BaseModel):
    """Lightweight sibling info for the storefront's size-picker — deliberately
    not the full ProductOut, since the picker only needs enough to render a
    chip and navigate, not the description/full pricing list/etc."""
    id: int
    slug: str
    variant_label: str | None = None
    price: float | None = None
    mrp: float | None = None
    stock: int | None = None
    image_url: str | None = None
    is_current: bool = False


class LinkVariantRequest(BaseModel):
    target_product_id: int


class BannerCreate(BaseModel):
    title: str
    image_url: str
    link_url: str | None = None
    channel: Visibility = Visibility.b2c
    position: str = "hero"
    sort_order: int = 0


class BannerOut(BannerCreate):
    id: int
    is_active: bool

    class Config:
        from_attributes = True


class BannerUpdate(BaseModel):
    title: str | None = None
    image_url: str | None = None
    link_url: str | None = None
    channel: Visibility | None = None
    position: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None
