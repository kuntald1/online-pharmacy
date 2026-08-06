from datetime import datetime, date

from sqlalchemy import String, DateTime, Boolean, ForeignKey, Integer, Numeric, Enum, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import PricingChannel, Visibility


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility), default=Visibility.both)

    products: Mapped[list["Product"]] = relationship(back_populates="category")


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)  # shows in "Discover New Brands"
    visibility: Mapped[Visibility] = mapped_column(Enum(Visibility), default=Visibility.both)

    products: Mapped[list["Product"]] = relationship(back_populates="brand")


class Manufacturer(Base):
    """Master list of manufacturers for the product compliance block. A
    manufacturer's address lives here, not on the product — selecting a
    manufacturer on a product auto-fills its address read-only, and editing
    an address here corrects it everywhere that manufacturer is used."""
    __tablename__ = "manufacturers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    products: Mapped[list["Product"]] = relationship(back_populates="manufacturer")


class Marketer(Base):
    """Same idea as Manufacturer, kept as a separate master since a product's
    manufacturer and marketer are frequently different legal entities."""
    __tablename__ = "marketers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)

    products: Mapped[list["Product"]] = relationship(back_populates="marketer")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_urls: Mapped[str | None] = mapped_column(Text, nullable=True)  # comma-separated or JSON string
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
    brand_id: Mapped[int | None] = mapped_column(ForeignKey("brands.id"), nullable=True)
    is_prescription_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # "Other information" compliance block. Manufacturer and marketer are
    # picked from their master lists (not typed) so the address always comes
    # from a single source of truth instead of drifting per-product. Country
    # of origin stays a plain string column — the admin UI constrains it to a
    # fixed dropdown, but there's no real need for a whole master table for
    # ~200 countries. Expiry is month + year, not a full date, since that's
    # what's actually printed on pharma packaging.
    manufacturer_id: Mapped[int | None] = mapped_column(ForeignKey("manufacturers.id"), nullable=True)
    marketer_id: Mapped[int | None] = mapped_column(ForeignKey("marketers.id"), nullable=True)
    country_of_origin: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expiry_month: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-12
    expiry_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Inventory management
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)  # trigger restock alert below this stock
    batch_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    rack_place: Mapped[str | None] = mapped_column(String(100), nullable=True)  # physical warehouse location

    # Variants (e.g. Volini Gel 100gm / 200gm / 400gm). Each size is still its own
    # full Product row with its own SKU/stock/pricing — variant_group_id is just a
    # shared token that says "these products are the same item in different sizes",
    # so the storefront can render them as one PDP with a size-picker instead of as
    # unrelated products. Null means "not part of any variant group" (a standalone
    # product), which is the default for everything that exists today.
    variant_group_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    variant_label: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "100 gm Gel"

    # "In the Spotlight" — a manually curated, admin-controlled promo carousel
    # (shown as sponsored/featured placements), not an algorithmic
    # recommendation. spotlight_order controls left-to-right position when
    # multiple products are spotlighted; ties fall back to product id.
    is_spotlighted: Mapped[bool] = mapped_column(Boolean, default=False)
    spotlight_order: Mapped[int] = mapped_column(Integer, default=0)

    # When true (default) and no manual relation rows exist for a given type
    # on this product, the public /related endpoint falls back to rule-based
    # suggestions (see app/services/suggestions.py) instead of showing
    # nothing. Manual links, when present, always win regardless of this flag.
    auto_generate_relations: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped["Category | None"] = relationship(back_populates="products")
    brand: Mapped["Brand | None"] = relationship(back_populates="products")
    manufacturer: Mapped["Manufacturer | None"] = relationship(back_populates="products")
    marketer: Mapped["Marketer | None"] = relationship(back_populates="products")
    pricing: Mapped[list["ProductPricing"]] = relationship(back_populates="product", cascade="all, delete-orphan")
    reviews: Mapped[list["Review"]] = relationship(back_populates="product", cascade="all, delete-orphan")


class ProductPricing(Base):
    """
    One product can have up to 3 rows: b2c, b2b_normal, b2b_advance.
    Admin sets price + minimum order quantity + stock per channel.
    """
    __tablename__ = "product_pricing"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    channel: Mapped[PricingChannel] = mapped_column(Enum(PricingChannel))
    mrp: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    price: Mapped[float] = mapped_column(Numeric(10, 2))
    min_quantity: Mapped[int] = mapped_column(Integer, default=1)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0)  # per-channel now, not product-wide —
    # B2C, B2B Normal, and B2B Advance can genuinely have different stock levels and reorder thresholds
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    product: Mapped["Product"] = relationship(back_populates="pricing")


class Banner(Base):
    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    image_url: Mapped[str] = mapped_column(String(500))
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    channel: Mapped[Visibility] = mapped_column(Enum(Visibility), default=Visibility.b2c)
    position: Mapped[str] = mapped_column(String(50), default="hero")  # hero, promo_strip, etc
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
