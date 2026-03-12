import uuid

from sqlalchemy import Boolean, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth0_id: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(100))
    base_currency: Mapped[str] = mapped_column(String(3), default="EUR")
    role: Mapped[str] = mapped_column(String(20), default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    notify_email: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_digest: Mapped[bool] = mapped_column(Boolean, default=True)
    accepted_tos: Mapped[bool] = mapped_column(Boolean, default=False)
    theme: Mapped[str] = mapped_column(String(10), default="dark", server_default="dark")
    created_at: Mapped[str] = mapped_column(server_default=func.now())
