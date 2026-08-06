# PillPoints — Docker stack

Runs the backend and admin frontend with one command, connecting to an
**existing external Postgres server** rather than spinning up a local
database container — this stack shares infrastructure with other projects
on that server (each in its own database).

**Not yet included:** the B2C storefront (not built yet) and the missing
admin sections (Orders, Customers, Inventory, Offers & Coupons, Marketing,
Reports, CMS, Settings) — those need their own backend endpoints before
there's anything to containerize.

## Run it

```bash
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to point at your Postgres server, e.g.:
```
DATABASE_URL=postgresql://pillpoints_user:yourpassword@187.127.150.252:5432/pillpoints_db
```
If the password contains an `@`, URL-encode it as `%40` or the connection
string will be misread (the `@` is also the separator before the host).

Then:
```bash
docker compose up --build
```

- Admin panel: http://localhost:8090
- Storefront: http://localhost:8095
- Backend API docs: http://localhost:8020/docs

The backend container waits for the database to accept connections, then
runs `alembic upgrade head` automatically before starting Uvicorn — so a
fresh `docker compose up` gets you a fully migrated database with no manual
step. The included initial migration
(`backend/alembic/versions/86d47f8316c7_init_schema.py`) was generated from
the current models and verified to apply cleanly.

## Creating your first admin user

There's no open signup route for admins by design. Run this once the stack
is up:

```bash
docker compose exec backend python -c "
from app.core.database import SessionLocal
from app.models.user import User
from app.models.enums import UserRole
from app.core.security import hash_password

db = SessionLocal()
db.add(User(name='Admin', phone='9999999999', password_hash=hash_password('changeme'), role=UserRole.admin))
db.commit()
print('Admin user created')
"
```

## Services

| Service | Image/build | Port | Notes |
|---|---|---|---|
| `backend` | `backend/Dockerfile` | 8020 → 8000 | Connects to your external `DATABASE_URL`, runs migrations on boot, then Uvicorn |
| `admin` | `admin/Dockerfile` | 8090 → 80 | Vite build served by nginx; `VITE_API_URL` is baked in at build time (Vite env vars are compile-time, not runtime) — rebuild the `admin` image if you change it |
| `storefront` | `storefront/Dockerfile` | 8095 → 80 | Same build pattern as `admin` — B2C/B2B customer-facing site |

## Rebuilding after code changes

```bash
docker compose up --build backend   # or admin, or both
```

## Generating new migrations

Model changes need a new Alembic revision before they'll apply automatically:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe the change"
docker compose restart backend       # picks up and applies the new revision
```

## Production notes

- Set a real `SECRET_KEY`, real Postgres credentials, and real Razorpay/WhatsApp
  keys in `.env` before deploying anywhere public — the defaults in
  `.env.example` are placeholders only.
- `VITE_API_URL` needs to be the **publicly reachable** backend URL if the
  admin panel isn't on the same host — it's baked into the JS bundle at
  build time, so browsers hitting it later can't be pointed elsewhere without
  a rebuild.
- Nothing here sets up TLS — put this behind a reverse proxy (Caddy, Traefik,
  or a managed load balancer) for HTTPS in production.
