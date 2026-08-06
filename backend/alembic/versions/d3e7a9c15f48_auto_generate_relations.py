"""product auto generate relations toggle

Revision ID: d3e7a9c15f48
Revises: c1d9e4f73b26
Create Date: 2026-07-29 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3e7a9c15f48'
down_revision: Union[str, None] = 'c1d9e4f73b26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('auto_generate_relations', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column('products', 'auto_generate_relations')
