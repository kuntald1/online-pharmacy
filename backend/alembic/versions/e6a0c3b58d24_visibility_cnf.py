"""visibility: add cnf

Revision ID: e6a0c3b58d24
Revises: d5f8b2a41c93
Create Date: 2026-07-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'e6a0c3b58d24'
down_revision: Union[str, None] = 'd5f8b2a41c93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE visibility ADD VALUE IF NOT EXISTS 'cnf'")


def downgrade() -> None:
    # Postgres doesn't support dropping individual enum values.
    pass
