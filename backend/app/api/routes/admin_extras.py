from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.models.catalog import Product, ProductPricing
from app.models.settings import Coupon, AppSetting
from app.models.enums import UserRole, SettingCategory
from app.schemas.admin_extras import (
    CustomerOut, InventoryProductOut, StockUpdate,
    CouponCreate, CouponOut, CouponUpdate,
    AppSettingOut, AppSettingUpsert, ChangePasswordRequest,
)
from app.api.deps import require_admin, get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin-extras"])


# ---------- Customers ----------

@router.get("/customers", response_model=list[CustomerOut])
def list_customers(
    role: UserRole | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(User).filter(User.role != UserRole.admin)
    if role:
        q = q.filter(User.role == role)
    if search:
        like = f"%{search}%"
        q = q.filter((User.name.ilike(like)) | (User.phone.ilike(like)))
    return q.order_by(User.created_at.desc()).all()


# ---------- Inventory ----------

@router.get("/inventory", response_model=list[InventoryProductOut])
def list_inventory(
    low_stock_only: bool = False,
    threshold: int = 20,
    search: str | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every product with ALL its pricing rows (unlike the public /api/products,
    which only returns the row matching the requested channel)."""
    q = db.query(Product).options(joinedload(Product.pricing))
    if search:
        like = f"%{search}%"
        q = q.filter((Product.name.ilike(like)) | (Product.sku.ilike(like)))
    products = q.order_by(Product.name).all()
    if low_stock_only:
        def _is_low(p):
            # each pricing row now has its OWN reorder level (B2C, B2B Normal,
            # and B2B Advance can genuinely differ) — falls back to the
            # generic threshold only for rows where the admin hasn't set one
            return any(pr.stock < (pr.reorder_level if pr.reorder_level > 0 else threshold) for pr in p.pricing)
        products = [p for p in products if _is_low(p)]
    return products


@router.patch("/inventory/{pricing_id}/stock", response_model=InventoryProductOut)
def update_stock(pricing_id: int, payload: StockUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    pricing = db.get(ProductPricing, pricing_id)
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing row not found")
    pricing.stock = payload.stock
    db.commit()
    product = db.query(Product).options(joinedload(Product.pricing)).filter(Product.id == pricing.product_id).first()
    return product


# ---------- Coupons ----------

@router.get("/coupons", response_model=list[CouponOut])
def list_coupons(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(Coupon).order_by(Coupon.created_at.desc()).all()


@router.post("/coupons", response_model=CouponOut)
def create_coupon(payload: CouponCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    existing = db.query(Coupon).filter(Coupon.code == payload.code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="A coupon with this code already exists")
    coupon = Coupon(**{**payload.model_dump(), "code": payload.code.upper()})
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return coupon


@router.patch("/coupons/{coupon_id}", response_model=CouponOut)
def update_coupon(coupon_id: int, payload: CouponUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    coupon = db.get(Coupon, coupon_id)
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")

    updates = payload.model_dump(exclude_unset=True)
    if "code" in updates:
        updates["code"] = updates["code"].upper()
        existing = db.query(Coupon).filter(Coupon.code == updates["code"], Coupon.id != coupon_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="A coupon with this code already exists")

    for field, value in updates.items():
        setattr(coupon, field, value)

    db.commit()
    db.refresh(coupon)
    return coupon


# ---------- App Settings (CMS content + store settings) ----------

@router.get("/settings", response_model=list[AppSettingOut])
def list_settings(category: SettingCategory | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    q = db.query(AppSetting)
    if category:
        q = q.filter(AppSetting.category == category)
    return q.order_by(AppSetting.key).all()


@router.put("/settings/{key}", response_model=AppSettingOut)
def upsert_setting(key: str, payload: AppSettingUpsert, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    setting = db.get(AppSetting, key)
    if setting:
        setting.value = payload.value
        setting.category = payload.category
        setting.label = payload.label
        setting.updated_at = datetime.utcnow()
    else:
        setting = AppSetting(key=key, **payload.model_dump())
        db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


# ---------- Account settings ----------

@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"status": "password updated"}
