"""Report Generation Orchestrator -- triggers agent cycle and builds PDF."""

from __future__ import annotations

import logging
import time as _time
import uuid
from datetime import date

from sqlalchemy import select, update

from app.agents.context_builder import build as build_context, load_portfolio_themes
from app.agents.orchestrator import WeeklyOrchestrator
from app.agents.report_writer import ReportWriter
from app.database import async_session
from app.models.agent import AgentOutput
from app.models.notification import Notification
from app.models.portfolio import Portfolio, PortfolioTheme
from app.models.report import Report

logger = logging.getLogger(__name__)

FIXED_SECTIONS_PREFIX = ["Exec Summary"]
FIXED_SECTIONS_SUFFIX = ["Macro", "Risk", "Recommendations"]


async def build_default_sections(portfolio_id: uuid.UUID) -> list[str]:
    """Build an ordered section list from portfolio themes + fixed sections."""
    async with async_session() as session:
        themes = await load_portfolio_themes(portfolio_id, session)
    theme_sections = [t.name for t in themes]
    return FIXED_SECTIONS_PREFIX + theme_sections + FIXED_SECTIONS_SUFFIX


async def build_section_agent_map(portfolio_id: uuid.UUID) -> dict[str, str]:
    """Build a mapping of section name -> agent_name from portfolio themes."""
    import re

    fixed = {
        "Exec Summary": "action_recommender",
        "Macro": "macro_analyst",
        "Risk": "risk_assessor",
        "Recommendations": "action_recommender",
    }
    async with async_session() as session:
        themes = await load_portfolio_themes(portfolio_id, session)
    for t in themes:
        agent = t.research_agent or f"{re.sub(r'[^a-z0-9]+', '_', t.name.lower()).strip('_')}_analyst"
        fixed[t.name] = agent
    return fixed


class ReportOrchestrator:
    @staticmethod
    async def generate(
        report_id: uuid.UUID,
        portfolio_id: uuid.UUID,
        report_type: str,
        sections: list[str] | None = None,
    ) -> None:
        if not sections:
            sections = await build_default_sections(portfolio_id)
        run_type = "deep_research" if report_type == "monthly" else "standard"
        run_date = date.today()
        t0 = _time.perf_counter()

        try:
            async with async_session() as session:
                await session.execute(
                    update(Report)
                    .where(Report.id == report_id)
                    .values(status="running")
                )
                await session.commit()

            logger.info(
                "ReportOrchestrator starting: report=%s portfolio=%s type=%s sections=%s",
                report_id, portfolio_id, report_type, sections,
            )

            logger.info("ReportOrchestrator: running agent pipeline...")
            result = await WeeklyOrchestrator.run(portfolio_id, run_date, run_type)
            logger.info(
                "ReportOrchestrator: agent pipeline finished (succeeded=%s, failed=%s)",
                result.get("agents_succeeded"), result.get("agents_failed"),
            )

            async with async_session() as session:
                logger.info("ReportOrchestrator: building PDF...")
                ctx = await build_context(portfolio_id, session)

                agent_result = await session.execute(
                    select(AgentOutput)
                    .where(
                        AgentOutput.portfolio_id == portfolio_id,
                        AgentOutput.run_date == run_date,
                    )
                )
                agent_outputs = list(agent_result.scalars().all())
                logger.info("ReportOrchestrator: found %d agent outputs for PDF", len(agent_outputs))

                section_map = await build_section_agent_map(portfolio_id)

                filepath = ReportWriter.build_pdf(
                    portfolio_name=ctx.portfolio_name,
                    agent_outputs=agent_outputs,
                    sections=sections,
                    report_type=report_type,
                    run_date=run_date,
                    section_agent_map=section_map,
                )

                output_ids = [o.id for o in agent_outputs]

                recommender_output = next(
                    (o for o in agent_outputs if o.agent_name == "action_recommender"), None
                )
                summary = None
                if recommender_output:
                    text = recommender_output.summary
                    first_period = text.find(". ")
                    if first_period > 0:
                        summary = text[: first_period + 1]
                    else:
                        summary = text[:200]

                await session.execute(
                    update(Report)
                    .where(Report.id == report_id)
                    .values(
                        status="complete",
                        file_path=filepath,
                        agent_output_ids=output_ids,
                        summary_sentence=summary,
                        research_mode=run_type,
                    )
                )
                await session.commit()

                try:
                    portfolio = await session.get(Portfolio, portfolio_id)
                    if portfolio:
                        session.add(Notification(
                            user_id=portfolio.user_id,
                            type="report_ready",
                            title="Report ready",
                            message=summary or f"Your {report_type} report is ready to download.",
                            ref_id=report_id,
                        ))
                        await session.commit()
                except Exception:
                    logger.debug("Failed to create report-ready notification", exc_info=True)

            elapsed_ms = int((_time.perf_counter() - t0) * 1000)
            logger.info("ReportOrchestrator complete: report=%s (elapsed=%dms)", report_id, elapsed_ms)

        except Exception:
            elapsed_ms = int((_time.perf_counter() - t0) * 1000)
            logger.exception("ReportOrchestrator failed: report=%s (elapsed=%dms)", report_id, elapsed_ms)
            try:
                async with async_session() as session:
                    await session.execute(
                        update(Report)
                        .where(Report.id == report_id)
                        .values(status="failed")
                    )
                    await session.commit()
            except Exception:
                logger.exception("Failed to update report status to 'failed'")
