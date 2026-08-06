import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.order import Order, OrderItem
from app.models.catalog import Product, ProductPricing
from app.models.return_request import ReturnRequest
from app.models.enums import ReturnStatus, RefundMethod, PaymentMode, WalletTransactionReason
from app.schemas.return_request import ReturnRequestOut, AdminReturnRequestOut, ReturnStatusUpdate
from app.api.deps import get_current_user, require_admin
from app.api.routes.uploads import UPLOAD_DIR
from app.services.wallet_service import credit_wallet
from app.services.razorpay_service import refund_payment
from app.services.whatsapp import send_whatsapp_message

router = APIRouter(prefix="/api", tags=["returns"])

RETURN_IMG_DIR = UPLOAD_DIR / "return_images"
RETURN_IMG_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024


# ---------- Customer ----------

@router.post("/returns", response_model=ReturnRequestOut)
async def create_return_request(
    order_item_id: int = Form(...),
    quantity: int = Form(...),
    reason: str = Form(...),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    item = db.get(OrderItem, order_item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Order item not found")
    order = db.get(Order, item.order_id)
    if not order or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order item not found")
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")
    if not reason.strip():
        raise HTTPException(status_code=400, detail="Please describe the issue")

    # Don't let returned quantity exceed what was actually ordered — sum
    # quantity already requested on this item, excluding rejected requests
    # (a rejected return frees that quantity up to be requested again,
    # e.g. if the customer submits better evidence).
    already_requested = (
        db.query(func.coalesce(func.sum(ReturnRequest.quantity), 0))
        .filter(ReturnRequest.order_item_id == order_item_id, ReturnRequest.status != ReturnStatus.rejected)
        .scalar()
    )
    if already_requested + quantity > item.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Only {item.quantity - already_requested} unit(s) of this item are eligible for return",
        )

    image_url = None
    if image is not None:
        if image.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {image.content_type}")
        contents = await image.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Image is too large (max 5MB)")
        ext = Path(image.filename or "").suffix.lower() or ".jpg"
        unique_name = f"{uuid.uuid4().hex}{ext}"
        (RETURN_IMG_DIR / unique_name).write_bytes(contents)
        image_url = f"/uploads/return_images/{unique_name}"

    req = ReturnRequest(
        order_id=order.id, order_item_id=order_item_id, user_id=user.id,
        quantity=quantity, reason=reason.strip(), image_url=image_url,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/returns", response_model=list[ReturnRequestOut])
def list_my_returns(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(ReturnRequest)
        .filter(ReturnRequest.user_id == user.id)
        .order_by(ReturnRequest.created_at.desc())
        .all()
    )


# ---------- Admin ----------

@router.get("/admin/returns", response_model=list[AdminReturnRequestOut])
def admin_list_returns(status_filter: ReturnStatus | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    q = (
        db.query(ReturnRequest)
        .options(
            joinedload(ReturnRequest.order),
            joinedload(ReturnRequest.order_item),
            joinedload(ReturnRequest.user),
        )
    )
    if status_filter:
        q = q.filter(ReturnRequest.status == status_filter)
    rows = q.order_by(ReturnRequest.created_at.desc()).all()
    return [
        AdminReturnRequestOut(
            id=r.id, order_id=r.order_id, order_item_id=r.order_item_id, quantity=r.quantity,
            reason=r.reason, image_url=r.image_url, status=r.status.value,
            refund_amount=float(r.refund_amount) if r.refund_amount is not None else None,
            refund_method=r.refund_method.value if r.refund_method else None,
            admin_note=r.admin_note, created_at=r.created_at,
            order_no=r.order.order_no, product_name=r.order_item.product_name,
            customer_name=r.user.name, customer_phone=r.user.phone,
            channel=r.order_item.channel.value,
        )
        for r in rows
    ]


@router.patch("/admin/returns/{return_id}/status", response_model=AdminReturnRequestOut)
def admin_update_return_status(
    return_id: int,
    payload: ReturnStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    req = (
        db.query(ReturnRequest)
        .options(joinedload(ReturnRequest.order), joinedload(ReturnRequest.order_item), joinedload(ReturnRequest.user))
        .filter(ReturnRequest.id == return_id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Return request not found")

    try:
        new_status = ReturnStatus(payload.status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")

    if req.status in (ReturnStatus.approved, ReturnStatus.rejected):
        raise HTTPException(status_code=400, detail="This return has already been resolved and can't be changed")

    req.status = new_status
    req.admin_note = payload.admin_note
    req.reviewed_by = admin.id
    req.reviewed_at = datetime.utcnow()

    if new_status in (ReturnStatus.pickup_scheduled, ReturnStatus.picked_up):
        status_text = "scheduled for pickup" if new_status == ReturnStatus.pickup_scheduled else "picked up"
        send_whatsapp_message(
            req.user.phone,
            f"Update on your return for order {req.order.order_no}: your item has been {status_text}.",
        )

    if new_status == ReturnStatus.approved:
        order = req.order
        item = req.order_item
        refund_amount = float(item.unit_price) * req.quantity
        req.refund_amount = refund_amount

        if order.payment_mode == PaymentMode.cod:
            req.refund_method = RefundMethod.wallet
            credit_wallet(
                db, req.user, refund_amount, WalletTransactionReason.return_refund,
                reference_order_id=order.id, reference_return_id=req.id,
                note=f"Refund for return on order {order.order_no}",
            )
        else:
            req.refund_method = RefundMethod.original_payment
            payment = order.payment
            if payment and payment.razorpay_payment_id:
                try:
                    refund_payment(payment.razorpay_payment_id, refund_amount, notes={"return_id": str(req.id), "order_no": order.order_no})
                except Exception as e:
                    # Refund via Razorpay failed (e.g. payment window expired) —
                    # fall back to the wallet rather than silently losing the
                    # refund. The admin note makes it visible why it landed
                    # in the wallet instead of the original payment method.
                    req.refund_method = RefundMethod.wallet
                    credit_wallet(
                        db, req.user, refund_amount, WalletTransactionReason.return_refund,
                        reference_order_id=order.id, reference_return_id=req.id,
                        note=f"Refund for return on order {order.order_no} (original payment refund failed: {e})",
                    )
            else:
                req.refund_method = RefundMethod.wallet
                credit_wallet(
                    db, req.user, refund_amount, WalletTransactionReason.return_refund,
                    reference_order_id=order.id, reference_return_id=req.id,
                    note=f"Refund for return on order {order.order_no} (no payment record on file)",
                )

        # Stock goes back to the SAME channel it was sold under — a B2B
        # Advance-tier return restocks the B2B Advance row, not B2C, even
        # though it's the same underlying product.
        pricing = (
            db.query(ProductPricing)
            .filter(ProductPricing.product_id == item.product_id, ProductPricing.channel == item.channel)
            .first()
        )
        if pricing:
            pricing.stock += req.quantity

        message = (
            f"Your return for order {order.order_no} has been approved. "
            f"Refund of Rs.{refund_amount:.2f} has been "
            f"{'credited to your Healthycian wallet' if req.refund_method == RefundMethod.wallet else 'processed to your original payment method'}."
        )
        send_whatsapp_message(req.user.phone, message)

    elif new_status == ReturnStatus.rejected:
        message = f"Your return request for order {req.order.order_no} was not approved. {payload.admin_note or ''}".strip()
        send_whatsapp_message(req.user.phone, message)

    db.commit()
    db.refresh(req)
    return AdminReturnRequestOut(
        id=req.id, order_id=req.order_id, order_item_id=req.order_item_id, quantity=req.quantity,
        reason=req.reason, image_url=req.image_url, status=req.status.value,
        refund_amount=float(req.refund_amount) if req.refund_amount is not None else None,
        refund_method=req.refund_method.value if req.refund_method else None,
        admin_note=req.admin_note, created_at=req.created_at,
        order_no=req.order.order_no, product_name=req.order_item.product_name,
        customer_name=req.user.name, customer_phone=req.user.phone,
        channel=req.order_item.channel.value,
    )
