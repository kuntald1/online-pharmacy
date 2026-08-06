"""cnf pricing channel

Revision ID: c4e6a8f03d71
Revises: b3d5f7a92c60
Create Date: 2026-07-29 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c4e6a8f03d71'
down_revision: Union[str, None] = 'b3d5f7a92c60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE pricingchannel ADD VALUE IF NOT EXISTS 'cnf'")


def downgrade() -> None:
    # Postgres doesn't support dropping individual enum values — leaving
    # 'cnf' in place on downgrade is the standard, low-risk approach.
    pass
