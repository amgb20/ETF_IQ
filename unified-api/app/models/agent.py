import uuid
from datetime import date as date_type

from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AgentOutput(Base):
    __tablename__ = "agent_outputs"
    __table_args__ = (
        UniqueConstraint("portfolio_id", "agent_name", "run_date", "run_type"),
        Index(
            "idx_agent_scores",
            "portfolio_id",
            "agent_name",
            "run_date",
            postgresql_where="judge_overall_score IS NOT NULL",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"))
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    run_date: Mapped[date_type] = mapped_column(nullable=False)
    run_type: Mapped[str] = mapped_column(String(20), nullable=False)

    summary: Mapped[str] = mapped_column(Text, nullable=False)
    structured_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    reflection: Mapped[str | None] = mapped_column(Text)

    predictions: Mapped[dict | None] = mapped_column(JSONB)

    judge_evaluation: Mapped[dict | None] = mapped_column(JSONB)
    judge_run_date: Mapped[date_type | None]
    judge_overall_score: Mapped[float | None] = mapped_column(Numeric(4, 2))

    research_mode: Mapped[str | None] = mapped_column(String(20))
    thinking_tokens_used: Mapped[int | None] = mapped_column(Integer)
    sources_cited: Mapped[dict | None] = mapped_column(JSONB)

    model_used: Mapped[str | None] = mapped_column(String(50))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int | None] = mapped_column(Integer)

    created_at: Mapped[str] = mapped_column(server_default=func.now())


class ChartEvent(Base):
    __tablename__ = "chart_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"))
    agent_output_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("agent_outputs.id"))
    event_date: Mapped[date_type] = mapped_column(nullable=False)
    headline: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(500))
    tickers: Mapped[list[str]] = mapped_column(ARRAY(String(10)), nullable=False)
    themes: Mapped[list[str] | None] = mapped_column(ARRAY(String(50)))
    sentiment: Mapped[str | None] = mapped_column(String(10))
    importance: Mapped[int | None] = mapped_column(Integer, CheckConstraint("importance BETWEEN 1 AND 5"))
    source_agent: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[str] = mapped_column(server_default=func.now())
