"""delivery zones (pincode-based delivery estimate)

Revision ID: c9e1a4b72d38
Revises: b8d4f1a63c05
Create Date: 2026-07-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9e1a4b72d38'
down_revision: Union[str, None] = 'b8d4f1a63c05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'delivery_zones',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('pincode', sa.String(length=10), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=True),
        sa.Column('delivery_days', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_deliverable', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_delivery_zones_pincode', 'delivery_zones', ['pincode'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_delivery_zones_pincode', table_name='delivery_zones')
    op.drop_table('delivery_zones')
