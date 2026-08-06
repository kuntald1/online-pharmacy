"""cnf kyc fields (gst, driving licence, trade licence)

Revision ID: f7a1c9e30b52
Revises: e9f4b2d67c81
Create Date: 2026-07-29 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a1c9e30b52'
down_revision: Union[str, None] = 'e9f4b2d67c81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable at the DB level regardless of the form requiring them going
    # forward — existing rows submitted before this change don't have this
    # data, and there's nothing meaningful to backfill it with.
    op.add_column('cnf_leads', sa.Column('gst_no', sa.String(length=20), nullable=True))
    op.add_column('cnf_leads', sa.Column('driving_licence_no', sa.String(length=30), nullable=True))
    op.add_column('cnf_leads', sa.Column('trade_licence_no', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('cnf_leads', 'trade_licence_no')
    op.drop_column('cnf_leads', 'driving_licence_no')
    op.drop_column('cnf_leads', 'gst_no')
