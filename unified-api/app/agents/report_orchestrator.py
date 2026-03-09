"""Report Generation Orchestrator -- triggers agent cycle and builds docx."""

from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy import select, update

from app.agents.context_builder import build as build_context
from app.agents.orchestrator import WeeklyOrchestrator
from app.agents.report_writer import ReportWriter
from app.database import async_session
from app.models.agent import AgentOutput
from app.models.report import Report

logger = logging.getLogger(__name__)

DEFAULT_SECTIONS = ["Exec Summary", "AI Stack", "Gold", "Defence", "Macro", "Risk", "Recommendations"]


class ReportOrchestrator:
    @staticmethod
    async def generate(
        report_id: uuid.UUID,
        portfolio_id: uuid.UUID,
        report_type: str,
        sections: list[str] | None = None,
    ) -> None:
        sections = sections or DEFAULT_SECTIONS
        run_type = "deep_research" if report_type == "monthly" else "standard"
        run_date = date.today()

        try:
            async with async_session() as session:
                await session.execute(
                    update(Report)
                    .where(Report.id == report_id)
                    .values(status="running")
                )
                await session.commit()

            logger.info(
                "ReportOrchestrator starting: report=%s portfolio=%s type=%s",
                report_id, portfolio_id, report_type,
            )

            result = await WeeklyOrchestrator.run(portfolio_id, run_date, run_type)

            async with async_session() as session:
                ctx = await build_context(portfolio_id, session)

                agent_result = await session.execute(
                    select(AgentOutput)
                    .where(
                        AgentOutput.portfolio_id == portfolio_id,
                        AgentOutput.run_date == run_date,
                    )
                )
                agent_outputs = list(agent_result.scalars().all())

                filepath = ReportWriter.build_docx(
                    portfolio_name=ctx.portfolio_name,
                    agent_outputs=agent_outputs,
                    sections=sections,
                    report_type=report_type,
                    run_date=run_date,
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

            logger.info("ReportOrchestrator complete: report=%s", report_id)

        except Exception:
            logger.exception("ReportOrchestrator failed: report=%s", report_id)
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
