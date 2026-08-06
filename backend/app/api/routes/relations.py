from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.catalog import Product, ProductPricing
from app.models.relation import ProductRelation
from app.models.enums import RelationType, PricingChannel
from app.models.user import User
from app.schemas.relation import RelatedProductOut, RelationCreate, AdminRelationOut
from app.api.deps import require_admin
from app.services import suggestions

router = APIRouter(prefix="/api", tags=["relations"])


def _visible_channels_for(channel: str) -> list[PricingChannel]:
    if channel == "b2c":
        return [PricingChannel.b2c]
    if channel == "cnf":
        return [PricingChannel.cnf]
    return [PricingChannel.b2b_normal, PricingChannel.b2b_advance]


def _to_related_out(products: list[Product], channels: list[PricingChannel]) -> list[RelatedProductOut]:
    result = []
    for p in products:
        pricing = next((pr for pr in p.pricing if pr.channel in channels and pr.is_active), None)
        result.append(RelatedProductOut(
            id=p.id,
            slug=p.slug,
            name=p.name,
            image_url=(p.image_urls.split(",")[0] if p.image_urls else None),
            price=pricing.price if pricing else None,
            mrp=pricing.mrp if pricing else None,
            stock=pricing.stock if pricing else None,
            min_quantity=pricing.min_quantity if pricing else None,
        ))
    return result


@router.get("/products/{slug}/related", response_model=list[RelatedProductOut])
def get_related_products(
    slug: str,
    type: RelationType = Query(..., description="fbt, similar, or also_bought"),
    channel: str = Query("b2c", pattern="^(b2c|b2b|b2b_normal|b2b_advance|cnf)$"),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    channels = _visible_channels_for(channel)
    relations = (
        db.query(ProductRelation)
        .options(joinedload(ProductRelation.related_product).joinedload(Product.pricing))
        .filter(ProductRelation.product_id == product.id, ProductRelation.relation_type == type)
        .order_by(ProductRelation.sort_order, ProductRelation.id)
        .all()
    )

    result = []
    for rel in relations:
        rp = rel.related_product
        if not rp or not rp.is_active:
            continue
        pricing = next((p for p in rp.pricing if p.channel in channels and p.is_active), None)
        result.append(RelatedProductOut(
            id=rp.id,
            slug=rp.slug,
            name=rp.name,
            image_url=(rp.image_urls.split(",")[0] if rp.image_urls else None),
            price=pricing.price if pricing else None,
            mrp=pricing.mrp if pricing else None,
            stock=pricing.stock if pricing else None,
        ))

    # Manual curation always wins when it exists. Only fall back to
    # rule-based auto-generation when the admin hasn't linked anything for
    # this type AND hasn't turned the fallback off.
    if not result and product.auto_generate_relations:
        if type == RelationType.similar:
            auto = suggestions.suggest_similar(db, product, channels)
        else:  # fbt and also_bought both read from order co-occurrence today
            auto = suggestions.suggest_co_occurring(db, product, channels)
        result = _to_related_out(auto, channels)
    return result


# ---------- Admin curation ----------

@router.get("/admin/products/{product_id}/relations", response_model=list[AdminRelationOut])
def list_relations(product_id: int, type: RelationType | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    q = db.query(ProductRelation).options(joinedload(ProductRelation.related_product)).filter(ProductRelation.product_id == product_id)
    if type:
        q = q.filter(ProductRelation.relation_type == type)
    rows = q.order_by(ProductRelation.sort_order, ProductRelation.id).all()
    return [
        AdminRelationOut(
            id=r.id,
            relation_type=r.relation_type,
            related_product_id=r.related_product_id,
            related_product_name=r.related_product.name,
            related_product_sku=r.related_product.sku,
        )
        for r in rows
    ]


@router.post("/admin/products/{product_id}/relations", response_model=AdminRelationOut)
def add_relation(product_id: int, payload: RelationCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    if product_id == payload.related_product_id:
        raise HTTPException(status_code=400, detail="Can't relate a product to itself")
    product = db.get(Product, product_id)
    related = db.get(Product, payload.related_product_id)
    if not product or not related:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = db.query(ProductRelation).filter(
        ProductRelation.product_id == product_id,
        ProductRelation.related_product_id == payload.related_product_id,
        ProductRelation.relation_type == payload.relation_type,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="That product is already linked here")

    relation = ProductRelation(product_id=product_id, related_product_id=payload.related_product_id, relation_type=payload.relation_type)
    db.add(relation)
    db.commit()
    db.refresh(relation)
    return AdminRelationOut(
        id=relation.id,
        relation_type=relation.relation_type,
        related_product_id=related.id,
        related_product_name=related.name,
        related_product_sku=related.sku,
    )


@router.delete("/admin/products/{product_id}/relations/{relation_id}")
def delete_relation(product_id: int, relation_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    relation = db.query(ProductRelation).filter(ProductRelation.id == relation_id, ProductRelation.product_id == product_id).first()
    if not relation:
        raise HTTPException(status_code=404, detail="Relation not found")
    db.delete(relation)
    db.commit()
    return {"status": "deleted"}
