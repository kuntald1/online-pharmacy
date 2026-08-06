"""customer otp login

Revision ID: f4b9d2e871ac
Revises: a3f7c9e21b4d
Create Date: 2026-07-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b9d2e871ac'
down_revision: Union[str, None] = 'a3f7c9e21b4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # password_hash becomes optional — OTP-only customer accounts (created
    # on first successful SMS login) never set one. Relaxing NOT NULL -> NULL
    # is always safe on existing rows, no server_default needed.
    op.alter_column('users', 'password_hash', existing_type=sa.String(length=255), nullable=True)

    # lat/lng for "choose delivery address from map" — nullable, existing
    # addresses just won't have coordinates until re-saved via the map picker
    op.add_column('addresses', sa.Column('latitude', sa.Float(), nullable=True))
    op.add_column('addresses', sa.Column('longitude', sa.Float(), nullable=True))

    op.create_table(
        'otp_codes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('phone', sa.String(length=20), nullable=False),
        sa.Column('code_hash', sa.String(length=255), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('consumed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_otp_codes_phone', 'otp_codes', ['phone'])


def downgrade() -> None:
    op.drop_index('ix_otp_codes_phone', table_name='otp_codes')
    op.drop_table('otp_codes')
    op.drop_column('addresses', 'longitude')
    op.drop_column('addresses', 'latitude')
    op.alter_column('users', 'password_hash', existing_type=sa.String(length=255), nullable=False)
