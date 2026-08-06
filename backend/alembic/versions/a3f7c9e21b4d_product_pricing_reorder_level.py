"""product pricing reorder level

Revision ID: a3f7c9e21b4d
Revises: 7b42ad7f997f
Create Date: 2026-07-16 09:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f7c9e21b4d'
down_revision: Union[str, None] = '7b42ad7f997f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # reorder_level moves from being one value per product to one value per
    # pricing row (B2C / B2B Normal / B2B Advance can genuinely need
    # different reorder thresholds). NOT NULL with a server_default since
    # product_pricing rows already exist in real installs.
    op.add_column('product_pricing', sa.Column('reorder_level', sa.Integer(), nullable=False, server_default='0'))

    # carry forward whatever the admin had already set at the product level,
    # rather than silently resetting everyone's reorder thresholds to 0
    op.execute("""
        UPDATE product_pricing
        SET reorder_level = (
            SELECT products.reorder_level FROM products WHERE products.id = product_pricing.product_id
        )
        WHERE EXISTS (
            SELECT 1 FROM products WHERE products.id = product_pricing.product_id AND products.reorder_level > 0
        )
    """)

    # products.reorder_level itself is intentionally left in place (not
    # dropped) — it's simply unused by the UI now. Dropping it is an easy,
    # low-risk follow-up later once nothing references it, but there's no
    # reason to force that churn in the same migration as the real change.


def downgrade() -> None:
    op.drop_column('product_pricing', 'reorder_level')
