"""Alert Evaluation Engine.

Daily cron job checks active alerts against latest prices and creates
AlertEvent records on threshold breach.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

import numpy as np
from sqlalchemy import select, desc, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert, AlertEvent
from app.models.price import Price
from app.models.user import User

logger = logging.getLogger(__name__)


class AlertEngine:
    @staticmethod
    async def evaluate_all(session: AsyncSession) -> int:
        """Check all active alerts against current prices. Returns count of triggered alerts."""
        result = await session.execute(
            select(Alert).where(Alert.is_active == True)  # noqa: E712
        )
        alerts = result.scalars().all()

        if not alerts:
            logger.info("AlertEngine: no active alerts to evaluate")
            return 0

        triggered = 0
        for alert in alerts:
            try:
                breached, actual_value, message = await AlertEngine._check(session, alert)
                if breached:
                    session.add(AlertEvent(
                        alert_id=alert.id,
                        actual_value=actual_value,
                        message=message,
                    ))
                    await session.execute(
                        update(Alert)
                        .where(Alert.id == alert.id)
                        .values(
                            last_triggered_at=func.now(),
                            trigger_count=Alert.trigger_count + 1,
                        )
                    )
                    triggered += 1
                    logger.info("Alert %s triggered: %s", alert.id, message)

                    try:
                        from app.services.email import send_alert_email
                        from app.models.portfolio import Portfolio
                        portfolio = await session.get(Portfolio, alert.portfolio_id)
                        if portfolio:
                            user = await session.get(User, portfolio.user_id)
                            if user:
                                await send_alert_email(user, alert, AlertEvent(
                                    alert_id=alert.id,
                                    actual_value=actual_value,
                                    message=message,
                                ))
                    except Exception:
                        logger.exception("Failed to send alert email for alert %s", alert.id)
            except Exception:
                logger.exception("AlertEngine: error checking alert %s", alert.id)

        await session.commit()
        logger.info("AlertEngine: evaluated %d alerts, %d triggered", len(alerts), triggered)
        return triggered

    @staticmethod
    async def _check(session: AsyncSession, alert: Alert) -> tuple[bool, float | None, str]:
        """Evaluate a single alert against latest price data."""
        latest = await session.execute(
            select(Price.close, Price.date)
            .where(Price.etf_id == alert.etf_id)
            .order_by(desc(Price.date))
            .limit(2)
        )
        rows = latest.all()
        if not rows:
            return False, None, "No price data available"

        current_close = float(rows[0].close)
        threshold = float(alert.threshold)

        if alert.type == "price_above":
            if current_close > threshold:
                return True, current_close, f"Price {current_close:.4f} above threshold {threshold:.4f}"
            return False, current_close, ""

        if alert.type == "price_below":
            if current_close < threshold:
                return True, current_close, f"Price {current_close:.4f} below threshold {threshold:.4f}"
            return False, current_close, ""

        if alert.type == "pct_change":
            if len(rows) < 2:
                return False, None, "Need at least 2 price points for pct_change"
            prev_close = float(rows[1].close)
            if prev_close == 0:
                return False, None, "Previous close is zero"
            pct = abs((current_close - prev_close) / prev_close * 100)
            if pct > threshold:
                return True, pct, f"Daily change {pct:.2f}% exceeds threshold {threshold:.2f}%"
            return False, pct, ""

        if alert.type == "volatility":
            cutoff = date.today() - timedelta(days=30)
            vol_result = await session.execute(
                select(Price.close)
                .where(Price.etf_id == alert.etf_id, Price.date >= cutoff)
                .order_by(Price.date)
            )
            closes = [float(r[0]) for r in vol_result.all()]
            if len(closes) < 5:
                return False, None, "Insufficient data for volatility calc"
            arr = np.array(closes)
            returns = np.diff(arr) / arr[:-1]
            stdev = float(np.std(returns)) * 100
            if stdev > threshold:
                return True, stdev, f"20-day volatility {stdev:.2f}% exceeds threshold {threshold:.2f}%"
            return False, stdev, ""

        return False, None, f"Unknown alert type: {alert.type}"
