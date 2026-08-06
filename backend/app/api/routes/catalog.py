from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.config import settings
from app.models.catalog import Category, Brand, Product, ProductPricing, Banner, Manufacturer, Marketer
from app.models.settings import AppSetting
from app.models.enums import PricingChannel, Visibility
from app.models.user import User
from app.schemas.catalog import (
    CategoryCreate, CategoryOut, CategoryUpdate, BrandCreate, BrandOut, BrandUpdate,
    ProductCreate, ProductOut, ProductUpdate, BannerCreate, BannerOut, BannerUpdate,
    ProductVariantOut, LinkVariantRequest, ManufacturerCreate, ManufacturerOut,
    MarketerCreate, MarketerOut,
)
import secrets
from app.api.deps import require_admin, require_approved_b2b
from app.services import suggestions

router = APIRouter(prefix="/api", tags=["catalog"])

# Keys any visitor (not just admins) is allowed to read — deliberately a
# short allowlist, not "all settings are public", since app_settings also
# holds things like support_email that don't need a dedicated public route
# but definitely shouldn't be exposed via a blanket "everything is public"
# endpoint either.
PUBLIC_SETTING_KEYS = {"site_logo_url", "homepage_hero_title", "homepage_hero_subtitle", "footer_about_text"}


@router.get("/settings/public")
def get_public_settings(db: Session = Depends(get_db)):
    """No auth required — this is what the storefront reads for branding
    (site logo, etc). Lives under /api, not /api/admin, since it's the only
    settings route that's genuinely public."""
    rows = db.query(AppSetting).filter(AppSetting.key.in_(PUBLIC_SETTING_KEYS)).all()
    result = {row.key: row.value for row in rows}
    # Razorpay's public key ID is safe to expose — it's meant to be used
    # client-side (unlike RAZORPAY_KEY_SECRET, which never leaves the
    # server). The checkout page needs this to open the Razorpay widget.
    result["razorpay_key_id"] = settings.RAZORPAY_KEY_ID
    return result


def _visibility_filter(query, model, channel: str | None):
    """channel='b2c'/'b2b'/'cnf' returns rows visible to that channel — for
    b2c/b2b that means matching that channel's visibility, 'both', or 'all';
    for cnf, matching 'cnf' or 'all'. No channel param returns everything
    active, which is what the admin panel wants when managing the full list."""
    if channel == "b2c":
        return query.filter(model.visibility.in_([Visibility.b2c, Visibility.both, Visibility.all]))
    if channel == "b2b":
        return query.filter(model.visibility.in_([Visibility.b2b, Visibility.both, Visibility.all]))
    if channel == "cnf":
        return query.filter(model.visibility.in_([Visibility.cnf, Visibility.all]))
    return query


# ---------- Categories ----------

@router.get("/categories", response_model=list[CategoryOut])
def list_categories(
    channel: str | None = Query(None, pattern="^(b2c|b2b|cnf)$"),
    db: Session = Depends(get_db),
):
    q = db.query(Category).filter(Category.is_active == True)  # noqa: E712
    q = _visibility_filter(q, Category, channel)
    return q.order_by(Category.sort_order).all()


@router.post("/admin/categories", response_model=CategoryOut)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("/admin/categories", response_model=list[CategoryOut])
def list_all_categories_for_admin(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Unlike the public /api/categories, this includes inactive ones too —
    the admin needs to see and re-activate them, not just active rows."""
    return db.query(Category).order_by(Category.sort_order).all()


@router.patch("/admin/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/admin/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    # products referencing this category become uncategorized rather than
    # blocking the delete or leaving a dangling foreign key
    db.query(Product).filter(Product.category_id == category_id).update({"category_id": None})
    db.delete(category)
    db.commit()
    return {"status": "deleted"}


# ---------- Brands ----------

@router.get("/brands", response_model=list[BrandOut])
def list_brands(
    featured_only: bool = False,
    channel: str | None = Query(None, pattern="^(b2c|b2b|cnf)$"),
    db: Session = Depends(get_db),
):
    q = db.query(Brand).filter(Brand.is_active == True)  # noqa: E712
    q = _visibility_filter(q, Brand, channel)
    if featured_only:
        q = q.filter(Brand.is_featured == True)  # noqa: E712
    return q.all()


@router.post("/admin/brands", response_model=BrandOut)
def create_brand(payload: BrandCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    brand = Brand(**payload.model_dump())
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.get("/admin/brands", response_model=list[BrandOut])
def list_all_brands_for_admin(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Unlike the public /api/brands, this includes inactive ones too."""
    return db.query(Brand).all()


@router.patch("/admin/brands/{brand_id}", response_model=BrandOut)
def update_brand(brand_id: int, payload: BrandUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(brand, field, value)
    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/admin/brands/{brand_id}")
def delete_brand(brand_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    brand = db.get(Brand, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    db.query(Product).filter(Product.brand_id == brand_id).update({"brand_id": None})
    db.delete(brand)
    db.commit()
    return {"status": "deleted"}


# ---------- Manufacturer / Marketer masters ----------
# Admin-only (not needed on the public storefront directly — a product's
# nested `manufacturer`/`marketer` object on ProductOut is how the storefront
# sees the name/address, not these list endpoints).

@router.get("/admin/manufacturers", response_model=list[ManufacturerOut])
def list_manufacturers(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(Manufacturer).order_by(Manufacturer.name).all()


@router.post("/admin/manufacturers", response_model=ManufacturerOut)
def create_manufacturer(payload: ManufacturerCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    existing = db.query(Manufacturer).filter(Manufacturer.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A manufacturer with this name already exists")
    manufacturer = Manufacturer(**payload.model_dump())
    db.add(manufacturer)
    db.commit()
    db.refresh(manufacturer)
    return manufacturer


@router.patch("/admin/manufacturers/{manufacturer_id}", response_model=ManufacturerOut)
def update_manufacturer(manufacturer_id: int, payload: ManufacturerCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    manufacturer = db.get(Manufacturer, manufacturer_id)
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    manufacturer.name = payload.name
    manufacturer.address = payload.address
    db.commit()
    db.refresh(manufacturer)
    return manufacturer


@router.delete("/admin/manufacturers/{manufacturer_id}")
def delete_manufacturer(manufacturer_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    manufacturer = db.get(Manufacturer, manufacturer_id)
    if not manufacturer:
        raise HTTPException(status_code=404, detail="Manufacturer not found")
    # products referencing this manufacturer just lose the reference, same
    # pattern as deleting a category or brand — not blocked, not cascaded
    db.query(Product).filter(Product.manufacturer_id == manufacturer_id).update({"manufacturer_id": None})
    db.delete(manufacturer)
    db.commit()
    return {"status": "deleted"}


@router.get("/admin/marketers", response_model=list[MarketerOut])
def list_marketers(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(Marketer).order_by(Marketer.name).all()


@router.post("/admin/marketers", response_model=MarketerOut)
def create_marketer(payload: MarketerCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    existing = db.query(Marketer).filter(Marketer.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A marketer with this name already exists")
    marketer = Marketer(**payload.model_dump())
    db.add(marketer)
    db.commit()
    db.refresh(marketer)
    return marketer


@router.patch("/admin/marketers/{marketer_id}", response_model=MarketerOut)
def update_marketer(marketer_id: int, payload: MarketerCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    marketer = db.get(Marketer, marketer_id)
    if not marketer:
        raise HTTPException(status_code=404, detail="Marketer not found")
    marketer.name = payload.name
    marketer.address = payload.address
    db.commit()
    db.refresh(marketer)
    return marketer


@router.delete("/admin/marketers/{marketer_id}")
def delete_marketer(marketer_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    marketer = db.get(Marketer, marketer_id)
    if not marketer:
        raise HTTPException(status_code=404, detail="Marketer not found")
    db.query(Product).filter(Product.marketer_id == marketer_id).update({"marketer_id": None})
    db.delete(marketer)
    db.commit()
    return {"status": "deleted"}


# ---------- Banners ----------

@router.get("/banners", response_model=list[BannerOut])
def list_banners(
    channel: Visibility = Query(Visibility.b2c),
    position: str | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Banner).filter(Banner.is_active == True)  # noqa: E712
    if channel == Visibility.b2c:
        q = q.filter(Banner.channel.in_([Visibility.b2c, Visibility.both, Visibility.all]))
    elif channel == Visibility.b2b:
        q = q.filter(Banner.channel.in_([Visibility.b2b, Visibility.both, Visibility.all]))
    elif channel == Visibility.cnf:
        q = q.filter(Banner.channel.in_([Visibility.cnf, Visibility.all]))
    if position:
        q = q.filter(Banner.position == position)
    return q.order_by(Banner.sort_order).all()


@router.get("/admin/banners", response_model=list[BannerOut])
def list_all_banners_for_admin(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Unlike the public /api/banners, this includes inactive ones and isn't
    filtered by channel — the admin panel manages everything in one list."""
    return db.query(Banner).order_by(Banner.sort_order).all()


@router.post("/admin/banners", response_model=BannerOut)
def create_banner(payload: BannerCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    banner = Banner(**payload.model_dump())
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


@router.patch("/admin/banners/{banner_id}", response_model=BannerOut)
def update_banner(banner_id: int, payload: BannerUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    banner = db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(banner, field, value)
    db.commit()
    db.refresh(banner)
    return banner


@router.delete("/admin/banners/{banner_id}")
def delete_banner(banner_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    banner = db.get(Banner, banner_id)
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found")
    db.delete(banner)
    db.commit()
    return {"status": "deleted"}


# ---------- Products ----------

def _visible_channels_for(channel: str) -> list[PricingChannel]:
    """Maps the generic storefront channel ('b2c' / 'b2b' / 'cnf' — what the
    URL and login role actually are) onto the concrete PricingChannel
    row(s) to read. A 'b2b' request always returns BOTH b2b tiers — that's
    deliberate, not a placeholder: the product detail page shows Normal and
    Advance side by side so a B2B account can pick either, since there's no
    per-account tier on file to pre-select one over the other. Also accepts
    'b2b_normal'/'b2b_advance' directly as synonyms for the same "give me
    both tiers" behavior, since a bare pricing-tier value reaching here
    (e.g. from an older link) means the same thing as generic 'b2b'."""
    if channel == "b2c":
        return [PricingChannel.b2c]
    if channel == "cnf":
        return [PricingChannel.cnf]
    return [PricingChannel.b2b_normal, PricingChannel.b2b_advance]


CHANNEL_PATTERN = "^(b2c|b2b|b2b_normal|b2b_advance|cnf)$"


@router.get("/products", response_model=list[ProductOut])
def list_products(
    channel: str = Query("b2c", pattern=CHANNEL_PATTERN, description="b2c, b2b (both tiers), or cnf"),
    category_id: int | None = None,
    brand_id: int | None = None,
    search: str | None = None,
    spotlight_only: bool = Query(False, description="Only return products marked 'In the Spotlight' by the admin"),
    exclude_slug: str | None = Query(None, description="Slug to leave out of the results — e.g. the product a PDP is currently showing"),
    db: Session = Depends(get_db),
):
    """
    Public catalog listing, filtered so a B2C visitor never sees B2B/CNF
    pricing and vice versa. Only products that have an active pricing row
    for the requested channel are returned.
    """
    channels = _visible_channels_for(channel)

    q = (
        db.query(Product)
        .join(ProductPricing)
        .options(joinedload(Product.pricing), joinedload(Product.manufacturer), joinedload(Product.marketer))
        .filter(Product.is_active == True, ProductPricing.channel.in_(channels), ProductPricing.is_active == True)  # noqa: E712
    )
    if category_id:
        q = q.filter(Product.category_id == category_id)
    if brand_id:
        q = q.filter(Product.brand_id == brand_id)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    if spotlight_only:
        q = q.filter(Product.is_spotlighted == True)  # noqa: E712
    if exclude_slug:
        q = q.filter(Product.slug != exclude_slug)
    if spotlight_only:
        q = q.order_by(Product.spotlight_order, Product.id)

    products = q.distinct().all()
    # strip pricing rows that don't belong to the requested channel set before returning
    for p in products:
        p.pricing = [pr for pr in p.pricing if pr.channel in channels]
    return products


@router.get("/products/{slug}", response_model=ProductOut)
def get_product(slug: str, channel: str = Query("b2c", pattern=CHANNEL_PATTERN), db: Session = Depends(get_db)):
    product = db.query(Product).options(joinedload(Product.pricing), joinedload(Product.manufacturer), joinedload(Product.marketer)).filter(Product.slug == slug).first()
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Product not found")
    channels = _visible_channels_for(channel)
    product.pricing = [pr for pr in product.pricing if pr.channel in channels and pr.is_active]
    return product


@router.get("/products/{slug}/variants", response_model=list[ProductVariantOut])
def get_product_variants(slug: str, channel: str = Query("b2c", pattern=CHANNEL_PATTERN), db: Session = Depends(get_db)):
    """Siblings sharing this product's variant_group_id (e.g. the 100gm/200gm/400gm
    sizes of the same item), for the storefront's size-picker. Returns an empty list
    — not a 404 — when the product isn't part of any group, so the PDP can just
    hide the size-picker rather than treat it as an error."""
    product = db.query(Product).filter(Product.slug == slug).first()
    if not product or not product.is_active or not product.variant_group_id:
        return []

    channels = _visible_channels_for(channel)
    siblings = (
        db.query(Product)
        .options(joinedload(Product.pricing))
        .filter(Product.variant_group_id == product.variant_group_id, Product.is_active == True)  # noqa: E712
        .all()
    )

    result = []
    for sib in siblings:
        pricing = next((p for p in sib.pricing if p.channel in channels and p.is_active), None)
        result.append(ProductVariantOut(
            id=sib.id,
            slug=sib.slug,
            variant_label=sib.variant_label,
            price=pricing.price if pricing else None,
            mrp=pricing.mrp if pricing else None,
            stock=pricing.stock if pricing else None,
            image_url=(sib.image_urls.split(",")[0] if sib.image_urls else None),
            is_current=(sib.id == product.id),
        ))
    # smallest-price-first reads naturally as smallest-size-first for most products
    result.sort(key=lambda v: (v.price is None, v.price or 0))
    return result


@router.post("/admin/products", response_model=ProductOut)
def create_product(payload: ProductCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    data = payload.model_dump()
    pricing_rows = data.pop("pricing")
    product = Product(**data)
    db.add(product)
    db.flush()

    for row in pricing_rows:
        db.add(ProductPricing(product_id=product.id, **row))

    db.commit()
    db.refresh(product)
    return product


@router.get("/admin/products", response_model=list[ProductOut])
def list_all_products_for_admin(
    search: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Unlike the public /api/products, this returns every product (active
    or not) with ALL its pricing rows, and supports a search box matching
    name or SKU — what the admin Products page actually needs."""
    q = db.query(Product).options(joinedload(Product.pricing), joinedload(Product.manufacturer), joinedload(Product.marketer))
    if search:
        like = f"%{search}%"
        q = q.filter((Product.name.ilike(like)) | (Product.sku.ilike(like)))
    return q.order_by(Product.name).all()


@router.patch("/admin/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    data = payload.model_dump(exclude_unset=True)
    pricing_rows = data.pop("pricing", None)

    for field, value in data.items():
        setattr(product, field, value)

    if pricing_rows is not None:
        # replace all pricing rows wholesale — simpler and safer than trying
        # to diff/merge per-channel, and matches how the Excel import already
        # handles pricing updates
        db.query(ProductPricing).filter(ProductPricing.product_id == product_id).delete()
        for row in pricing_rows:
            db.add(ProductPricing(product_id=product_id, **row))

    db.commit()
    db.refresh(product)
    return product


@router.delete("/admin/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(product)  # cascades to pricing rows via the relationship
    db.commit()
    return {"status": "deleted"}


@router.post("/admin/products/{product_id}/link-variant", response_model=ProductOut)
def link_variant(product_id: int, payload: LinkVariantRequest, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Puts `product_id` into the same variant group as `target_product_id`.
    If the target isn't in a group yet, a new group is created covering both —
    the admin doesn't need to think about group IDs at all, just "link this
    product to that one"."""
    product = db.get(Product, product_id)
    target = db.get(Product, payload.target_product_id)
    if not product or not target:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.id == target.id:
        raise HTTPException(status_code=400, detail="Can't link a product to itself")

    if not target.variant_group_id:
        target.variant_group_id = secrets.token_hex(8)
    product.variant_group_id = target.variant_group_id

    db.commit()
    db.refresh(product)
    return product


@router.post("/admin/products/{product_id}/unlink-variant", response_model=ProductOut)
def unlink_variant(product_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Removes this product from its variant group. Other members of the group
    are untouched — if only one member remains after this, it's simply a group
    of one (harmless), rather than something that needs cleaning up."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.variant_group_id = None
    db.commit()
    db.refresh(product)
    return product


@router.get("/admin/products/{product_id}/variant-group", response_model=list[ProductOut])
def get_variant_group(product_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """The admin-side sibling list — full ProductOut (not the lightweight
    storefront ProductVariantOut) since the admin panel needs name/SKU to
    display it in the 'linked variants' list, not just price."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if not product.variant_group_id:
        return []
    return (
        db.query(Product)
        .options(joinedload(Product.pricing))
        .filter(Product.variant_group_id == product.variant_group_id, Product.id != product_id)
        .all()
    )


@router.get("/admin/products/{product_id}/variant-suggestions", response_model=list[ProductOut])
def get_variant_suggestions(product_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Rule-based candidates for 'this is probably another size of the same
    product' — same category, name collapses to the same stem once
    quantities/units are stripped out. Never auto-linked; the admin still
    clicks to confirm each one via the existing link-variant endpoint."""
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    already_linked_ids = set()
    if product.variant_group_id:
        already_linked_ids = {
            p.id for p in db.query(Product.id).filter(Product.variant_group_id == product.variant_group_id).all()
        }

    candidates = suggestions.suggest_variant_candidates(db, product)
    return [c for c in candidates if c.id not in already_linked_ids]
