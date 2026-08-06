"""banner channel supports both

Revision ID: 7b42ad7f997f
Revises: 2f909fd8921b
Create Date: 2026-07-15 04:28:09.937204

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '7b42ad7f997f'
down_revision: Union[str, None] = '2f909fd8921b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # banners.channel is switching from the pricingchannel enum (b2c,
    # b2b_normal, b2b_advance) to the visibility enum (b2c, b2b, both) —
    # a direct type cast fails on any row with b2b_normal/b2b_advance,
    # since those labels don't exist on the new type. Real installs already
    # have banner rows (confirmed against production data before writing
    # this), so this can't be a naive ALTER COLUMN TYPE — it needs an
    # explicit value mapping, done via a temp column + data copy.
    #
    # visibility already exists as a type (created by the categories/brands
    # migration) — create_type=False, same lesson as before.
    op.add_column(
        'banners',
        sa.Column('channel_new', postgresql.ENUM('b2c', 'b2b', 'both', name='visibility', create_type=False), nullable=True),
    )

    op.execute("""
        UPDATE banners
        SET channel_new = CASE
            WHEN channel::text = 'b2c' THEN 'b2c'
            WHEN channel::text IN ('b2b_normal', 'b2b_advance') THEN 'b2b'
            ELSE 'b2c'
        END::visibility
    """)

    op.alter_column('banners', 'channel_new', nullable=False, server_default='b2c')
    op.drop_column('banners', 'channel')
    op.alter_column('banners', 'channel_new', new_column_name='channel')


def downgrade() -> None:
    op.add_column(
        'banners',
        sa.Column('channel_old', sa.String(length=11), nullable=True),
    )
    op.execute("""
        UPDATE banners
        SET channel_old = CASE
            WHEN channel::text = 'b2b' THEN 'b2b_normal'
            ELSE channel::text
        END
    """)
    op.alter_column('banners', 'channel_old', nullable=False, server_default='b2c')
    op.drop_column('banners', 'channel')
    op.alter_column('banners', 'channel_old', new_column_name='channel')
