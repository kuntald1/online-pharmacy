"""cnf accounts (login-or-apply, mirrors b2b)

Revision ID: e9f4b2d67c81
Revises: d3e7a9c15f48
Create Date: 2026-07-29 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9f4b2d67c81'
down_revision: Union[str, None] = 'd3e7a9c15f48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Adding a value to an existing Postgres enum type can't run inside the
    # same transaction that later *uses* that value — but since this
    # migration only adds the labels and doesn't insert/query rows with them,
    # it's safe within the normal alembic transaction (Postgres 12+).
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'cnf'")
    op.execute("ALTER TYPE cnfstatus ADD VALUE IF NOT EXISTS 'approved'")
    op.execute("ALTER TYPE cnfstatus ADD VALUE IF NOT EXISTS 'rejected'")

    op.add_column('cnf_leads', sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.create_unique_constraint('uq_cnf_leads_user_id', 'cnf_leads', ['user_id'])
    op.add_column('cnf_leads', sa.Column('admin_note', sa.String(length=500), nullable=True))
    op.add_column('cnf_leads', sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True))
    op.add_column('cnf_leads', sa.Column('reviewed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('cnf_leads', 'reviewed_at')
    op.drop_column('cnf_leads', 'reviewed_by')
    op.drop_column('cnf_leads', 'admin_note')
    op.drop_constraint('uq_cnf_leads_user_id', 'cnf_leads', type_='unique')
    op.drop_column('cnf_leads', 'user_id')
    # Postgres doesn't support dropping individual enum values — leaving
    # 'cnf' / 'approved' / 'rejected' in place on downgrade is the standard,
    # low-risk approach (unused labels are harmless).
