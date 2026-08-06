"""order fee breakdown

Revision ID: c8e12f6a930d
Revises: f4b9d2e871ac
Create Date: 2026-07-16 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8e12f6a930d'
down_revision: Union[str, None] = 'f4b9d2e871ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # All NOT NULL with server_default since orders already exist in real
    # installs — existing orders backfill to 0 for the new fee/discount
    # columns, which is accurate (they were placed before this concept
    # existed, so there's nothing to retroactively compute).
    op.add_column('orders', sa.Column('mrp_total', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.add_column('orders', sa.Column('product_discount', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.add_column('orders', sa.Column('delivery_fee', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.add_column('orders', sa.Column('platform_fee', sa.Numeric(10, 2), nullable=False, server_default='0'))
    op.add_column('orders', sa.Column('coupon_code', sa.String(length=30), nullable=True))
    op.add_column('orders', sa.Column('coupon_discount', sa.Numeric(10, 2), nullable=False, server_default='0'))

    # existing orders: mrp_total defaults to subtotal (no known discount at
    # the time) so the column is at least self-consistent rather than 0
    # sitting next to a real subtotal
    op.execute("UPDATE orders SET mrp_total = subtotal WHERE mrp_total = 0")


def downgrade() -> None:
    op.drop_column('orders', 'coupon_discount')
    op.drop_column('orders', 'coupon_code')
    op.drop_column('orders', 'platform_fee')
    op.drop_column('orders', 'delivery_fee')
    op.drop_column('orders', 'product_discount')
    op.drop_column('orders', 'mrp_total')
