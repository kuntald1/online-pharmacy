"""manufacturer and marketer masters

Revision ID: f2a9c7d1e563
Revises: e7f1b3c58a44
Create Date: 2026-07-29 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a9c7d1e563'
down_revision: Union[str, None] = 'e7f1b3c58a44'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'manufacturers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
        sa.Column('address', sa.Text(), nullable=True),
    )
    op.create_table(
        'marketers',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False, unique=True),
        sa.Column('address', sa.Text(), nullable=True),
    )

    op.add_column('products', sa.Column('manufacturer_id', sa.Integer(), sa.ForeignKey('manufacturers.id'), nullable=True))
    op.add_column('products', sa.Column('marketer_id', sa.Integer(), sa.ForeignKey('marketers.id'), nullable=True))
    op.add_column('products', sa.Column('expiry_month', sa.Integer(), nullable=True))
    op.add_column('products', sa.Column('expiry_year', sa.Integer(), nullable=True))

    # Backfill: turn whatever free-text manufacturer/marketer names already
    # exist on products into master rows, then point products at them —
    # existing admin-entered data is preserved instead of wiped by this
    # switch from free text to a proper master list. Products sharing the
    # same manufacturer_name collapse into a single master row (first
    # address seen wins, since a manufacturer only has one real address).
    op.execute("""
        INSERT INTO manufacturers (name, address)
        SELECT manufacturer_name, MIN(manufacturer_address)
        FROM products
        WHERE manufacturer_name IS NOT NULL AND manufacturer_name != ''
        GROUP BY manufacturer_name
    """)
    op.execute("""
        UPDATE products
        SET manufacturer_id = (
            SELECT id FROM manufacturers WHERE manufacturers.name = products.manufacturer_name
        )
        WHERE manufacturer_name IS NOT NULL AND manufacturer_name != ''
    """)

    op.execute("""
        INSERT INTO marketers (name, address)
        SELECT marketer_name, MIN(marketer_address)
        FROM products
        WHERE marketer_name IS NOT NULL AND marketer_name != ''
        GROUP BY marketer_name
    """)
    op.execute("""
        UPDATE products
        SET marketer_id = (
            SELECT id FROM marketers WHERE marketers.name = products.marketer_name
        )
        WHERE marketer_name IS NOT NULL AND marketer_name != ''
    """)

    # expires_on_or_after was free text ("May, 2027", "24 months from mfg.",
    # etc.) with no reliable machine-parseable format, so it's dropped
    # without an automatic month/year backfill. Any product that had a value
    # there will need its expiry re-picked once from the new Month/Year
    # dropdowns in the admin panel — a one-time manual step, not a
    # per-request cost.
    op.drop_column('products', 'manufacturer_name')
    op.drop_column('products', 'manufacturer_address')
    op.drop_column('products', 'marketer_name')
    op.drop_column('products', 'marketer_address')
    op.drop_column('products', 'expires_on_or_after')


def downgrade() -> None:
    op.add_column('products', sa.Column('manufacturer_name', sa.String(length=255), nullable=True))
    op.add_column('products', sa.Column('manufacturer_address', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('marketer_name', sa.String(length=255), nullable=True))
    op.add_column('products', sa.Column('marketer_address', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('expires_on_or_after', sa.String(length=100), nullable=True))

    op.execute("""
        UPDATE products
        SET manufacturer_name = (SELECT name FROM manufacturers WHERE manufacturers.id = products.manufacturer_id),
            manufacturer_address = (SELECT address FROM manufacturers WHERE manufacturers.id = products.manufacturer_id)
        WHERE manufacturer_id IS NOT NULL
    """)
    op.execute("""
        UPDATE products
        SET marketer_name = (SELECT name FROM marketers WHERE marketers.id = products.marketer_id),
            marketer_address = (SELECT address FROM marketers WHERE marketers.id = products.marketer_id)
        WHERE marketer_id IS NOT NULL
    """)

    op.drop_column('products', 'expiry_year')
    op.drop_column('products', 'expiry_month')
    op.drop_column('products', 'marketer_id')
    op.drop_column('products', 'manufacturer_id')
    op.drop_table('marketers')
    op.drop_table('manufacturers')
