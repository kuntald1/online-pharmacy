"""wishlist (save for later)

Revision ID: b3d5f7a92c60
Revises: a2c8e5f91d34
Create Date: 2026-07-29 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d5f7a92c60'
down_revision: Union[str, None] = 'a2c8e5f91d34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'wishlist_items',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('user_id', 'product_id', name='uq_wishlist_user_product'),
    )
    op.create_index('ix_wishlist_items_user_id', 'wishlist_items', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_wishlist_items_user_id', table_name='wishlist_items')
    op.drop_table('wishlist_items')
