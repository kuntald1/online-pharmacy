"""visibility: add all (b2c+b2b+cnf)

Revision ID: f7c2d9a41e58
Revises: e6a0c3b58d24
Create Date: 2026-07-30 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'f7c2d9a41e58'
down_revision: Union[str, None] = 'e6a0c3b58d24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE visibility ADD VALUE IF NOT EXISTS 'all'")


def downgrade() -> None:
    # Postgres doesn't support dropping individual enum values.
    pass
