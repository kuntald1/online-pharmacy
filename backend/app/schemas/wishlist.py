from pydantic import BaseModel


class WishlistProductOut(BaseModel):
    """Same lightweight shape used elsewhere (ProductVariantOut, RelatedProductOut)
    for a product card — not the full ProductOut."""
    id: int
    slug: str
    name: str
    image_url: str | None = None
    price: float | None = None
    mrp: float | None = None
    stock: int | None = None
    min_quantity: int | None = None


class WishlistAdd(BaseModel):
    product_id: int


class WishlistStatusOut(BaseModel):
    is_saved: bool
