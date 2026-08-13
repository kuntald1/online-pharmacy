from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.api.routes import auth, b2b, catalog, orders, cnf, admin_extras, uploads, products_import, customer_auth, reviews, relations, prescriptions, wishlist, health_packages, delivery_zones, profile, wallet, returns, stock_verification

app = FastAPI(title="Healthycian API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads.UPLOAD_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(b2b.router)
app.include_router(catalog.router)
app.include_router(orders.router)
app.include_router(cnf.router)
app.include_router(admin_extras.router)
app.include_router(uploads.router)
app.include_router(products_import.router)
app.include_router(customer_auth.router)
app.include_router(reviews.router)
app.include_router(relations.router)
app.include_router(prescriptions.router)
app.include_router(wishlist.router)
app.include_router(health_packages.router)
app.include_router(delivery_zones.router)
app.include_router(profile.router)
app.include_router(wallet.router)
app.include_router(returns.router)
app.include_router(stock_verification.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "env": settings.ENV}
