import uuid
from datetime import date as date_type, datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ETF(Base):
    __tablename__ = "etfs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    isin: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    ticker_yf: Mapped[str | None] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    currency: Mapped[str | None] = mapped_column(String(3))
    exchange: Mapped[str | None] = mapped_column(String(20))

    ter: Mapped[float | None] = mapped_column(Numeric(5, 4))
    aum_eur: Mapped[int | None] = mapped_column(BigInteger)
    inception_date: Mapped[date_type | None]
    domicile: Mapped[str | None] = mapped_column(String(50))
    replication: Mapped[str | None] = mapped_column(String(50))
    distribution: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(Text)
    holdings_count: Mapped[int | None] = mapped_column(Integer)
    vol_1y: Mapped[float | None] = mapped_column(Numeric(6, 2))
    vol_3y: Mapped[float | None] = mapped_column(Numeric(6, 2))
    ret_risk_1y: Mapped[float | None] = mapped_column(Numeric(6, 2))
    max_dd_1y: Mapped[float | None] = mapped_column(Numeric(6, 2))

    last_scraped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    holdings = relationship("ETFHolding", back_populates="etf", lazy="selectin")
    allocations = relationship("ETFAllocation", back_populates="etf", lazy="selectin")


class ETFHolding(Base):
    __tablename__ = "etf_holdings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    etf_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("etfs.id"))
    holding_name: Mapped[str | None] = mapped_column(String(200))
    holding_isin: Mapped[str | None] = mapped_column(String(12))
    holding_ticker: Mapped[str | None] = mapped_column(String(20))
    weight: Mapped[float | None] = mapped_column(Numeric(6, 4))
    refreshed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    etf = relationship("ETF", back_populates="holdings")


class ETFAllocation(Base):
    __tablename__ = "etf_allocations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    etf_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("etfs.id"))
    allocation_type: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    percentage: Mapped[float | None] = mapped_column(Numeric(6, 2))
    refreshed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    etf = relationship("ETF", back_populates="allocations")
