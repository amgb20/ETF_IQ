"""Email service -- Resend integration for alert emails and weekly digests."""

from __future__ import annotations

import logging
from datetime import date, timedelta

import resend
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.agent import AgentOutput
from app.models.alert import Alert, AlertEvent
from app.models.user import User

logger = logging.getLogger(__name__)


def _configure_resend() -> bool:
    settings = get_settings()
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not configured; emails disabled")
        return False
    resend.api_key = settings.RESEND_API_KEY
    return True


async def send_alert_email(
    user: User,
    alert: Alert,
    event: AlertEvent,
) -> bool:
    if not user.notify_email:
        return False
    if not _configure_resend():
        return False

    settings = get_settings()
    subject = f"PortfolioIQ Alert: {alert.type} triggered"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #18181b;">Alert Triggered</h2>
        <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0 0 8px;"><strong>Type:</strong> {alert.type}</p>
            <p style="margin: 0 0 8px;"><strong>Threshold:</strong> {float(alert.threshold):.4f}</p>
            <p style="margin: 0 0 8px;"><strong>Actual Value:</strong> {float(event.actual_value):.4f if event.actual_value else 'N/A'}</p>
            <p style="margin: 0;"><strong>Details:</strong> {event.message or 'N/A'}</p>
        </div>
        <p style="color: #71717a; font-size: 12px;">
            This is an automated alert from PortfolioIQ. Not financial advice.
        </p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [user.email],
            "subject": subject,
            "html": html,
        })
        logger.info("Alert email sent to %s for alert %s", user.email, alert.id)
        return True
    except Exception:
        logger.exception("Failed to send alert email to %s", user.email)
        return False


async def send_weekly_digest(
    user: User,
    portfolio_id: str,
    session: AsyncSession,
) -> bool:
    if not user.notify_digest:
        return False
    if not _configure_resend():
        return False

    settings = get_settings()
    cutoff = date.today() - timedelta(days=7)

    # Fetch latest agent outputs
    result = await session.execute(
        select(AgentOutput)
        .where(
            AgentOutput.portfolio_id == portfolio_id,
            AgentOutput.run_date >= cutoff,
        )
        .order_by(desc(AgentOutput.run_date))
        .limit(10)
    )
    outputs = result.scalars().all()

    # Fetch recent alert events
    alert_result = await session.execute(
        select(AlertEvent, Alert)
        .join(Alert, AlertEvent.alert_id == Alert.id)
        .where(Alert.portfolio_id == portfolio_id)
        .order_by(desc(AlertEvent.triggered_at))
        .limit(3)
    )
    alert_rows = alert_result.all()

    # Compute system confidence
    scores = [float(o.judge_overall_score) for o in outputs if o.judge_overall_score is not None]
    avg_score = sum(scores) / len(scores) if scores else None
    confidence_str = f"{avg_score:.1f}/10" if avg_score else "N/A"

    # Build agent summary rows
    agent_rows_html = ""
    for o in outputs[:5]:
        score_str = f"{float(o.judge_overall_score):.1f}" if o.judge_overall_score else "—"
        agent_rows_html += f"""
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e4e4e7;">{o.agent_name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e4e4e7;">{o.run_date}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e4e4e7;">{score_str}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e4e4e7;">{o.summary[:120]}...</td>
        </tr>
        """

    alert_html = ""
    for event, alert in alert_rows:
        alert_html += f"<li>{alert.type}: {event.message or 'triggered'}</li>"

    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 700px; margin: 0 auto;">
        <h2 style="color: #18181b;">PortfolioIQ Weekly Digest</h2>
        <p style="color: #52525b;">System Confidence: <strong>{confidence_str}</strong></p>

        <h3 style="color: #18181b;">Agent Summaries</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="background: #f4f4f5;">
                    <th style="padding: 8px; text-align: left;">Agent</th>
                    <th style="padding: 8px; text-align: left;">Date</th>
                    <th style="padding: 8px; text-align: left;">Score</th>
                    <th style="padding: 8px; text-align: left;">Summary</th>
                </tr>
            </thead>
            <tbody>{agent_rows_html}</tbody>
        </table>

        {"<h3 style='color: #18181b;'>Recent Alerts</h3><ul>" + alert_html + "</ul>" if alert_html else ""}

        <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
        <p style="color: #a1a1aa; font-size: 11px;">
            This is an automated weekly digest from PortfolioIQ. Not financial advice.
            <br />To unsubscribe, update your notification preferences in your account settings.
        </p>
    </div>
    """

    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": [user.email],
            "subject": f"PortfolioIQ Weekly Digest -- {date.today().isoformat()}",
            "html": html,
        })
        logger.info("Weekly digest sent to %s", user.email)
        return True
    except Exception:
        logger.exception("Failed to send weekly digest to %s", user.email)
        return False
