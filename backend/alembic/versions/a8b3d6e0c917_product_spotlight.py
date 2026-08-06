"""product spotlight

Revision ID: a8b3d6e0c917
Revises: f2a9c7d1e563
Create Date: 2026-07-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8b3d6e0c917'
down_revision: Union[str, None] = 'f2a9c7d1e563'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('is_spotlighted', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('products', sa.Column('spotlight_order', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('products', 'spotlight_order')
    op.drop_column('products', 'is_spotlighted')
