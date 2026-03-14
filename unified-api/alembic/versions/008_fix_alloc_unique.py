"""deduplicate etf_allocations and add unique constraint

Revision ID: 008
Revises: 007
Create Date: 2026-03-14
"""

from alembic import op

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove duplicate allocations, keeping the one with the latest refreshed_at
    op.execute("""
        DELETE FROM etf_allocations a
        USING etf_allocations b
        WHERE a.etf_id = b.etf_id
          AND a.allocation_type = b.allocation_type
          AND a.name = b.name
          AND a.refreshed_at < b.refreshed_at
    """)
    # If duplicates have the same refreshed_at, keep the one with the smaller id
    op.execute("""
        DELETE FROM etf_allocations a
        USING etf_allocations b
        WHERE a.etf_id = b.etf_id
          AND a.allocation_type = b.allocation_type
          AND a.name = b.name
          AND a.id > b.id
    """)
    op.create_unique_constraint(
        "uq_etf_allocations_etf_type_name",
        "etf_allocations",
        ["etf_id", "allocation_type", "name"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_etf_allocations_etf_type_name", "etf_allocations")
