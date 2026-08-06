"""product relations (fbt / similar / also bought)

Revision ID: c1d9e4f73b26
Revises: b6c4f8d21a05
Create Date: 2026-07-29 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c1d9e4f73b26'
down_revision: Union[str, None] = 'b6c4f8d21a05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Postgres enum types are database-global and op.create_table does not
    # auto-create them — create the type explicitly first, then reference it
    # with create_type=False in the column definition (same pattern used for
    # the 'visibility' enum).
    relation_type_enum = postgresql.ENUM('fbt', 'similar', 'also_bought', name='relationtype')
    relation_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'product_relations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('related_product_id', sa.Integer(), sa.ForeignKey('products.id'), nullable=False),
        sa.Column('relation_type', postgresql.ENUM('fbt', 'similar', 'also_bought', name='relationtype', create_type=False), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.UniqueConstraint('product_id', 'related_product_id', 'relation_type', name='uq_product_relation'),
    )
    op.create_index('ix_product_relations_product_id', 'product_relations', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_product_relations_product_id', table_name='product_relations')
    op.drop_table('product_relations')
    postgresql.ENUM(name='relationtype').drop(op.get_bind(), checkfirst=True)
