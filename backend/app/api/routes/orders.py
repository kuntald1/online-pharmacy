import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User, Address
from app.models.catalog import Product, ProductPricing
from app.models.order import Cart, CartItem, Order, OrderItem, Payment
from app.models.settings import Coupon
from app.models.enums import PaymentMode, PaymentStatus, OrderStatus, PricingChannel, DiscountType, Visibility
from app.schemas.order import (
    AddressCreate, AddressUpdate, AddressOut, CartItemIn, CartOut,
    CheckoutRequest, OrderOut, RazorpayVerifyRequest,
    AdminOrderOut, OrderStatusUpdate, CouponValidateRequest, CouponValidateResponse,
)
from app.schemas.admin_extras import CouponOut
from app.api.deps import get_current_user, require_admin
from app.services.razorpay_service import create_razorpay_order, verify_signature
from app.services.whatsapp import notify_customer_of_order, send_whatsapp_message

router = APIRouter(prefix="/api", tags=["orders"])

# Standard delivery/platform fees — currently always waived to 0 (shown to
# the customer as struck-through "FREE" in the payment summary, matching
# the promotional pattern the storefront uses elsewhere). If real fees are
# ever charged, change WAIVE_DELIVERY_FEE / WAIVE_PLATFORM_FEE to False.
STANDARD_DELIVERY_FEE = 59.0
STANDARD_PLATFORM_FEE = 9.0
WAIVE_DELIVERY_FEE = True
WAIVE_PLATFORM_FEE = True


# ---------- Addresses ----------

@router.get("/addresses", response_model=list[AddressOut])
def list_addresses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Address).filter(Address.user_id == user.id).all()


@router.post("/addresses", response_model=AddressOut)
def add_address(payload: AddressCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.is_default:
        db.query(Address).filter(Address.user_id == user.id).update({"is_default": False})
    address = Address(user_id=user.id, **payload.model_dump())
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


@router.patch("/addresses/{address_id}", response_model=AddressOut)
def update_address(address_id: int, payload: AddressUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    address = db.get(Address, address_id)
    if not address or address.user_id != user.id:
        raise HTTPException(status_code=404, detail="Address not found")
    data = payload.model_dump(exclude_unset=True)
    if data.get("is_default"):
        db.query(Address).filter(Address.user_id == user.id, Address.id != address_id).update({"is_default": False})
    for field, value in data.items():
        setattr(address, field, value)
    db.commit()
    db.refresh(address)
    return address


@router.delete("/addresses/{address_id}")
def delete_address(address_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    address = db.get(Address, address_id)
    if not address or address.user_id != user.id:
        raise HTTPException(status_code=404, detail="Address not found")
    db.delete(address)
    db.commit()
    return {"status": "deleted"}


# ---------- Cart ----------

def _get_or_create_cart(db: Session, user: User) -> Cart:
    cart = db.query(Cart).filter(Cart.user_id == user.id).first()
    if not cart:
        cart = Cart(user_id=user.id)
        db.add(cart)
        db.commit()
        db.refresh(cart)
    return cart


@router.get("/cart", response_model=CartOut)
def get_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_or_create_cart(db, user)


@router.post("/cart/items", response_model=CartOut)
def add_to_cart(payload: CartItemIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pricing = (
        db.query(ProductPricing)
        .filter(ProductPricing.product_id == payload.product_id, ProductPricing.channel == payload.channel)
        .first()
    )
    if not pricing or not pricing.is_active:
        raise HTTPException(status_code=404, detail="Product not available for this channel")
    if payload.quantity < pricing.min_quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Minimum order quantity for this tier is {pricing.min_quantity}",
        )
    if payload.quantity > pricing.stock:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    cart = _get_or_create_cart(db, user)

    existing_items = db.query(CartItem).filter(CartItem.cart_id == cart.id).all()

    def _segment(ch: PricingChannel) -> str:
        """Groups b2b_normal and b2b_advance into one 'b2b' segment — a B2B
        account legitimately buying some items at Normal-tier pricing and
        others at Advance-tier pricing in the same order is expected, not a
        mixing error. B2C, B2B, and CNF still can't mix with each other."""
        return "b2b" if ch in (PricingChannel.b2b_normal, PricingChannel.b2b_advance) else ch.value

    if existing_items and _segment(existing_items[0].channel) != _segment(payload.channel):
        raise HTTPException(
            status_code=400,
            detail="Your cart has items from a different channel (B2C / B2B / CNF). Clear your cart before switching.",
        )

    existing = next((i for i in existing_items if i.product_id == payload.product_id), None)
    if existing:
        existing.quantity = payload.quantity
    else:
        db.add(CartItem(cart_id=cart.id, product_id=payload.product_id, channel=payload.channel, quantity=payload.quantity))

    db.commit()
    db.refresh(cart)
    return cart


@router.delete("/cart/items/{item_id}", response_model=CartOut)
def remove_from_cart(item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    item = db.query(CartItem).filter(CartItem.id == item_id, CartItem.cart_id == cart.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    db.delete(item)
    db.commit()
    db.refresh(cart)
    return cart


@router.delete("/cart", response_model=CartOut)
def clear_cart(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = _get_or_create_cart(db, user)
    for item in list(cart.items):
        db.delete(item)
    db.commit()
    db.refresh(cart)
    return cart


# ---------- Checkout / Orders ----------

def _order_no() -> str:
    return f"PP{uuid.uuid4().hex[:10].upper()}"


def _coupon_visible_to(visibility: Visibility, channel: PricingChannel) -> bool:
    """Same broad-matching idea as Category/Brand/Banner visibility — a
    coupon marked 'b2b' works for both the Normal and Advance tiers, not
    just one exact PricingChannel row."""
    if channel == PricingChannel.b2c:
        return visibility in (Visibility.b2c, Visibility.both, Visibility.all)
    if channel == PricingChannel.cnf:
        return visibility in (Visibility.cnf, Visibility.all)
    return visibility in (Visibility.b2b, Visibility.both, Visibility.all)  # b2b_normal / b2b_advance


def _validate_coupon(db: Session, code: str, channel: PricingChannel, subtotal: float) -> tuple[Coupon | None, float, str]:
    """Returns (coupon_or_None, discount_amount, message)."""
    coupon = db.query(Coupon).filter(Coupon.code == code.strip().upper(), Coupon.is_active == True).first()  # noqa: E712
    if not coupon:
        return None, 0.0, "That code isn't valid"
    if not _coupon_visible_to(coupon.visibility, channel):
        return None, 0.0, "That code isn't valid for this order type"
    now = datetime.utcnow()
    if coupon.valid_from and now < coupon.valid_from:
        return None, 0.0, "That code isn't active yet"
    if coupon.valid_until and now > coupon.valid_until:
        return None, 0.0, "That code has expired"
    if coupon.max_uses is not None and coupon.used_count >= coupon.max_uses:
        return None, 0.0, "That code has reached its usage limit"
    if subtotal < float(coupon.min_order_amount):
        return None, 0.0, f"Add ₹{float(coupon.min_order_amount) - subtotal:.2f} more to use this code"

    if coupon.discount_type == DiscountType.percentage:
        discount = subtotal * (float(coupon.discount_value) / 100)
    else:
        discount = float(coupon.discount_value)
    discount = min(discount, subtotal)  # never discount below zero
    return coupon, discount, "Applied"


def _compute_cart_totals(db: Session, cart: Cart, coupon_code: str | None):
    """Shared by /cart/summary (pre-checkout preview) and /checkout (the real order).
    Never trusts client-sent prices — always re-reads price/mrp/stock from the DB."""
    if not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    channel = cart.items[0].channel
    subtotal = 0.0
    mrp_total = 0.0
    line_items = []

    for item in cart.items:
        pricing = (
            db.query(ProductPricing)
            .filter(ProductPricing.product_id == item.product_id, ProductPricing.channel == item.channel)
            .first()
        )
        product = db.get(Product, item.product_id)
        if not pricing or not product:
            raise HTTPException(status_code=400, detail="A product in your cart is no longer available")
        if item.quantity > pricing.stock:
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")

        line_price = float(pricing.price) * item.quantity
        line_mrp = float(pricing.mrp or pricing.price) * item.quantity
        subtotal += line_price
        mrp_total += line_mrp
        line_items.append({
            "item_id": item.id, "product": product, "pricing": pricing, "quantity": item.quantity,
            "line_price": line_price, "line_mrp": line_mrp,
        })

    product_discount = mrp_total - subtotal

    coupon, coupon_discount, coupon_message = (None, 0.0, None)
    if coupon_code:
        coupon, coupon_discount, coupon_message = _validate_coupon(db, coupon_code, channel, subtotal)

    delivery_fee = 0.0 if WAIVE_DELIVERY_FEE else STANDARD_DELIVERY_FEE
    platform_fee = 0.0 if WAIVE_PLATFORM_FEE else STANDARD_PLATFORM_FEE
    delivery_fee_waived = STANDARD_DELIVERY_FEE if WAIVE_DELIVERY_FEE else 0.0
    platform_fee_waived = STANDARD_PLATFORM_FEE if WAIVE_PLATFORM_FEE else 0.0

    total_payable = subtotal - coupon_discount + delivery_fee + platform_fee
    total_saved = product_discount + coupon_discount + delivery_fee_waived + platform_fee_waived

    return {
        "channel": channel,
        "line_items": line_items,
        "subtotal": round(subtotal, 2),
        "mrp_total": round(mrp_total, 2),
        "product_discount": round(product_discount, 2),
        "delivery_fee": round(delivery_fee, 2),
        "platform_fee": round(platform_fee, 2),
        "delivery_fee_waived": round(delivery_fee_waived, 2),
        "platform_fee_waived": round(platform_fee_waived, 2),
        "coupon": coupon,
        "coupon_code": coupon.code if coupon else None,
        "coupon_discount": round(coupon_discount, 2),
        "coupon_message": coupon_message,
        "total_payable": round(total_payable, 2),
        "total_saved": round(total_saved, 2),
    }


@router.get("/cart/summary")
def cart_summary(coupon_code: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """What the checkout page's payment panel renders — full breakdown
    without actually placing an order."""
    cart = db.query(Cart).options(joinedload(Cart.items)).filter(Cart.user_id == user.id).first()
    if not cart or not cart.items:
        return {"channel": None, "items": [], "subtotal": 0, "mrp_total": 0, "product_discount": 0,
                "delivery_fee": 0, "platform_fee": 0, "delivery_fee_waived": 0, "platform_fee_waived": 0,
                "coupon_code": None, "coupon_discount": 0, "coupon_message": None,
                "total_payable": 0, "total_saved": 0}

    totals = _compute_cart_totals(db, cart, coupon_code)
    return {
        "channel": totals["channel"].value,
        "items": [
            {
                "item_id": li["item_id"],
                "product_id": li["product"].id,
                "name": li["product"].name,
                "image_url": (li["product"].image_urls or "").split(",")[0] or None,
                "quantity": li["quantity"],
                "unit_price": float(li["pricing"].price),
                "unit_mrp": float(li["pricing"].mrp) if li["pricing"].mrp else None,
                "min_quantity": li["pricing"].min_quantity,
                "stock": li["pricing"].stock,
            }
            for li in totals["line_items"]
        ],
        "subtotal": totals["subtotal"],
        "mrp_total": totals["mrp_total"],
        "product_discount": totals["product_discount"],
        "delivery_fee": totals["delivery_fee"],
        "platform_fee": totals["platform_fee"],
        "delivery_fee_waived": totals["delivery_fee_waived"],
        "platform_fee_waived": totals["platform_fee_waived"],
        "coupon_code": totals["coupon_code"],
        "coupon_discount": totals["coupon_discount"],
        "coupon_message": totals["coupon_message"],
        "total_payable": totals["total_payable"],
        "total_saved": totals["total_saved"],
    }


@router.get("/coupons/active", response_model=list[CouponOut])
def list_active_coupons(channel: str = Query("b2c", pattern="^(b2c|b2b|b2b_normal|b2b_advance|cnf)$"), db: Session = Depends(get_db)):
    """No auth required — this is the browsable 'Coupons' display on the PDP
    and cart (like the 'get extra 10% off' cards), not the apply-at-checkout
    flow (that's POST /coupons/validate, which needs a logged-in cart).
    Filters out anything not currently usable: inactive, wrong visibility,
    outside its valid_from/valid_until window, or already at its max uses.
    Uses the same broad visibility matching as Category/Brand/Banner — a
    coupon marked 'b2b' or 'all' shows regardless of which B2B tier this is."""
    if channel == "b2c":
        visible = [Visibility.b2c, Visibility.both, Visibility.all]
    elif channel == "cnf":
        visible = [Visibility.cnf, Visibility.all]
    else:
        visible = [Visibility.b2b, Visibility.both, Visibility.all]

    now = datetime.utcnow()
    coupons = db.query(Coupon).filter(Coupon.is_active == True, Coupon.visibility.in_(visible)).all()  # noqa: E712
    return [
        c for c in coupons
        if (not c.valid_from or now >= c.valid_from)
        and (not c.valid_until or now <= c.valid_until)
        and (c.max_uses is None or c.used_count < c.max_uses)
    ]


@router.post("/coupons/validate", response_model=CouponValidateResponse)
def validate_coupon_endpoint(payload: CouponValidateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = db.query(Cart).options(joinedload(Cart.items)).filter(Cart.user_id == user.id).first()
    if not cart or not cart.items:
        return CouponValidateResponse(valid=False, message="Your cart is empty")
    channel = cart.items[0].channel
    subtotal = sum(
        float(
            db.query(ProductPricing)
            .filter(ProductPricing.product_id == i.product_id, ProductPricing.channel == i.channel)
            .first().price
        ) * i.quantity
        for i in cart.items
    )
    coupon, discount, message = _validate_coupon(db, payload.code, channel, subtotal)
    return CouponValidateResponse(valid=coupon is not None, discount_amount=discount, message=message)


@router.post("/checkout", response_model=OrderOut)
def checkout(payload: CheckoutRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cart = db.query(Cart).options(joinedload(Cart.items)).filter(Cart.user_id == user.id).first()
    if not cart or not cart.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    address = db.get(Address, payload.address_id)
    if not address or address.user_id != user.id:
        raise HTTPException(status_code=404, detail="Address not found")

    totals = _compute_cart_totals(db, cart, payload.coupon_code)

    order = Order(
        order_no=_order_no(),
        user_id=user.id,
        channel=totals["channel"],
        address_id=address.id,
        payment_mode=payload.payment_mode,
        payment_status=PaymentStatus.pending,
        status=OrderStatus.placed,
        subtotal=totals["subtotal"],
        mrp_total=totals["mrp_total"],
        product_discount=totals["product_discount"],
        delivery_fee=totals["delivery_fee"],
        platform_fee=totals["platform_fee"],
        coupon_code=totals["coupon_code"],
        coupon_discount=totals["coupon_discount"],
        total=totals["total_payable"],
    )
    db.add(order)
    db.flush()

    for li in totals["line_items"]:
        db.add(OrderItem(
            order_id=order.id,
            product_id=li["product"].id,
            product_name=li["product"].name,
            channel=li["pricing"].channel,
            unit_price=li["pricing"].price,
            quantity=li["quantity"],
        ))
        li["pricing"].stock -= li["quantity"]

    if totals["coupon"]:
        totals["coupon"].used_count += 1

    if payload.payment_mode == PaymentMode.razorpay:
        if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
            db.rollback()
            raise HTTPException(
                status_code=503,
                detail="Card/UPI payment isn't configured on this server yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or choose Cash on Delivery",
            )
        try:
            rp_order = create_razorpay_order(totals["total_payable"], receipt=order.order_no)
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=502, detail=f"Couldn't start the payment: {e}")
        order.razorpay_order_id = rp_order["id"]
        db.add(Payment(order_id=order.id, razorpay_order_id=rp_order["id"], amount=totals["total_payable"]))
    else:
        # COD — mark order confirmed, payment stays pending until delivery
        order.status = OrderStatus.confirmed

    # clear cart
    for item in cart.items:
        db.delete(item)

    # Build the notification text before commit — SQLAlchemy expires ORM
    # attributes on commit by default, and totals["line_items"] holds
    # references to those same Product/ProductPricing objects, so reading
    # them after commit would trigger extra (avoidable) lazy loads.
    order_no = order.order_no
    order_total = totals["total_payable"]
    item_summary = [(li["product"].name, li["quantity"]) for li in totals["line_items"]]
    send_confirmation = order.status == OrderStatus.confirmed

    db.commit()
    db.refresh(order)

    if send_confirmation:
        notify_customer_of_order(user.phone, order_no, order_total, item_summary)

    return order


@router.post("/payments/verify")
def verify_payment(payload: RazorpayVerifyRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = db.get(Order, payload.order_id)
    if not order or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")

    if not verify_signature(payload.razorpay_order_id, payload.razorpay_payment_id, payload.razorpay_signature):
        raise HTTPException(status_code=400, detail="Payment verification failed")

    order.payment_status = PaymentStatus.paid
    order.status = OrderStatus.confirmed

    payment = db.query(Payment).filter(Payment.order_id == order.id).first()
    if payment:
        payment.razorpay_payment_id = payload.razorpay_payment_id
        payment.razorpay_signature = payload.razorpay_signature
        payment.status = PaymentStatus.paid

    order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    item_summary = [(oi.product_name, oi.quantity) for oi in order_items]
    order_no, order_total, phone = order.order_no, float(order.total), user.phone

    db.commit()

    notify_customer_of_order(phone, order_no, order_total, item_summary)

    return {"status": "verified"}


@router.get("/orders", response_model=list[OrderOut])
def list_orders(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.user_id == user.id)
        .order_by(Order.created_at.desc())
        .all()
    )


@router.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == order_id).first()
    if not order or order.user_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ---------- Admin: orders across all customers ----------

def _to_admin_order_out(order: Order) -> AdminOrderOut:
    base = OrderOut.model_validate(order).model_dump()
    return AdminOrderOut(
        **base,
        customer_name=order.user.name,
        customer_phone=order.user.phone,
        shipping_address=AddressOut.model_validate(order.address),
    )


@router.get("/admin/orders", response_model=list[AdminOrderOut])
def admin_list_orders(
    channel_group: str = Query("b2c", pattern="^(b2c|b2b|cnf)$", description="b2c, b2b, or cnf"),
    status_filter: OrderStatus | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if channel_group == "b2c":
        channels = [PricingChannel.b2c]
    elif channel_group == "cnf":
        channels = [PricingChannel.cnf]
    else:
        channels = [PricingChannel.b2b_normal, PricingChannel.b2b_advance]

    q = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.user), joinedload(Order.address))
        .filter(Order.channel.in_(channels))
    )
    if status_filter:
        q = q.filter(Order.status == status_filter)

    orders = q.order_by(Order.created_at.desc()).all()
    return [_to_admin_order_out(o) for o in orders]


@router.get("/admin/orders/{order_id}", response_model=AdminOrderOut)
def admin_get_order(order_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    order = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.user), joinedload(Order.address))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _to_admin_order_out(order)


@router.patch("/admin/orders/{order_id}/status", response_model=AdminOrderOut)
def admin_update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    order = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.user), joinedload(Order.address))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = payload.status
    db.commit()
    db.refresh(order)

    if old_status != payload.status and order.user and order.user.phone:
        status_labels = {
            OrderStatus.placed: "placed",
            OrderStatus.confirmed: "confirmed",
            OrderStatus.packed: "packed and ready to ship",
            OrderStatus.shipped: "shipped",
            OrderStatus.delivered: "delivered",
            OrderStatus.cancelled: "cancelled",
        }
        status_text = status_labels.get(payload.status, payload.status.value)
        message = f"Update on your Healthycian order {order.order_no}: it's now {status_text}."
        send_whatsapp_message(order.user.phone, message)

    return _to_admin_order_out(order)
