from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.catalog import Product, ProductPricing
from app.models.wishlist import WishlistItem
from app.models.enums import PricingChannel
from app.models.user import User
from app.schemas.wishlist import WishlistProductOut, WishlistAdd, WishlistStatusOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])


def _visible_channels_for(channel: str) -> list[PricingChannel]:
    if channel == "b2c":
        return [PricingChannel.b2c]
    if channel == "cnf":
        return [PricingChannel.cnf]
    return [PricingChannel.b2b_normal, PricingChannel.b2b_advance]


@router.get("", response_model=list[WishlistProductOut])
def list_wishlist(
    channel: str = Query("b2c", pattern="^(b2c|b2b|b2b_normal|b2b_advance|cnf)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    channels = _visible_channels_for(channel)
    rows = (
        db.query(WishlistItem)
        .options(joinedload(WishlistItem.product).joinedload(Product.pricing))
        .filter(WishlistItem.user_id == user.id)
        .order_by(WishlistItem.created_at.desc())
        .all()
    )
    result = []
    for row in rows:
        p = row.product
        if not p or not p.is_active:
            continue
        pricing = next((pr for pr in p.pricing if pr.channel in channels and pr.is_active), None)
        result.append(WishlistProductOut(
            id=p.id, slug=p.slug, name=p.name,
            image_url=(p.image_urls.split(",")[0] if p.image_urls else None),
            price=pricing.price if pricing else None,
            mrp=pricing.mrp if pricing else None,
            stock=pricing.stock if pricing else None,
            min_quantity=pricing.min_quantity if pricing else None,
        ))
    return result


@router.get("/status/{product_id}", response_model=WishlistStatusOut)
def wishlist_status(product_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Lets the PDP ask 'is this one product saved?' without fetching the
    whole list — cheap enough to call on every product page view."""
    exists = db.query(WishlistItem).filter(WishlistItem.user_id == user.id, WishlistItem.product_id == product_id).first()
    return WishlistStatusOut(is_saved=exists is not None)


@router.post("", response_model=WishlistStatusOut)
def add_to_wishlist(payload: WishlistAdd, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = db.get(Product, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    existing = db.query(WishlistItem).filter(WishlistItem.user_id == user.id, WishlistItem.product_id == payload.product_id).first()
    if not existing:
        db.add(WishlistItem(user_id=user.id, product_id=payload.product_id))
        db.commit()
    return WishlistStatusOut(is_saved=True)


@router.delete("/{product_id}", response_model=WishlistStatusOut)
def remove_from_wishlist(product_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.query(WishlistItem).filter(WishlistItem.user_id == user.id, WishlistItem.product_id == product_id).first()
    if item:
        db.delete(item)
        db.commit()
    return WishlistStatusOut(is_saved=False)
