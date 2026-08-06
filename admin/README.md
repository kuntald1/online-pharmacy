# PillPoints — Admin Panel

React (Vite) admin console for PillPoints. Talks to the FastAPI backend
(`pillpoints-backend`) for everything — there's no separate data layer here.

Built and verified against a live instance of the backend: seeded real
categories, a brand, a channel-priced product (B2C + B2B Normal + B2B
Advance), a pending B2B application, and a CNF lead through the actual API,
then confirmed the app builds and every page's data-fetching code path lines
up with the backend's actual response shapes (field names, nesting, enum
values) rather than assumed ones.

## Setup

```bash
npm install
cp .env.example .env       # point VITE_API_URL at your backend, default http://localhost:8000
npm run dev                # http://localhost:5173
```

You'll need an admin user in the backend to log in — the backend has no
open admin-signup route by design (admins are seeded directly), so create
one manually, e.g.:

```bash
# from the backend's venv, with DATABASE_URL set
python3 -c "
from app.core.database import SessionLocal
from app.models.user import User
from app.models.enums import UserRole
from app.core.security import hash_password

db = SessionLocal()
db.add(User(name='Admin', phone='9999999999', password_hash=hash_password('yourpassword'), role=UserRole.admin))
db.commit()
"
```

## Design

- **Colors** pulled directly from the Healthycian-style logo you shared:
  teal `#02A694` (primary actions), blue `#1FAFE8` (secondary/info), ink
  `#14201F` on a calm off-white `#F5F8F7` background.
- **Type**: Space Grotesk for headers and numbers (a little technical,
  suits a data-heavy admin tool), Inter for body/UI text, IBM Plex Mono for
  SKUs and slugs.
- **Signature element**: status pills styled like a lab-requisition chip
  (dot + label) for B2B application and CNF lead states, since the
  approve/reject verification workflow is the one thing this product does
  that a generic e-commerce admin doesn't. A small teal "+" mark (echoing
  the HC+ logo) is used sparingly as a section eyebrow — not repeated
  everywhere, so it stays a signature rather than decoration.

## Pages

| Route | Purpose |
|---|---|
| `/login` | Admin sign-in |
| `/` | Dashboard — live counts from products/categories/brands + pending B2B/CNF queues |
| `/products` | Create products with **per-channel pricing**: B2C, B2B Normal, B2B Advance (price, MOQ, stock each), real multi-image upload, inventory fields (ROL/batch/expiry/rack), and **Import from Excel** (bulk upsert-by-SKU) |
| `/categories` | Storefront category grid management |
| `/brands` | Brand management, toggle "Discover New Brands" featuring |
| `/banners` | Hero/promo banners, scoped to B2C or B2B channel |
| `/orders/b2c` | B2C order queue with status filter and inline "Move to…" status updates |
| `/orders/b2b` | Same, scoped to B2B Normal + Advance orders |
| `/orders/b2c` | B2C order queue with status filter and inline "Move to…" status updates |
| `/orders/b2b` | Same, scoped to B2B Normal + Advance orders |
| `/b2b-applications` | KYC review queue — approve/reject pending B2B signups |
| `/cnf-leads` | CNF form submissions with WhatsApp delivery status |
| `/customers` | All B2C/B2B accounts, searchable, filterable by channel |
| `/inventory` | Stock across every channel per product, inline-editable |
| `/coupons` | Offers & Coupons — create codes, toggle active/inactive |
| `/marketing` | Real overview of live banners + coupons (not a fabricated campaigns module — see note below) |
| `/reports` | Sales/order aggregation across both channels, reuses the dashboard's chart components |
| `/cms` | Edit storefront content blocks (homepage hero copy, footer text, or any custom key) |
| `/settings` | Store-level settings (support email, business name, etc.) + change your own password |

## Known gaps (see backend README too)

- No image upload — banner/product/category images are pasted as URLs for
  now. Add a `/api/admin/upload` endpoint + file input once you're ready.
- No edit/delete UI for catalog entities (products/categories/brands/banners)
  — only create. The backend doesn't have those PATCH/DELETE routes yet
  either, so both need to land together.
- **Marketing** is honestly scoped: it surfaces real banners and coupons
  data, not a fabricated campaigns/email module. If you need scheduled
  promotions or audience segments, that's new backend work, not just a UI.
- **Coupons aren't applied at checkout yet** — the admin can create/manage
  them, but `/api/checkout` doesn't accept a coupon code. Data management
  works; the customer-facing discount logic doesn't exist yet.
- **CMS content isn't rendered anywhere** — this manages the data (via
  `app_settings`), but there's no B2C storefront yet to actually display
  homepage hero text or footer copy. It'll matter once that's built.
