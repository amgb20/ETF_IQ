"""APScheduler wiring — started/stopped from FastAPI lifespan."""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _daily_job() -> None:
    """Daily 06:00 UTC — yfinance batch pull, alert evaluation, portfolio snapshot."""
    from data_connectors.registry import get_registry
    from app.agents.alert_engine import AlertEngine
    from app.database import async_session

    logger.info("CRON: daily job starting")
    connector = get_registry().get("yfinance")
    if connector:
        async with async_session() as session:
            await connector.ingest(session, period="5d")

    try:
        async with async_session() as session:
            triggered = await AlertEngine.evaluate_all(session)
            logger.info(
                "CRON: alert evaluation complete, %d alerts triggered", triggered
            )
    except Exception:
        logger.exception("CRON: alert evaluation failed")

    logger.info("CRON: daily job complete")


async def _weekly_justetf_job() -> None:
    """Weekly Sunday 22:00 UTC — full justETF refresh + overlap + comparison."""
    from data_connectors.registry import get_registry
    from data_connectors.justetf_conn.connector import JustETFConnector
    from app.database import async_session

    logger.info("CRON: weekly justETF refresh starting")
    connector = get_registry().get("justetf")
    if connector:
        async with async_session() as session:
            await connector.ingest(session)
            overlap = await JustETFConnector.compute_overlap(session)
            logger.info("Overlap matrix: %s", overlap)
        await JustETFConnector.fetch_comparison_chart()
    logger.info("CRON: weekly justETF refresh complete")


async def _weekly_agent_job() -> None:
    """Monday 08:00 UTC — full weekly agent cycle."""
    from datetime import date
    from sqlalchemy import select
    from app.agents.orchestrator import WeeklyOrchestrator
    from app.database import async_session
    from app.models import Portfolio

    logger.info("CRON: weekly agent cycle starting")
    try:
        async with async_session() as session:
            portfolios = (await session.execute(select(Portfolio))).scalars().all()
        for portfolio in portfolios:
            try:
                result = await WeeklyOrchestrator.run(portfolio.id, date.today())
                logger.info(
                    "CRON: agent cycle complete for portfolio %s: %s",
                    portfolio.id,
                    result,
                )
            except Exception:
                logger.exception(
                    "CRON: agent cycle failed for portfolio %s", portfolio.id
                )
    except Exception:
        logger.exception("CRON: weekly agent job failed")
    logger.info("CRON: weekly agent cycle finished")

    # Send weekly digest emails after agent cycle completes
    try:
        await _send_weekly_digests()
    except Exception:
        logger.exception("CRON: weekly digest emails failed")


async def _send_weekly_digests() -> None:
    """Send weekly digest email to all users with active portfolios."""
    from sqlalchemy import select
    from app.database import async_session
    from app.models import Portfolio, User
    from app.services.email import send_weekly_digest

    logger.info("CRON: sending weekly digest emails")
    async with async_session() as session:
        result = await session.execute(
            select(Portfolio, User).join(User, Portfolio.user_id == User.id)
        )
        rows = result.all()
        sent = 0
        for portfolio, user in rows:
            try:
                ok = await send_weekly_digest(user, str(portfolio.id), session)
                if ok:
                    sent += 1
            except Exception:
                logger.exception("Failed to send digest to user %s", user.id)
        logger.info("CRON: sent %d weekly digest emails", sent)


async def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")

    _scheduler.add_job(
        _daily_job,
        CronTrigger(hour=6, minute=0),
        id="daily_yfinance",
        replace_existing=True,
    )
    _scheduler.add_job(
        _weekly_justetf_job,
        CronTrigger(day_of_week="sun", hour=22, minute=0),
        id="weekly_justetf",
        replace_existing=True,
    )
    _scheduler.add_job(
        _weekly_agent_job,
        CronTrigger(day_of_week="mon", hour=8, minute=0),
        id="weekly_agents",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("Scheduler started with %d jobs", len(_scheduler.get_jobs()))
    return _scheduler


async def stop_scheduler(scheduler: AsyncIOScheduler | None = None) -> None:
    sched = scheduler or _scheduler
    if sched and sched.running:
        sched.shutdown(wait=False)
        logger.info("Scheduler stopped")
