"""health packages

Revision ID: b8d4f1a63c05
Revises: a1b3e6c92f70
Create Date: 2026-07-30 13:00:00.000000

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b8d4f1a63c05'
down_revision: Union[str, None] = 'a1b3e6c92f70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

health_packages_table = sa.table(
    'health_packages',
    sa.column('title', sa.String),
    sa.column('image_url', sa.String),
    sa.column('mrp', sa.Numeric),
    sa.column('price', sa.Numeric),
    sa.column('is_popular', sa.Boolean),
    sa.column('is_active', sa.Boolean),
    sa.column('visibility', sa.Enum(name='visibility')),
    sa.column('sort_order', sa.Integer),
    sa.column('created_at', sa.DateTime),
)


def upgrade() -> None:
    op.create_table(
        'health_packages',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=False),
        sa.Column('mrp', sa.Numeric(10, 2), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False),
        sa.Column('link_url', sa.String(length=500), nullable=True),
        sa.Column('is_popular', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('visibility', postgresql.ENUM('b2c', 'b2b', 'cnf', 'both', 'all', name='visibility', create_type=False), nullable=False, server_default='both'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # Seeded from the 3 distinct packages in the reference screenshot — the
    # 5 image URLs given were package-6/4/2/6/4, i.e. these 3 repeating.
    now = datetime.utcnow()
    op.bulk_insert(health_packages_table, [
        {
            "title": "Heart Test",
            "image_url": "https://healthycian.co.in/public/images/package/package-6.jpg",
            "mrp": 1150, "price": 750,
            "is_popular": True, "is_active": True, "visibility": "both",
            "sort_order": 1, "created_at": now,
        },
        {
            "title": "Renal Health Package",
            "image_url": "https://healthycian.co.in/public/images/package/package-4.jpg",
            "mrp": 850, "price": 510,
            "is_popular": True, "is_active": True, "visibility": "both",
            "sort_order": 2, "created_at": now,
        },
        {
            "title": "33% Master Health Checkup Offer",
            "image_url": "https://healthycian.co.in/public/images/package/package-2.jpg",
            "mrp": 4050, "price": 2400,
            "is_popular": True, "is_active": True, "visibility": "both",
            "sort_order": 3, "created_at": now,
        },
    ])


def downgrade() -> None:
    op.drop_table('health_packages')
