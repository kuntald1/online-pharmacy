# PillPoints — Storefront (B2C/B2B)

React (Vite) customer-facing storefront. Talks to the same backend as the
admin panel — nothing here has its own data layer.

## Setup

```bash
npm install
cp .env.example .env       # point VITE_API_URL at your backend, default http://localhost:8000
npm run dev                # http://localhost:5173
```

## What's actually built and verified this pass

I seeded real categories, a featured brand, a B2C-priced product, and a hero
banner through the live backend, then confirmed every component's fetch call
matches the real response shape field-for-field (not just that both sides
compile independently):

- **`/` — Landing gate**: B2C / B2B / CNF selection, matching the spec
- **`/b2c` — B2C homepage**: hero banner slider (auto-rotating, real banners),
  Shop by Category grid, Popular Medicines grid, Discover New Brands strip —
  all pulling live from the backend, nothing hardcoded
- **`/cnf` — CNF lead form**: submits to the real `/api/cnf` endpoint,
  confirmed it fires through to the backend (WhatsApp delivery depends on
  `WHATSAPP_*` env vars being set on the backend, same as before)

## What's intentionally NOT built yet (see it before you hit it)

- **`/b2b`** shows an honest placeholder, not a working storefront. Real
  wholesale pricing shouldn't be publicly browsable before the B2B login
  gate exists — so rather than fake that gate or leak pricing, this page
  says plainly that it's not built yet.
- **B2B onboarding form** (Aadhaar/PAN/GST/Driving Licence/Trade Licence KYC)
  — the backend (`/api/b2b/apply`) is fully built and tested, this frontend
  form isn't yet.
- **Cart, checkout, login/signup** — the header has visual placeholders
  (search works and routes to a `/search` path that doesn't have a page
  yet either; Cart/Login buttons are present but inert). None of this was
  in scope for this pass — see the backend's `/api/cart`, `/api/checkout`,
  `/api/auth` for what's already there to build against.
- **Product detail pages** — product cards don't link anywhere yet; "Add to
  Cart" is visibly disabled with a tooltip explaining why, rather than
  pretending to work.
- **New Arrivals, Best Offers, Top Selling, Trending, Recently Viewed,
  Recommended For You, Blog, Reviews, FAQ** — none of these homepage blocks
  are built. Most need either trivial backend additions (sort by date,
  compare mrp vs price) or small new features (view tracking, admin-set
  flags) — see the plan discussed before this pass for the breakdown.
- **Footer** is static markup for now, not admin-driven content — matches
  the reference layout structurally but isn't wired to the CMS `app_settings`
  the admin panel already has for this.

## Design

Same design tokens as the admin panel (teal `#02A694` / blue `#1FAFE8`,
Space Grotesk + Inter) and the same original pill-capsule logo mark — brand
consistency between the two apps was deliberate, not incidental.
