"""
Seeds Healthycian with realistic sample data for testing — an admin user,
categories (with a mix of B2C/B2B/Both visibility), brands, products with
full pricing tiers, and banners (hero + promo strip).

Safe to re-run: checks for existing rows by unique field (phone/slug/sku)
before inserting, so running it twice won't create duplicates.

Usage:
    # Standalone (venv activated, DATABASE_URL set):
    python scripts/seed_data.py

    # Docker:
    docker compose exec backend python scripts/seed_data.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.catalog import Category, Brand, Product, ProductPricing, Banner
from app.models.enums import UserRole, PricingChannel, Visibility
from app.core.security import hash_password


def get_or_create(db, model, defaults=None, **lookup):
    instance = db.query(model).filter_by(**lookup).first()
    if instance:
        return instance, False
    params = {**lookup, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def main():
    db = SessionLocal()

    # --- Admin user ---
    admin, created = get_or_create(
        db, User, phone="9999999999",
        defaults={
            "name": "Admin",
            "password_hash": hash_password("admin123"),
            "role": UserRole.admin,
        },
    )
    print(f"{'Created' if created else 'Already exists'}: admin user (phone 9999999999 / password admin123)")

    # --- Categories ---
    categories_data = [
        ("Diabetes Care", "diabetes-care", Visibility.both),
        ("Baby Care", "baby-care", Visibility.both),
        ("Fitness", "fitness", Visibility.both),
        ("Ayurveda", "ayurveda", Visibility.b2c),
        ("Homeopathy", "homeopathy", Visibility.b2c),
        ("Surgical Products", "surgical-products", Visibility.b2b),
    ]
    categories = {}
    for name, slug, visibility in categories_data:
        cat, created = get_or_create(db, Category, slug=slug, defaults={"name": name, "visibility": visibility, "sort_order": 0})
        categories[slug] = cat
        print(f"{'Created' if created else 'Already exists'}: category '{name}' ({visibility.value})")

    # --- Brands ---
    brands_data = [
        ("Accu-Chek", "accu-chek", True, Visibility.both),
        ("TrueBasics", "truebasics", True, Visibility.b2c),
        ("Mamaearth", "mamaearth", True, Visibility.b2c),
        ("Dr. Vaidya's", "dr-vaidyas", False, Visibility.both),
    ]
    brands = {}
    for name, slug, featured, visibility in brands_data:
        brand, created = get_or_create(
            db, Brand, slug=slug,
            defaults={"name": name, "is_featured": featured, "visibility": visibility},
        )
        brands[slug] = brand
        print(f"{'Created' if created else 'Already exists'}: brand '{name}'")

    # --- Products ---
    products_data = [
        {
            "sku": "SKU-GLU-001", "name": "Glucometer Pro", "category": "diabetes-care", "brand": "accu-chek",
            "description": "Blood glucose monitor with 10-second results",
            "reorder_level": 20, "batch_number": "BATCH-2026-07", "rack_place": "Rack A-3",
            "pricing": [
                {"channel": PricingChannel.b2c, "price": 999, "mrp": 1200, "min_quantity": 1, "stock": 50},
                {"channel": PricingChannel.b2b_normal, "price": 250, "min_quantity": 15, "stock": 500},
                {"channel": PricingChannel.b2b_advance, "price": 200, "min_quantity": 30, "stock": 500},
            ],
        },
        {
            "sku": "SKU-VITD-001", "name": "Vitamin D3 1000IU", "category": "fitness", "brand": "truebasics",
            "description": "Daily vitamin D3 supplement, 60 capsules",
            "reorder_level": 30, "rack_place": "Rack B-1",
            "pricing": [
                {"channel": PricingChannel.b2c, "price": 349, "mrp": 450, "min_quantity": 1, "stock": 120},
                {"channel": PricingChannel.b2b_normal, "price": 220, "min_quantity": 20, "stock": 800},
            ],
        },
        {
            "sku": "SKU-BABY-001", "name": "Baby Diaper Pants (M)", "category": "baby-care", "brand": "mamaearth",
            "description": "Ultra-soft diaper pants, pack of 44",
            "reorder_level": 25, "rack_place": "Rack D-2",
            "pricing": [
                {"channel": PricingChannel.b2c, "price": 599, "mrp": 699, "min_quantity": 1, "stock": 8},
            ],
        },
        {
            "sku": "SKU-SURG-001", "name": "Surgical Gloves (Box of 100)", "category": "surgical-products", "brand": None,
            "description": "Latex-free examination gloves",
            "reorder_level": 50, "rack_place": "Rack E-1",
            "pricing": [
                {"channel": PricingChannel.b2b_normal, "price": 450, "min_quantity": 10, "stock": 200},
                {"channel": PricingChannel.b2b_advance, "price": 400, "min_quantity": 25, "stock": 200},
            ],
        },
    ]

    for p in products_data:
        product = db.query(Product).filter(Product.sku == p["sku"]).first()
        is_new = product is None
        if is_new:
            slug = p["name"].lower().replace(" ", "-").replace("(", "").replace(")", "")
            product = Product(sku=p["sku"], slug=slug)
            db.add(product)

        product.name = p["name"]
        product.description = p["description"]
        product.category_id = categories[p["category"]].id if p["category"] else None
        product.brand_id = brands[p["brand"]].id if p["brand"] else None
        product.reorder_level = p["reorder_level"]
        product.batch_number = p.get("batch_number")
        product.rack_place = p.get("rack_place")
        db.flush()

        for row in p["pricing"]:
            pricing = db.query(ProductPricing).filter(
                ProductPricing.product_id == product.id, ProductPricing.channel == row["channel"]
            ).first()
            if not pricing:
                pricing = ProductPricing(product_id=product.id, channel=row["channel"])
                db.add(pricing)
            pricing.price = row["price"]
            pricing.mrp = row.get("mrp")
            pricing.min_quantity = row["min_quantity"]
            pricing.stock = row["stock"]

        print(f"{'Created' if is_new else 'Updated'}: product '{p['name']}' ({p['sku']})")

    # --- Banners ---
    banners_data = [
        {
            "title": "Your Trusted Partner in Better Health",
            "image_url": "https://placehold.co/1200x400/1FAFE8/FFFFFF?text=Healthycian",
            "channel": PricingChannel.b2c, "position": "hero",
        },
        {
            "title": "Flat 20% off on first order",
            "image_url": "https://placehold.co/400x300/02A694/FFFFFF?text=Flat+20%25+Off",
            "channel": PricingChannel.b2c, "position": "promo_strip",
        },
        {
            "title": "Up to 30% off wellness essentials",
            "image_url": "https://placehold.co/400x300/1FAFE8/FFFFFF?text=Wellness+30%25+Off",
            "channel": PricingChannel.b2c, "position": "promo_strip",
        },
        {
            "title": "Diabetes Care special offer",
            "image_url": "https://placehold.co/400x300/E8A33D/FFFFFF?text=Diabetes+Care",
            "channel": PricingChannel.b2c, "position": "promo_strip",
        },
    ]
    for b in banners_data:
        banner, created = get_or_create(
            db, Banner, title=b["title"],
            defaults={"image_url": b["image_url"], "channel": b["channel"], "position": b["position"], "sort_order": 0},
        )
        print(f"{'Created' if created else 'Already exists'}: banner '{b['title']}'")

    db.commit()
    print("\nDone. Log into the admin panel with phone 9999999999 / password admin123.")


if __name__ == "__main__":
    main()
