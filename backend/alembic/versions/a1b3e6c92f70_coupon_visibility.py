"""coupon: channel -> visibility

Revision ID: a1b3e6c92f70
Revises: f7c2d9a41e58
Create Date: 2026-07-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'a1b3e6c92f70'
down_revision: Union[str, None] = 'f7c2d9a41e58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Coupons switch from a strict PricingChannel match (a separate coupon
    # needed per exact tier: b2c / b2b_normal / b2b_advance / cnf) to the
    # same broad Visibility concept Category/Brand/Banner already use — one
    # coupon can cover both B2B tiers, or B2C+B2B+CNF, etc.
    op.add_column('coupons', sa.Column('visibility', postgresql.ENUM(name='visibility', create_type=False), nullable=True))

    # Backfill: old channel values map onto the closest single-value
    # visibility — b2b_normal and b2b_advance both become plain 'b2b'
    # (Visibility has no separate tier concept), which is a widening, not a
    # narrowing: any coupon that only worked for one B2B tier before now
    # works for both. That's the intended effect of this change, not a
    # side effect to guard against.
    op.execute("UPDATE coupons SET visibility = 'b2c' WHERE channel = 'b2c'")
    op.execute("UPDATE coupons SET visibility = 'b2b' WHERE channel IN ('b2b_normal', 'b2b_advance')")
    op.execute("UPDATE coupons SET visibility = 'cnf' WHERE channel = 'cnf'")

    op.alter_column('coupons', 'visibility', nullable=False, server_default='b2c')
    op.drop_column('coupons', 'channel')


def downgrade() -> None:
    op.add_column('coupons', sa.Column('channel', postgresql.ENUM(name='pricingchannel', create_type=False), nullable=True))
    op.execute("UPDATE coupons SET channel = 'b2c' WHERE visibility = 'b2c'")
    op.execute("UPDATE coupons SET channel = 'b2b_normal' WHERE visibility IN ('b2b', 'both', 'all')")
    op.execute("UPDATE coupons SET channel = 'cnf' WHERE visibility = 'cnf'")
    op.alter_column('coupons', 'channel', nullable=False, server_default='b2c')
    op.drop_column('coupons', 'visibility')
