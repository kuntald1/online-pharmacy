"""prescription uploads

Revision ID: a2c8e5f91d34
Revises: f7a1c9e30b52
Create Date: 2026-07-29 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2c8e5f91d34'
down_revision: Union[str, None] = 'f7a1c9e30b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'prescription_uploads',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('file_url', sa.String(length=500), nullable=False),
        sa.Column('extracted_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_prescription_uploads_user_id', 'prescription_uploads', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_prescription_uploads_user_id', table_name='prescription_uploads')
    op.drop_table('prescription_uploads')
