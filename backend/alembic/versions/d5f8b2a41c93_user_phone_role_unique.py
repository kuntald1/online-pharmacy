"""user uniqueness: phone -> (phone, role)

Revision ID: d5f8b2a41c93
Revises: c4e6a8f03d71
Create Date: 2026-07-30 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd5f8b2a41c93'
down_revision: Union[str, None] = 'c4e6a8f03d71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The old unique index enforced "one account per phone number, ever" —
    # that's what let a B2B application collide with an existing B2C/admin
    # account sharing the same phone. Replacing it with a unique index on
    # (phone, role) instead allows the same number to hold one B2C account,
    # one B2B account, and one CNF account simultaneously, while still
    # preventing two accounts of the *same* role on the same number.
    op.drop_index('ix_users_phone', table_name='users')
    op.create_index('ix_users_phone', 'users', ['phone'], unique=False)
    op.create_unique_constraint('uq_users_phone_role', 'users', ['phone', 'role'])


def downgrade() -> None:
    op.drop_constraint('uq_users_phone_role', 'users', type_='unique')
    op.drop_index('ix_users_phone', table_name='users')
    op.create_index('ix_users_phone', 'users', ['phone'], unique=True)
