"""Add is_onboarded flag to users table.

Revision ID: 009
Revises: 008
Create Date: 2026-03-14
"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_onboarded", sa.Boolean(), server_default="false", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "is_onboarded")
