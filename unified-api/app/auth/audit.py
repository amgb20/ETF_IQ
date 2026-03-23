"""Security audit logger.

All security-relevant events (login, logout, rate-limit hits, etc.) are emitted
as structured JSON lines to the ``security.audit`` logger.  They appear in the
container's stdout alongside regular application logs and can be shipped to any
log aggregator.

Set ``PERSIST_AUDIT_LOG=true`` in the environment to additionally write each
event to the ``auth_audit_log`` database table.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

logger = logging.getLogger("security.audit")


class AuthEvent(str, Enum):
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILURE = "LOGIN_FAILURE"
    ACCOUNT_DISABLED = "ACCOUNT_DISABLED"
    LOGOUT = "LOGOUT"
    TOKEN_REFRESH = "TOKEN_REFRESH"
    OTP_RATE_LIMITED = "OTP_RATE_LIMITED"
    START_RATE_LIMITED = "START_RATE_LIMITED"
    INVALID_ALGORITHM = "INVALID_ALGORITHM"
    TOKEN_REVOKED = "TOKEN_REVOKED"


_FAILURE_EVENTS = {
    AuthEvent.LOGIN_FAILURE,
    AuthEvent.ACCOUNT_DISABLED,
    AuthEvent.OTP_RATE_LIMITED,
    AuthEvent.START_RATE_LIMITED,
    AuthEvent.INVALID_ALGORITHM,
    AuthEvent.TOKEN_REVOKED,
}


async def log_auth_event(
    event: AuthEvent,
    *,
    email: Optional[str] = None,
    user_id: Optional[str] = None,
    ip: Optional[str] = None,
    detail: Optional[str] = None,
    db=None,
) -> None:
    """Emit a structured security audit log entry.

    Args:
        event: The ``AuthEvent`` classification.
        email: User email address (may be None for token-only events).
        user_id: Internal user UUID string (may be None before DB lookup).
        ip: Client IP address.
        detail: Optional freeform context (reason, algorithm, etc.).
        db: Optional async SQLAlchemy session.  When provided and
            ``PERSIST_AUDIT_LOG=true``, the event is also written to the
            ``auth_audit_log`` table.
    """
    record = {
        "event": event.value,
        "email": email,
        "user_id": user_id,
        "ip": ip,
        "ts": datetime.now(timezone.utc).isoformat(),
        "detail": detail,
    }

    level = logging.WARNING if event in _FAILURE_EVENTS else logging.INFO
    logger.log(level, json.dumps(record))

    if db is not None:
        await _persist(record, db)


async def _persist(record: dict, db) -> None:
    """Write the audit record to the database (best-effort, never raises)."""
    try:
        from app.config import get_settings
        if not get_settings().PERSIST_AUDIT_LOG:
            return

        from sqlalchemy import text
        await db.execute(
            text(
                "INSERT INTO auth_audit_log (event, email, user_id, ip_address, detail) "
                "VALUES (:event, :email, :user_id, :ip, :detail)"
            ),
            {
                "event": record["event"],
                "email": record["email"],
                "user_id": record["user_id"],
                "ip": record["ip"],
                "detail": record["detail"],
            },
        )
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to persist audit log entry: %s", exc)
