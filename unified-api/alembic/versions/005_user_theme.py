"""add theme column to users

Revision ID: 005
Revises: 004
Create Date: 2026-03-12
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("theme", sa.String(10), nullable=True, server_default="dark"),
    )


def downgrade() -> None:
    op.drop_column("users", "theme")
