import uuid
from datetime import date as date_type

from sqlalchemy import BigInteger, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Price(Base):
    __tablename__ = "prices"

    etf_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("etfs.id"), primary_key=True)
    date: Mapped[date_type] = mapped_column(primary_key=True)
    open: Mapped[float | None] = mapped_column(Numeric(12, 4))
    high: Mapped[float | None] = mapped_column(Numeric(12, 4))
    low: Mapped[float | None] = mapped_column(Numeric(12, 4))
    close: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    volume: Mapped[int | None] = mapped_column(BigInteger)
