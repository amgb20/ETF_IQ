"""Auth updates — nullable auth0_id, is_active column, unique email

Revision ID: 002
Revises: 001
Create Date: 2026-03-09
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "auth0_id", existing_type=sa.String(100), nullable=True)
    op.add_column("users", sa.Column("is_active", sa.Boolean, server_default="true", nullable=False))
    op.create_unique_constraint("uq_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.drop_column("users", "is_active")
    op.alter_column("users", "auth0_id", existing_type=sa.String(100), nullable=False)
