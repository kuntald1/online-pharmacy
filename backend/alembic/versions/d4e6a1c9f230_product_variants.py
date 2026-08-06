"""product variants

Revision ID: d4e6a1c9f230
Revises: c8e12f6a930d
Create Date: 2026-07-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e6a1c9f230'
down_revision: Union[str, None] = 'c8e12f6a930d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Both columns are nullable with no backfill needed — every existing
    # product simply stays "not part of any variant group" (standalone)
    # until an admin explicitly links it to siblings.
    op.add_column('products', sa.Column('variant_group_id', sa.String(length=50), nullable=True))
    op.add_column('products', sa.Column('variant_label', sa.String(length=100), nullable=True))
    op.create_index('ix_products_variant_group_id', 'products', ['variant_group_id'])


def downgrade() -> None:
    op.drop_index('ix_products_variant_group_id', table_name='products')
    op.drop_column('products', 'variant_label')
    op.drop_column('products', 'variant_group_id')
