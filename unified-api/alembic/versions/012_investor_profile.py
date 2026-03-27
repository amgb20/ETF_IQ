"""Add investment_goal and risk_tolerance to users table.

Revision ID: 012
Revises: 011
Create Date: 2026-03-26
"""

import sqlalchemy as sa

from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("investment_goal", sa.String(30), nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("risk_tolerance", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "risk_tolerance")
    op.drop_column("users", "investment_goal")
