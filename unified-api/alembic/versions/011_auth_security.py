"""Auth security — add auth_audit_log table.

Revision ID: 011
Revises: 010
"""

import sqlalchemy as sa

from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_audit_log",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("event", sa.String(50), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        # No FK — audit logs must survive user deletion.
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auth_audit_log_email_created", "auth_audit_log", ["email", "created_at"])
    op.create_index("ix_auth_audit_log_created", "auth_audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_auth_audit_log_created", table_name="auth_audit_log")
    op.drop_index("ix_auth_audit_log_email_created", table_name="auth_audit_log")
    op.drop_table("auth_audit_log")
