from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.catalog import Product
from app.models.review import Review
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewOut, ReviewSummaryOut, AdminReviewOut, ReviewModerate
from app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/api", tags=["reviews"])

_optional_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user_optional(
    token: str | None = Depends(_optional_oauth2),
    db: Session = Depends(get_db),
) -> User | None:
    """Same idea as get_current_user, but returns None instead of raising —
    the reviews summary is public and readable by anyone, logged in or not.
    Being logged in only changes whether `is_own` gets set on any review."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user = db.get(User, int(payload.get("sub")))
    return user if user and user.is_active else None


def _reviewer_name(user: User) -> str:
    """First name + last-initial reads like a normal review byline without
    publishing a customer's full name/phone-linked identity to every visitor."""
    parts = (user.name or "Customer").strip().split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[-1][0]}."
    return parts[0] if parts else "Customer"


@router.get("/products/{slug}/reviews", response_model=ReviewSummaryOut)
def get_product_reviews(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    approved = db.query(Review).filter(Review.product_id == product.id, Review.is_approved == True)  # noqa: E712

    count = approved.count()
    average = round((approved.with_entities(func.avg(Review.rating)).scalar() or 0), 1)

    breakdown = {star: 0 for star in range(5, 0, -1)}
    for rating, n in approved.with_entities(Review.rating, func.count(Review.id)).group_by(Review.rating).all():
        breakdown[rating] = n

    rows = approved.order_by(Review.created_at.desc()).all()
    reviews = [
        ReviewOut(
            id=r.id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
            reviewer_name=_reviewer_name(r.user),
            is_own=bool(current_user and r.user_id == current_user.id),
        )
        for r in rows
    ]

    return ReviewSummaryOut(average=average, count=count, breakdown=breakdown, reviews=reviews)


@router.post("/products/{slug}/reviews", response_model=ReviewOut)
def submit_review(slug: str, payload: ReviewCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Upsert — resubmitting updates the customer's existing review (rating +
    comment + timestamp) rather than erroring or creating a duplicate row."""
    product = db.query(Product).filter(Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    review = db.query(Review).filter(Review.product_id == product.id, Review.user_id == user.id).first()
    if review:
        review.rating = payload.rating
        review.comment = payload.comment
    else:
        review = Review(product_id=product.id, user_id=user.id, rating=payload.rating, comment=payload.comment)
        db.add(review)

    db.commit()
    db.refresh(review)
    return ReviewOut(
        id=review.id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        reviewer_name=_reviewer_name(user),
        is_own=True,
    )


@router.delete("/products/{slug}/reviews/me")
def delete_own_review(slug: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    review = db.query(Review).filter(Review.product_id == product.id, Review.user_id == user.id).first()
    if not review:
        raise HTTPException(status_code=404, detail="You haven't reviewed this product")
    db.delete(review)
    db.commit()
    return {"status": "deleted"}


# ---------- Admin moderation ----------

@router.get("/admin/reviews", response_model=list[AdminReviewOut])
def list_all_reviews(
    product_id: int | None = None,
    is_approved: bool | None = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    q = db.query(Review).join(Product).join(User)
    if product_id:
        q = q.filter(Review.product_id == product_id)
    if is_approved is not None:
        q = q.filter(Review.is_approved == is_approved)
    rows = q.order_by(Review.created_at.desc()).all()
    return [
        AdminReviewOut(
            id=r.id,
            product_id=r.product_id,
            product_name=r.product.name,
            reviewer_name=r.user.name or "Customer",
            rating=r.rating,
            comment=r.comment,
            is_approved=r.is_approved,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.patch("/admin/reviews/{review_id}", response_model=AdminReviewOut)
def moderate_review(review_id: int, payload: ReviewModerate, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_approved = payload.is_approved
    db.commit()
    db.refresh(review)
    return AdminReviewOut(
        id=review.id,
        product_id=review.product_id,
        product_name=review.product.name,
        reviewer_name=review.user.name or "Customer",
        rating=review.rating,
        comment=review.comment,
        is_approved=review.is_approved,
        created_at=review.created_at,
    )


@router.delete("/admin/reviews/{review_id}")
def delete_review(review_id: int, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    review = db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"status": "deleted"}
