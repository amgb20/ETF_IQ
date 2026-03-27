"""Add sources JSONB column to chat_messages.

Revision ID: 012
Revises: 011
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("chat_messages", sa.Column("sources", JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column("chat_messages", "sources")
