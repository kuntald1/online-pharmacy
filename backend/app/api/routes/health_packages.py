from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.health_package import HealthPackage
from app.models.enums import Visibility
from app.models.user import User
from app.schemas.health_package import (
    HealthPackageOut, HealthPackageCreate, HealthPackageAdminOut, HealthPackageUpdate,
)
from app.api.deps import require_admin

router = APIRouter(prefix="/api", tags=["health-packages"])


def _visibility_filter(query, channel: str | None):
    """Same broad matching as Category/Brand/Banner — see catalog.py."""
    if channel == "b2c":
        return query.filter(HealthPackage.visibility.in_([Visibility.b2c, Visibility.both, Visibility.all]))
    if channel == "b2b":
        return query.filter(HealthPackage.visibility.in_([Visibility.b2b, Visibility.both, Visibility.all]))
    if channel == "cnf":
        return query.filter(HealthPackage.visibility.in_([Visibility.cnf, Visibility.all]))
    return query


@router.get("/health-packages", response_model=list[HealthPackageOut])
def list_health_packages(
    channel: str | None = Query(None, pattern="^(b2c|b2b|cnf)$"),
    db: Session = Depends(get_db),
):
    q = db.query(HealthPackage).filter(HealthPackage.is_active == True)  # noqa: E712
    q = _visibility_filter(q, channel)
    return q.order_by(HealthPackage.sort_order, HealthPackage.id).all()


@router.get("/admin/health-packages", response_model=list[HealthPackageAdminOut])
def admin_list_health_packages(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    return db.query(HealthPackage).order_by(HealthPackage.sort_order, HealthPackage.id).all()


@router.post("/admin/health-packages", response_model=HealthPackageAdminOut)
def create_health_package(payload: HealthPackageCreate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    package = HealthPackage(**payload.model_dump())
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@router.patch("/admin/health-packages/{package_id}", response_model=HealthPackageAdminOut)
def update_health_package(package_id: int, payload: HealthPackageUpdate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    package = db.get(HealthPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(package, field, value)
    db.commit()
    db.refresh(package)
    return package


@router.delete("/admin/health-packages/{package_id}")
def delete_health_package(package_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    package = db.get(HealthPackage, package_id)
    if not package:
        raise HTTPException(status_code=404, detail="Package not found")
    db.delete(package)
    db.commit()
    return {"status": "deleted"}
