"""Add exit_date, exit_price to positions and backfill buy transactions.

Revision ID: 013
Revises: 012
"""

import sqlalchemy as sa

from alembic import op

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("positions", sa.Column("exit_date", sa.Date, nullable=True))
    op.add_column("positions", sa.Column("exit_price", sa.Numeric(12, 4), nullable=True))

    op.execute(
        """
        INSERT INTO transactions (id, position_id, type, date, price, shares, amount, created_at)
        SELECT gen_random_uuid(), id, 'buy', entry_date, entry_price, shares, invested_amount, created_at
        FROM positions
        WHERE id NOT IN (SELECT position_id FROM transactions WHERE type = 'buy')
        """
    )


def downgrade() -> None:
    op.drop_column("positions", "exit_price")
    op.drop_column("positions", "exit_date")
