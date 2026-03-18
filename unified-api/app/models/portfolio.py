import uuid
from datetime import date as date_type

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(server_default=func.now())

    themes = relationship("PortfolioTheme", back_populates="portfolio", lazy="selectin")
    positions = relationship("Position", back_populates="portfolio", lazy="selectin")
    snapshots = relationship("PortfolioSnapshot", back_populates="portfolio", lazy="selectin")


class PortfolioTheme(Base):
    __tablename__ = "portfolio_themes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    research_agent: Mapped[str | None] = mapped_column(String(100))

    portfolio = relationship("Portfolio", back_populates="themes")
    positions = relationship("Position", back_populates="theme", lazy="selectin")


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    __table_args__ = (UniqueConstraint("portfolio_id", "date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id"))
    date: Mapped[date_type] = mapped_column(nullable=False)
    total_value: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_pnl: Mapped[float | None] = mapped_column(Numeric(12, 2))
    total_pnl_pct: Mapped[float | None] = mapped_column(Numeric(8, 4))
    allocations: Mapped[dict | None] = mapped_column(JSONB)

    portfolio = relationship("Portfolio", back_populates="snapshots")
