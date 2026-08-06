from datetime import datetime
from pydantic import BaseModel
from app.models.enums import Visibility


class HealthPackageOut(BaseModel):
    id: int
    title: str
    image_url: str
    mrp: float | None = None
    price: float
    link_url: str | None = None
    is_popular: bool

    class Config:
        from_attributes = True


class HealthPackageCreate(BaseModel):
    title: str
    image_url: str
    mrp: float | None = None
    price: float
    link_url: str | None = None
    is_popular: bool = False
    visibility: Visibility = Visibility.both
    sort_order: int = 0


class HealthPackageAdminOut(HealthPackageCreate):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class HealthPackageUpdate(BaseModel):
    title: str | None = None
    image_url: str | None = None
    mrp: float | None = None
    price: float | None = None
    link_url: str | None = None
    is_popular: bool | None = None
    is_active: bool | None = None
    visibility: Visibility | None = None
    sort_order: int | None = None
