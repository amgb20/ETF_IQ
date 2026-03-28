import uuid
from datetime import date as date_type

from sqlalchemy import Boolean, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Position(Base):
    __tablename__ = "positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"))
    etf_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("etfs.id"))
    theme_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("portfolio_themes.id"))
    layer_label: Mapped[str | None] = mapped_column(String(50))
    target_allocation: Mapped[float | None] = mapped_column(Numeric(5, 2))
    entry_date: Mapped[date_type] = mapped_column(nullable=False)
    entry_price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    shares: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)
    invested_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    exit_date: Mapped[date_type | None] = mapped_column(nullable=True)
    exit_price: Mapped[float | None] = mapped_column(Numeric(12, 4), nullable=True)
    created_at: Mapped[str] = mapped_column(server_default=func.now())

    portfolio = relationship("Portfolio", back_populates="positions")
    etf = relationship("ETF", lazy="selectin")
    theme = relationship("PortfolioTheme", lazy="selectin")
    transactions = relationship("Transaction", back_populates="position", lazy="selectin")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("positions.id"))
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    date: Mapped[date_type] = mapped_column(nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    shares: Mapped[float] = mapped_column(Numeric(12, 6), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(server_default=func.now())

    position = relationship("Position", back_populates="transactions")
