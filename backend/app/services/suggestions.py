"""
Auto-generation for product relations and variant suggestions.

Deliberately NOT machine learning — every function here is either a direct
attribute match (category/brand) or a plain SQL count (order co-occurrence).
That's a conscious choice: these signals are transparent and debuggable
("why did X get suggested for Y?" always has a one-line answer), and at
Healthycian's current order volume there isn't remotely enough data to train
or evaluate a real model anyway. This is what "auto-generate" means here —
manual curation (already built) still takes priority whenever it exists;
these functions only fill in when nothing's been manually linked.
"""
import re

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.catalog import Product, ProductPricing
from app.models.order import Order, OrderItem
from app.models.enums import OrderStatus, PricingChannel

# Orders in these statuses represent a real completed purchase — a cancelled
# order tells us nothing about what actually gets bought together.
_CO_OCCURRENCE_STATUSES = [OrderStatus.confirmed, OrderStatus.packed, OrderStatus.shipped, OrderStatus.delivered]

_UNIT_WORDS = (
    r"mg|mcg|gm|g|kg|ml|l|iu|tablets?|tabs?|capsules?|caps?|strip|strips|"
    r"bottle|bottles|pack|packs|sachets?|drops?|units?|pcs?|pieces?|box|boxes"
)


def name_stem(name: str) -> str:
    """Strips quantities/sizes/units from a product name so that
    'Amoxycillin 650mg Capsule 10 Capsules' and '... 15 Capsules' collapse to
    the same stem. Deliberately crude (no NLP) — it only needs to catch the
    common 'same medicine, different pack size' pattern, not every
    paraphrase of a name."""
    s = name.lower()
    s = re.sub(r"\d+(\.\d+)?", "", s)
    s = re.sub(rf"\b({_UNIT_WORDS})\b", "", s)
    s = re.sub(r"[^a-z]+", " ", s).strip()
    return s


def suggest_similar(db: Session, product: Product, channels: list[PricingChannel], limit: int = 8) -> list[Product]:
    """Same category, preferring same brand, then falling back to any other
    active product in the category. No order data required — works from
    day one on a brand-new catalog."""
    if not product.category_id:
        return []

    candidates = (
        db.query(Product)
        .join(ProductPricing)
        .options(joinedload(Product.pricing))
        .filter(
            Product.category_id == product.category_id,
            Product.id != product.id,
            Product.is_active == True,  # noqa: E712
            ProductPricing.channel.in_(channels),
            ProductPricing.is_active == True,  # noqa: E712
        )
        .distinct()
        .all()
    )

    candidates.sort(key=lambda p: (p.brand_id != product.brand_id, p.id))
    return candidates[:limit]


def suggest_co_occurring(db: Session, product: Product, channels: list[PricingChannel], limit: int = 8) -> list[Product]:
    """Counts how often each other product appears in the same completed
    order as this one. Returns [] on a low-order-volume store, which is the
    honest answer — there's no pattern to surface yet, not a bug."""
    co_orders = (
        db.query(OrderItem.order_id)
        .join(Order)
        .filter(OrderItem.product_id == product.id, Order.status.in_(_CO_OCCURRENCE_STATUSES))
        .subquery()
    )

    rows = (
        db.query(OrderItem.product_id, func.count(func.distinct(OrderItem.order_id)).label("n"))
        .filter(OrderItem.order_id.in_(co_orders), OrderItem.product_id != product.id)
        .group_by(OrderItem.product_id)
        .order_by(func.count(func.distinct(OrderItem.order_id)).desc())
        .limit(limit)
        .all()
    )
    if not rows:
        return []

    product_ids = [r[0] for r in rows]
    products = (
        db.query(Product)
        .join(ProductPricing)
        .options(joinedload(Product.pricing))
        .filter(
            Product.id.in_(product_ids),
            Product.is_active == True,  # noqa: E712
            ProductPricing.channel.in_(channels),
            ProductPricing.is_active == True,  # noqa: E712
        )
        .distinct()
        .all()
    )
    by_id = {p.id: p for p in products}
    # preserve the co-occurrence-count order, dropping any product that
    # dropped out (deactivated, no pricing for this channel, etc.)
    return [by_id[pid] for pid, _ in rows if pid in by_id]


def suggest_variant_candidates(db: Session, product: Product, limit: int = 8) -> list[Product]:
    """Other products in the same category whose name collapses to the same
    stem — e.g. flags the 15-capsule pack as a likely variant of the
    10-capsule pack. A suggestion for the admin to confirm-link, never
    auto-linked silently, since merging product identity is a bigger deal
    than a carousel suggestion."""
    stem = name_stem(product.name)
    if not stem or not product.category_id:
        return []

    same_category = (
        db.query(Product)
        .filter(Product.category_id == product.category_id, Product.id != product.id, Product.is_active == True)  # noqa: E712
        .all()
    )
    matches = [p for p in same_category if name_stem(p.name) == stem]
    return matches[:limit]
