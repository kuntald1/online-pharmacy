"""product other information block

Revision ID: e7f1b3c58a44
Revises: d4e6a1c9f230
Create Date: 2026-07-29 11:00:00.000000

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7f1b3c58a44'
down_revision: Union[str, None] = 'd4e6a1c9f230'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column('manufacturer_name', sa.String(length=255), nullable=True))
    op.add_column('products', sa.Column('manufacturer_address', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('marketer_name', sa.String(length=255), nullable=True))
    op.add_column('products', sa.Column('marketer_address', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('country_of_origin', sa.String(length=100), nullable=True))
    op.add_column('products', sa.Column('expires_on_or_after', sa.String(length=100), nullable=True))

    # updated_at needs a real value for existing rows (NOT NULL), not just a
    # server_default going forward — backfill from created_at so "last
    # updated" reads sensibly for products that predate this column instead
    # of showing today's date for everything.
    op.add_column('products', sa.Column('updated_at', sa.DateTime(), nullable=True))
    op.execute("UPDATE products SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column('products', 'updated_at', nullable=False)


def downgrade() -> None:
    op.drop_column('products', 'updated_at')
    op.drop_column('products', 'expires_on_or_after')
    op.drop_column('products', 'country_of_origin')
    op.drop_column('products', 'marketer_address')
    op.drop_column('products', 'marketer_name')
    op.drop_column('products', 'manufacturer_address')
    op.drop_column('products', 'manufacturer_name')
