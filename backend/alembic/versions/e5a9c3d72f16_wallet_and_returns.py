"""wallet and returns

Revision ID: e5a9c3d72f16
Revises: d3f7a2b691e4
Create Date: 2026-07-30 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5a9c3d72f16'
down_revision: Union[str, None] = 'd3f7a2b691e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('wallet_balance', sa.Numeric(10, 2), nullable=False, server_default='0'))

    # return_requests first — wallet_transactions references it below.
    op.create_table(
        'return_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('order_item_id', sa.Integer(), sa.ForeignKey('order_items.id'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('image_url', sa.String(length=500), nullable=True),
        sa.Column(
            'status',
            sa.Enum('requested', 'pickup_scheduled', 'picked_up', 'approved', 'rejected', name='returnstatus'),
            nullable=False, server_default='requested',
        ),
        sa.Column('refund_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('refund_method', sa.Enum('wallet', 'original_payment', name='refundmethod'), nullable=True),
        sa.Column('admin_note', sa.String(length=500), nullable=True),
        sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_return_requests_user_id', 'return_requests', ['user_id'])

    op.create_table(
        'wallet_transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', sa.Enum('credit', 'debit', name='wallettransactiontype'), nullable=False),
        sa.Column(
            'reason',
            sa.Enum('topup', 'return_refund', 'order_payment', 'admin_adjustment', name='wallettransactionreason'),
            nullable=False,
        ),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('balance_after', sa.Numeric(10, 2), nullable=False),
        sa.Column('reference_order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('reference_return_id', sa.Integer(), sa.ForeignKey('return_requests.id'), nullable=True),
        sa.Column('note', sa.String(length=255), nullable=True),
        sa.Column('razorpay_payment_id', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_wallet_transactions_user_id', 'wallet_transactions', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_wallet_transactions_user_id', table_name='wallet_transactions')
    op.drop_table('wallet_transactions')
    op.drop_index('ix_return_requests_user_id', table_name='return_requests')
    op.drop_table('return_requests')
    op.drop_column('users', 'wallet_balance')
    op.execute("DROP TYPE IF EXISTS returnstatus")
    op.execute("DROP TYPE IF EXISTS refundmethod")
    op.execute("DROP TYPE IF EXISTS wallettransactiontype")
    op.execute("DROP TYPE IF EXISTS wallettransactionreason")
