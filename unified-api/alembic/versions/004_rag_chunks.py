"""004_rag_chunks: pgvector extension and rag_chunks table.

Revision ID: 004
Revises: 003
Create Date: 2026-03-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "rag_chunks",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "portfolio_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("portfolios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(30), nullable=False),
        sa.Column("source_id", sa.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_text", sa.Text, nullable=False),
        sa.Column("embedding", Vector(768), nullable=False),
        sa.Column("metadata", postgresql.JSONB),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("idx_rag_chunks_portfolio", "rag_chunks", ["portfolio_id"])
    op.execute("""
        CREATE INDEX idx_rag_chunks_ivfflat
        ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    """)


def downgrade() -> None:
    op.drop_table("rag_chunks")
