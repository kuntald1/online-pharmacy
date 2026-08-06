import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.catalog import Product, ProductPricing
from app.models.enums import PricingChannel
from app.models.prescription import PrescriptionUpload
from app.models.user import User
from app.schemas.prescription import RxExtractOut, RxExtractedItem, RxProductMatch, AdminPrescriptionOut
from app.services.prescription_extraction import extract_and_match, PrescriptionExtractionError
from app.api.deps import get_current_user, require_admin
from app.api.routes.uploads import UPLOAD_DIR

router = APIRouter(prefix="/api", tags=["prescriptions"])

RX_DIR = UPLOAD_DIR / "prescriptions"
RX_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15MB


def _product_to_match(product: Product) -> RxProductMatch:
    pricing = next((p for p in product.pricing if p.channel == PricingChannel.b2c and p.is_active), None)
    return RxProductMatch(
        id=product.id,
        name=product.name,
        slug=product.slug,
        image_url=(product.image_urls.split(",")[0] if product.image_urls else None),
        price=pricing.price if pricing else None,
        is_prescription_required=product.is_prescription_required,
    )


@router.post("/prescriptions/extract", response_model=RxExtractOut)
async def extract_prescription(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Customer must be logged in (same phone-OTP login as everything else on
    the storefront) — an anonymous upload endpoint accepting arbitrary images
    is both an abuse vector and makes the audit trail (who uploaded what)
    meaningless."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File is too large (max 15MB)")

    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = RX_DIR / unique_name
    dest.write_bytes(contents)
    file_url = f"/uploads/prescriptions/{unique_name}"

    try:
        data = extract_and_match(db, contents, file.content_type)
    except PrescriptionExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if data.get("error"):
        raise HTTPException(status_code=422, detail=data["error"])

    items_out = []
    for item in data.get("items", []):
        matched_products = item.pop("_matched_products", [])
        items_out.append(RxExtractedItem(
            raw_text=item.get("raw_text") or "",
            medicine_name_guess=item.get("medicine_name_guess"),
            confidence=item.get("confidence") or "low",
            matches=[_product_to_match(p) for p in matched_products],
        ))

    # Logged regardless of what happens next — this is the audit trail a
    # pharmacist can browse later, not something that depends on the
    # customer actually completing an order from it.
    record = PrescriptionUpload(
        user_id=user.id,
        file_url=file_url,
        extracted_json=json.dumps(data, default=str),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return RxExtractOut(
        prescription_id=record.id,
        file_url=file_url,
        patient_name=data.get("patient_name"),
        doctor_name=data.get("doctor_name"),
        prescription_date=data.get("prescription_date"),
        items=items_out,
        warning="AI-read from your photo — please double check items and quantities against your original prescription before ordering.",
    )


@router.get("/admin/prescriptions", response_model=list[AdminPrescriptionOut])
def list_prescriptions(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    """Read-only audit list for pharmacist cross-reference — not tied to any
    specific order. Browsing here to verify what a customer actually
    prescribed is a manual step, not something the app automates."""
    rows = db.query(PrescriptionUpload).options(joinedload(PrescriptionUpload.user)).order_by(PrescriptionUpload.created_at.desc()).all()
    return [
        AdminPrescriptionOut(
            id=r.id,
            user_id=r.user_id,
            customer_name=r.user.name if r.user else "—",
            customer_phone=r.user.phone if r.user else "—",
            file_url=r.file_url,
            created_at=r.created_at,
        )
        for r in rows
    ]
