from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.delivery_zone import DeliveryZone
from app.models.user import User
from app.schemas.delivery_zone import (
    DeliveryZoneOut, DeliveryZoneCreate, DeliveryZoneUpdate, DeliveryEstimateOut,
)
from app.api.deps import require_admin

router = APIRouter(prefix="/api", tags=["delivery"])


@router.get("/delivery-estimate", response_model=DeliveryEstimateOut)
def get_delivery_estimate(pincode: str = Query(..., min_length=4, max_length=10), db: Session = Depends(get_db)):
    """No auth required — this is the 'Check delivery date' pincode box
    on the PDP, usable before login, same reasoning as the coupon browse
    endpoint. Only pincodes an admin has explicitly configured return a
    real estimate; anything else is told honestly that it's not confirmed
    yet, rather than guessing a delivery-day count nobody's actually
    verified for that area."""
    pincode = pincode.strip()
    zone = db.query(DeliveryZone).filter(DeliveryZone.pincode == pincode).first()

    if not zone:
        return DeliveryEstimateOut(
            deliverable=False, pincode=pincode,
            message="We don't have a confirmed delivery estimate for this pincode yet — you can still place an order and we'll follow up on timing.",
        )
    if not zone.is_deliverable:
        return DeliveryEstimateOut(
            deliverable=False, pincode=pincode,
            message="Sorry, we don't currently deliver to this pincode.",
        )

    delivery_date = date.today() + timedelta(days=zone.delivery_days)
    label = f" ({zone.label})" if zone.label else ""
    return DeliveryEstimateOut(
        deliverable=True, pincode=pincode, delivery_days=zone.delivery_days,
        delivery_date=delivery_date.isoformat(),
        message=f"Delivers to {pincode}{label} in {zone.delivery_days} day{'s' if zone.delivery_days != 1 else ''} — by {delivery_date.strftime('%a, %d %b')}",
    )


@router.get("/admin/delivery-zones", response_model=list[DeliveryZoneOut])
def admin_list_delivery_zones(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(DeliveryZone).order_by(DeliveryZone.pincode).all()


@router.post("/admin/delivery-zones", response_model=DeliveryZoneOut)
def create_delivery_zone(payload: DeliveryZoneCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    existing = db.query(DeliveryZone).filter(DeliveryZone.pincode == payload.pincode.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="This pincode is already configured — edit it instead")
    zone = DeliveryZone(**{**payload.model_dump(), "pincode": payload.pincode.strip()})
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.patch("/admin/delivery-zones/{zone_id}", response_model=DeliveryZoneOut)
def update_delivery_zone(zone_id: int, payload: DeliveryZoneUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    zone = db.get(DeliveryZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Delivery zone not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(zone, field, value.strip() if field == "pincode" and value else value)
    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/admin/delivery-zones/{zone_id}")
def delete_delivery_zone(zone_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    zone = db.get(DeliveryZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Delivery zone not found")
    db.delete(zone)
    db.commit()
    return {"status": "deleted"}
