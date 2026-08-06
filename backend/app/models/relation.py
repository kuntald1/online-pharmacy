from sqlalchemy import ForeignKey, Integer, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import RelationType


class ProductRelation(Base):
    """A directional link: 'when viewing product_id, also show
    related_product_id under relation_type'. Not automatically symmetric —
    an admin curating 'similar products' for A might not want the reverse
    link on B, so each direction is its own row rather than being implied."""
    __tablename__ = "product_relations"
    __table_args__ = (
        UniqueConstraint("product_id", "related_product_id", "relation_type", name="uq_product_relation"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    related_product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    relation_type: Mapped[RelationType] = mapped_column(Enum(RelationType))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped["Product"] = relationship(foreign_keys=[product_id])
    related_product: Mapped["Product"] = relationship(foreign_keys=[related_product_id])
