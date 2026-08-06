from pydantic import BaseModel
from app.models.enums import RelationType


class RelatedProductOut(BaseModel):
    """Lightweight product info for cross-sell carousels — same spirit as
    ProductVariantOut: just enough to render a card and link to the PDP,
    not the full ProductOut."""
    id: int
    slug: str
    name: str
    image_url: str | None = None
    price: float | None = None
    mrp: float | None = None
    stock: int | None = None
    min_quantity: int | None = None


class RelationCreate(BaseModel):
    related_product_id: int
    relation_type: RelationType


class AdminRelationOut(BaseModel):
    id: int
    relation_type: RelationType
    related_product_id: int
    related_product_name: str
    related_product_sku: str

    class Config:
        from_attributes = True
