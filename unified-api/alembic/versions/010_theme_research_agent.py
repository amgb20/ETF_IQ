"""Add research_agent column to portfolio_themes.

Revision ID: 010
Revises: 009
Create Date: 2026-03-16
"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "portfolio_themes",
        sa.Column("research_agent", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("portfolio_themes", "research_agent")
