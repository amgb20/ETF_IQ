"""Initial schema — all Phase 1 tables

Revision ID: 001
Revises:
Create Date: 2026-03-07
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══ USERS ═══
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("auth0_id", sa.String(100), unique=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("display_name", sa.String(100)),
        sa.Column("base_currency", sa.String(3), server_default="EUR"),
        sa.Column("role", sa.String(20), server_default="user"),
        sa.Column("notify_email", sa.Boolean, server_default="true"),
        sa.Column("notify_digest", sa.Boolean, server_default="true"),
        sa.Column("accepted_tos", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ═══ PORTFOLIOS ═══
    op.create_table(
        "portfolios",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ═══ THEMES ═══
    op.create_table(
        "portfolio_themes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7)),
        sa.Column("sort_order", sa.Integer, server_default="0"),
    )

    # ═══ ETF REGISTRY ═══
    op.create_table(
        "etfs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("isin", sa.String(12), unique=True, nullable=False),
        sa.Column("ticker_yf", sa.String(20)),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("currency", sa.String(3)),
        sa.Column("exchange", sa.String(20)),
        sa.Column("ter", sa.Numeric(5, 4)),
        sa.Column("aum_eur", sa.BigInteger),
        sa.Column("inception_date", sa.Date),
        sa.Column("domicile", sa.String(50)),
        sa.Column("replication", sa.String(50)),
        sa.Column("distribution", sa.String(20)),
        sa.Column("description", sa.Text),
        sa.Column("holdings_count", sa.Integer),
        sa.Column("vol_1y", sa.Numeric(6, 2)),
        sa.Column("vol_3y", sa.Numeric(6, 2)),
        sa.Column("ret_risk_1y", sa.Numeric(6, 2)),
        sa.Column("max_dd_1y", sa.Numeric(6, 2)),
        sa.Column("last_scraped_at", sa.DateTime(timezone=True)),
    )

    # ═══ ETF HOLDINGS ═══
    op.create_table(
        "etf_holdings",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("etf_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("etfs.id")),
        sa.Column("holding_name", sa.String(200)),
        sa.Column("holding_isin", sa.String(12)),
        sa.Column("holding_ticker", sa.String(20)),
        sa.Column("weight", sa.Numeric(6, 4)),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ═══ ETF ALLOCATIONS ═══
    op.create_table(
        "etf_allocations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("etf_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("etfs.id")),
        sa.Column("allocation_type", sa.String(10), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("percentage", sa.Numeric(6, 2)),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ═══ POSITIONS ═══
    op.create_table(
        "positions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE")),
        sa.Column("etf_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("etfs.id")),
        sa.Column("theme_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolio_themes.id"), nullable=True),
        sa.Column("layer_label", sa.String(50)),
        sa.Column("target_allocation", sa.Numeric(5, 2)),
        sa.Column("entry_date", sa.Date, nullable=False),
        sa.Column("entry_price", sa.Numeric(12, 4), nullable=False),
        sa.Column("shares", sa.Numeric(12, 6), nullable=False),
        sa.Column("invested_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ═══ TRANSACTIONS ═══
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("position_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("positions.id")),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("price", sa.Numeric(12, 4), nullable=False),
        sa.Column("shares", sa.Numeric(12, 6), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ═══ PRICES ═══
    op.create_table(
        "prices",
        sa.Column("etf_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("etfs.id"), primary_key=True),
        sa.Column("date", sa.Date, primary_key=True),
        sa.Column("open", sa.Numeric(12, 4)),
        sa.Column("high", sa.Numeric(12, 4)),
        sa.Column("low", sa.Numeric(12, 4)),
        sa.Column("close", sa.Numeric(12, 4), nullable=False),
        sa.Column("volume", sa.BigInteger),
    )

    # ═══ PORTFOLIO SNAPSHOTS ═══
    op.create_table(
        "portfolio_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id")),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("total_value", sa.Numeric(12, 2)),
        sa.Column("total_pnl", sa.Numeric(12, 2)),
        sa.Column("total_pnl_pct", sa.Numeric(8, 4)),
        sa.Column("allocations", postgresql.JSONB),
        sa.UniqueConstraint("portfolio_id", "date"),
    )

    # ═══ AGENT OUTPUTS ═══
    op.create_table(
        "agent_outputs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE")),
        sa.Column("agent_name", sa.String(50), nullable=False),
        sa.Column("run_date", sa.Date, nullable=False),
        sa.Column("run_type", sa.String(20), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column("structured_data", postgresql.JSONB, nullable=False),
        sa.Column("reflection", sa.Text),
        sa.Column("predictions", postgresql.JSONB),
        sa.Column("judge_evaluation", postgresql.JSONB),
        sa.Column("judge_run_date", sa.Date),
        sa.Column("judge_overall_score", sa.Numeric(4, 2)),
        sa.Column("research_mode", sa.String(20)),
        sa.Column("thinking_tokens_used", sa.Integer),
        sa.Column("sources_cited", postgresql.JSONB),
        sa.Column("model_used", sa.String(50)),
        sa.Column("prompt_tokens", sa.Integer),
        sa.Column("completion_tokens", sa.Integer),
        sa.Column("latency_ms", sa.Integer),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("portfolio_id", "agent_name", "run_date", "run_type"),
    )
    op.create_index(
        "idx_agent_scores",
        "agent_outputs",
        ["portfolio_id", "agent_name", sa.text("run_date DESC")],
        postgresql_where=sa.text("judge_overall_score IS NOT NULL"),
    )

    # ═══ CHART EVENTS ═══
    op.create_table(
        "chart_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE")),
        sa.Column("agent_output_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_outputs.id"), nullable=True),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("headline", sa.String(200), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("source_url", sa.String(500)),
        sa.Column("tickers", postgresql.ARRAY(sa.String(10)), nullable=False),
        sa.Column("themes", postgresql.ARRAY(sa.String(50))),
        sa.Column("sentiment", sa.String(10)),
        sa.Column("importance", sa.Integer),
        sa.Column("source_agent", sa.String(50)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("importance BETWEEN 1 AND 5"),
    )

    # ═══ ALERTS ═══
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("etf_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("etfs.id"), nullable=True),
        sa.Column("threshold", sa.Numeric(12, 4), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_triggered_at", sa.DateTime(timezone=True)),
        sa.Column("trigger_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "alert_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("alert_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("alerts.id")),
        sa.Column("triggered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("actual_value", sa.Numeric(12, 4)),
        sa.Column("message", sa.Text),
    )

    # ═══ REPORTS ═══
    op.create_table(
        "reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE")),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("summary_sentence", sa.Text),
        sa.Column("file_path", sa.String(500)),
        sa.Column("agent_output_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True))),
        sa.Column("schema_config", postgresql.JSONB),
        sa.Column("research_mode", sa.String(20)),
    )

    # ═══ CHAT SESSIONS ═══
    op.create_table(
        "chat_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("portfolio_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE")),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE")),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("tools_used", postgresql.JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("reports")
    op.drop_table("alert_events")
    op.drop_table("alerts")
    op.drop_table("chart_events")
    op.drop_index("idx_agent_scores", table_name="agent_outputs")
    op.drop_table("agent_outputs")
    op.drop_table("portfolio_snapshots")
    op.drop_table("prices")
    op.drop_table("transactions")
    op.drop_table("positions")
    op.drop_table("etf_allocations")
    op.drop_table("etf_holdings")
    op.drop_table("etfs")
    op.drop_table("portfolio_themes")
    op.drop_table("portfolios")
    op.drop_table("users")
