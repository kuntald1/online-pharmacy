"""product reviews

Revision ID: b6c4f8d21a05
Revises: a8b3d6e0c917
Create Date: 2026-07-29 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6c4f8d21a05'
down_revision: Union[str, None] = 'a8b3d6e0c917'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reviews',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('is_approved', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('product_id', 'user_id', name='uq_review_product_user'),
    )
    op.create_index('ix_reviews_product_id', 'reviews', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_reviews_product_id', table_name='reviews')
    op.drop_table('reviews')
