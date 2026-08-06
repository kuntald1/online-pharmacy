from datetime import datetime
from pydantic import BaseModel, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = None


class ReviewOut(BaseModel):
    id: int
    rating: int
    comment: str | None = None
    created_at: datetime
    reviewer_name: str
    is_own: bool = False  # true when this review belongs to whoever is asking — lets the storefront show "Edit your review"

    class Config:
        from_attributes = True


class ReviewSummaryOut(BaseModel):
    """What the PDP's 'Ratings and reviews' block needs in one call: the
    average, the total count, a 1-5 breakdown for the bar chart, and the
    approved reviews themselves."""
    average: float
    count: int
    breakdown: dict[int, int]  # {5: n, 4: n, 3: n, 2: n, 1: n}
    reviews: list[ReviewOut]


class AdminReviewOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    reviewer_name: str
    rating: int
    comment: str | None = None
    is_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewModerate(BaseModel):
    is_approved: bool
