# PillPoints — Backend

FastAPI + SQLAlchemy + PostgreSQL backend for the PillPoints medicine e-commerce
platform (B2C + B2B + CNF + Admin).

Verified: all models, migrations, and API flows below were tested end-to-end
(create-tables, admin login, product/category/brand creation, B2C checkout with
stock decrement, B2B apply → admin approve, per-tier MOQ enforcement, CNF lead
+ WhatsApp hook). Postgres itself couldn't be installed in the sandbox this was
built in (network-restricted), so the test run used SQLite as a stand-in —
swap `DATABASE_URL` to Postgres for real use, nothing else changes.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # then fill in real DB/Razorpay/WhatsApp values

# create the database in Postgres first, e.g.:
#   createdb pillpoints

alembic revision --autogenerate -m "init schema"
alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

## Project layout

```
app/
  core/        # config, DB session, JWT/password hashing
  models/      # SQLAlchemy tables (users, catalog, orders, cnf, enums)
  schemas/     # Pydantic request/response models
  api/
    deps.py    # auth dependencies (get_current_user, require_admin, require_approved_b2b, ...)
    routes/    # auth, b2b, catalog, orders, cnf
  services/    # razorpay_service.py, whatsapp.py
  main.py      # FastAPI app + router wiring
alembic/       # migrations
```

## Key design decisions (matches your spec)

- **Channel-aware pricing**: `product_pricing` has one row per `(product, channel)`
  where channel is `b2c`, `b2b_normal`, or `b2b_advance` — each with its own
  price, MRP, minimum order quantity, and stock. `/api/products?channel=...`
  only returns products that have an active pricing row for that channel, so a
  B2C visitor never sees B2B tiers and vice versa.
- **B2B onboarding**: `/api/b2b/apply` creates the KYC application (Aadhaar,
  PAN, GST, Driving Licence, Trade Licence) plus an inactive user account —
  no password is user-chosen. `/api/b2b/status/{phone}` lets them check status
  anytime. `/api/b2b/applications/{id}/review` (admin-only) approves or
  rejects; on approval it generates credentials and activates the account
  (currently just returns success — wire the generated password into an
  SMS/WhatsApp send in `app/services/whatsapp.py` before going live).
  `require_approved_b2b` in `deps.py` blocks ordering until approval even if
  the account can technically log in.
- **CNF**: `/api/cnf` (public) saves the lead and fires `notify_admin_of_cnf_lead`
  which posts to WhatsApp Cloud API. It fails silently (returns `False` on
  `whatsapp_notified`) if WhatsApp isn't configured yet, so lead capture never
  breaks because of a messaging outage.
- **Admin order management**: `/api/admin/orders?channel_group=b2c|b2b` (admin-only)
  lists every customer's orders split the way your mockup shows — B2C vs B2B —
  with `status_filter` support, plus customer name/phone and shipping address
  denormalized onto each row so the UI doesn't need extra requests.
  `/api/admin/orders/{id}` for detail, `PATCH /api/admin/orders/{id}/status`
  to move an order through `placed → confirmed → packed → shipped →
  delivered`/`cancelled`.
- **Customers**: `/api/admin/customers?role=b2c|b2b&search=` lists every
  non-admin user.
- **Inventory**: `/api/admin/inventory` returns every product with pricing
  rows for **all** channels (unlike the public `/api/products`, which only
  returns the channel you asked for) — this is what a stock-management view
  actually needs. `?low_stock_only=true&threshold=20` filters server-side.
  `PATCH /api/admin/inventory/{pricing_id}/stock` updates one channel's stock.
- **Coupons**: `/api/admin/coupons` (GET/POST), `PATCH .../{id}` to
  activate/deactivate. Codes are case-normalized to uppercase and enforced
  unique. Note: nothing currently *applies* a coupon at checkout — the
  `/api/checkout` endpoint doesn't accept a coupon code yet, so this is
  data management only until that's wired in.
- **App settings**: `/api/admin/settings?category=cms|store` (GET),
  `PUT /api/admin/settings/{key}` (upsert) — a generic key-value store
  backing both CMS content blocks (homepage hero copy, etc.) and store-level
  settings (support email, etc). Deliberately simple rather than a dedicated
  table per setting.
- **Change password**: `POST /api/admin/change-password` — any authenticated
  user can change their own password given the current one.
- **Category/Brand visibility**: both have a `visibility` field (`b2c`,
  `b2b`, or `both`, defaulting to `both`) so admin can scope which channel
  sees which category/brand. `GET /api/categories?channel=b2c` and
  `GET /api/brands?channel=b2c` (same for `b2b`) filter accordingly; no
  `channel` param returns everything, which is what the admin panel wants.
  Both entities also have `PATCH /api/admin/{categories,brands}/{id}` for
  edit and an active/inactive toggle.
- **Banners support "Both" channel too**: `Banner.channel` uses the same
  `visibility` enum as Categories/Brands. This needed a **data-safe
  migration**, not a naive type change — production already had real
  banner rows with values like `b2b_normal`/`b2b_advance` (from the old
  pricing-tier enum) that don't exist on the new type. Verified against
  real Postgres with exactly that scenario seeded before shipping: both
  old values correctly collapse to `b2b`, `b2c` stays `b2c`, and a new
  `both` banner correctly appears in both `?channel=b2c` and
  `?channel=b2b` queries. Also added `PATCH`/`DELETE
  /api/admin/banners/{id}` and `GET /api/admin/banners` (all banners
  including inactive, for the admin panel — unlike the public
  `GET /api/banners` which only returns active + channel-filtered ones).
  Worth knowing: two more real Alembic/Postgres bugs were caught and fixed
  along the way (enum type collisions when two columns share a new enum
  type in one migration, and `op.add_column` not auto-creating enum types
  the way `op.create_table` does) — same lessons as the coupons/inventory
  migrations, different columns.
- **Image uploads**: `POST /api/admin/upload` (admin-only, multipart, field
  name `files`, repeatable) accepts up to 10 images at once (JPEG/PNG/WebP/
  GIF, 5MB max each), saves them to local disk under `uploads/` (configurable
  via `UPLOAD_DIR` env var), and serves them back at `/uploads/<filename>`.
  Returns relative paths — the frontend resolves them to absolute URLs using
  its own `VITE_API_URL`, since the backend doesn't know its own public-facing
  domain. **In Docker, this needs a persistent volume** (`pillpoints_uploads`
  in `docker-compose.yml`) or every uploaded image is lost on container
  restart — it's just a directory inside the container filesystem otherwise.
- **Product inventory fields**: `batch_number`, `expiry_date`, `rack_place` —
  on `Product`, single-batch tracking (one batch/expiry/rack per product,
  not per-channel and not multiple concurrent batches of the same product).
  `reorder_level` moved from `Product` to `ProductPricing` — **it's per
  channel now**, not per product: B2C, B2B Normal, and B2B Advance can each
  have their own reorder threshold, since their stock levels are usually
  very different in practice. Migrated with a real data-carrying migration,
  not a reset-to-zero — verified against real Postgres with pre-existing
  pricing rows before shipping: a product's old product-level
  `reorder_level` value gets copied into all of that product's pricing
  rows, so nothing an admin already configured gets silently lost. The
  `/api/admin/inventory` endpoint's `low_stock_only` filter now checks each
  pricing row's own `reorder_level` (falls back to the generic `threshold`
  query param for rows where it's unset).
- **Excel bulk import**: `GET /api/admin/products/import-template` downloads
  a ready-to-fill `.xlsx` (correct columns + one example row).
  `POST /api/admin/products/import` uploads a filled one — upserts by SKU
  (matching SKU updates that product instead of creating a duplicate, so
  it's safe to re-upload the same file after fixing errors), replaces
  pricing rows for whichever channels have a price filled in, and returns
  `{created, updated, errors: [{row, message}]}` so the frontend can show
  exactly which rows had problems (unknown category/brand slug, etc.)
  without failing the whole import.
- **Seed script**: `scripts/seed_data.py` — a standalone script (run with
  `python scripts/seed_data.py`, or `docker compose exec backend python
  scripts/seed_data.py`) that populates an admin user, categories, brands,
  products with full pricing tiers, and banners. Genuinely idempotent —
  verified running it twice produces identical row counts, not duplicates
  (it upserts by unique field: phone, slug, or SKU).

  `b2b`, or `both`, defaulting to `both`) so admin can scope which channel
  sees which category/brand. `GET /api/categories?channel=b2c` and
  `GET /api/brands?channel=b2c` (same for `b2b`) filter accordingly; no
  `channel` param returns everything, which is what the admin panel wants.
  Worth knowing: I hit two real Alembic/Postgres bugs building this — enum
  type collisions when two columns in one migration share a new enum type
  (`op.add_column` doesn't auto-create enum types the way `op.create_table`
  does), and a NOT NULL column added to tables that already have rows needs
  a `server_default`, not just a Python-side model default. Both are fixed
  in the migration and verified against real Postgres with pre-existing
  rows, not just SQLite.
- **Cart → Checkout → Payment**: `/api/checkout` validates stock, computes
  totals from the live `product_pricing` row (never trusts client-sent
  prices), decrements stock, and either marks the order `confirmed` (COD) or
  creates a Razorpay order + `Payment` row (`/api/payments/verify` checks the
  HMAC signature before marking paid). Carts are single-channel — adding a
  B2B item to a cart that already has B2C items (or vice versa) is rejected
  with a 400, since checkout assigns one channel to the whole order; call
  `DELETE /api/cart` to clear and switch. This was caught by an actual test
  failure during development, not designed upfront — worth knowing if you
  extend checkout further.

## What's stubbed / needs real credentials before production

- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — currently unset, checkout with
  `payment_mode=razorpay` will fail until these are real.
- `WHATSAPP_API_URL` / `WHATSAPP_ACCESS_TOKEN` / `ADMIN_WHATSAPP_NUMBER` — same,
  for CNF lead + B2B approval notifications.
- File uploads for product images and B2B KYC documents (Aadhaar/PAN/GST/trade
  licence scans) — models have the URL columns (`image_urls`, `aadhar_doc_url`,
  etc.) but there's no upload endpoint yet; add S3-compatible storage + a
  `/api/admin/upload` route next.
- Admin dashboard's aggregate stats (total sales, order status donut, low
  stock alerts from your mockup) — the raw data (`orders`, `product_pricing.stock`)
  is all there, just needs a `/api/admin/dashboard` endpoint that aggregates it.

## Next up

Frontend (React) can now be built against this API. Suggested order:
1. Admin panel (product/category/brand/banner CRUD, B2B approval queue, CNF queue)
2. B2C storefront (home, catalog, product detail, cart, checkout)
3. B2B onboarding + gated storefront
