"""add category and brand visibility

Revision ID: 98db0e07399a
Revises: b0d27b29867b
Create Date: 2026-07-14 05:47:15.681551

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '98db0e07399a'
down_revision: Union[str, None] = 'b0d27b29867b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 'visibility' is a brand-new enum type shared by both columns below.
    # Unlike op.create_table, op.add_column does NOT automatically emit
    # CREATE TYPE for an enum column — so it has to be created explicitly
    # here first, then both columns reference it with create_type=False.
    # (Also learned the hard way: Postgres enum types are database-global,
    # not per-table/per-column — same lesson as the pricingchannel collision
    # in the coupons migration, just a different failure mode this time.)
    visibility_enum = postgresql.ENUM('b2c', 'b2b', 'both', name='visibility')
    visibility_enum.create(op.get_bind(), checkfirst=True)

    # Both columns are NOT NULL with a server_default, since these tables
    # may already have rows — a Python-side model default only applies to
    # new inserts, existing rows need an actual value written at migration
    # time or the NOT NULL constraint fails.
    op.add_column(
        'brands',
        sa.Column(
            'visibility',
            postgresql.ENUM('b2c', 'b2b', 'both', name='visibility', create_type=False),
            nullable=False,
            server_default='both',
        ),
    )
    op.add_column(
        'categories',
        sa.Column(
            'visibility',
            postgresql.ENUM('b2c', 'b2b', 'both', name='visibility', create_type=False),
            nullable=False,
            server_default='both',
        ),
    )


def downgrade() -> None:
    op.drop_column('categories', 'visibility')
    op.drop_column('brands', 'visibility')
    # drop the enum type only after both columns using it are gone
    postgresql.ENUM(name='visibility').drop(op.get_bind(), checkfirst=True)
