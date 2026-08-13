import enum


class UserRole(str, enum.Enum):
    b2c = "b2c"
    b2b = "b2b"
    cnf = "cnf"
    admin = "admin"


class B2BApplicationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PricingChannel(str, enum.Enum):
    b2c = "b2c"
    b2b_normal = "b2b_normal"
    b2b_advance = "b2b_advance"
    cnf = "cnf"


class OrderStatus(str, enum.Enum):
    placed = "placed"
    confirmed = "confirmed"
    packed = "packed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class PaymentMode(str, enum.Enum):
    cod = "cod"
    razorpay = "razorpay"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class ReturnStatus(str, enum.Enum):
    requested = "requested"
    pickup_scheduled = "pickup_scheduled"
    picked_up = "picked_up"
    approved = "approved"
    rejected = "rejected"


class RefundMethod(str, enum.Enum):
    wallet = "wallet"
    original_payment = "original_payment"


class WalletTransactionType(str, enum.Enum):
    credit = "credit"
    debit = "debit"


class WalletTransactionReason(str, enum.Enum):
    topup = "topup"
    return_refund = "return_refund"
    order_payment = "order_payment"
    admin_adjustment = "admin_adjustment"


class CNFStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    closed = "closed"
    approved = "approved"  # login credentials issued
    rejected = "rejected"


class DiscountType(str, enum.Enum):
    percentage = "percentage"
    flat = "flat"


class SettingCategory(str, enum.Enum):
    cms = "cms"
    store = "store"


class Visibility(str, enum.Enum):
    b2c = "b2c"
    b2b = "b2b"
    cnf = "cnf"
    both = "both"  # b2c + b2b — kept for backward compatibility, does NOT include cnf
    all = "all"    # b2c + b2b + cnf


class RelationType(str, enum.Enum):
    """The three admin-curated cross-sell placements on a product page.
    Deliberately manual, not algorithmic — the admin picks exactly which
    products show in each slot, same as the Spotlight carousel."""
    fbt = "fbt"                # "Frequently bought together"
    similar = "similar"        # "Similar products"
    also_bought = "also_bought"  # "Customers who bought this item also bought"


class PackType(str, enum.Enum):
    """Classifies an invoice line item's Pack column so the system knows
    which items are strip-trackable. 'strip' = pack ends in S (e.g. '10S'),
    meaning qty = number of strips to verify. 'bottle'/'unit' items skip
    strip-level scanning entirely — they're just counted as whole pieces."""
    strip = "strip"
    bottle = "bottle"
    unit = "unit"
    other = "other"


class ScanSessionStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"


class OcrStatus(str, enum.Enum):
    accepted = "accepted"
    needs_retry = "needs_retry"
