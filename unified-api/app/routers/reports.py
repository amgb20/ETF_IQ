"""Reports endpoints -- trigger generation, poll status, download, list, delete."""

from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import FileResponse
from sqlalchemy import delete, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.report_orchestrator import ReportOrchestrator
from app.agents.tools import rag_store
from app.database import get_db
from app.models.agent import AgentOutput, ChartEvent
from app.models.report import Report
from app.schemas.report import ReportCreate, ReportResponse, ReportStatusResponse
from app.auth.dependencies import RequireAuth, verify_portfolio_owner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

_background_tasks: set[asyncio.Task] = set()


def _spawn_background(coro) -> asyncio.Task:
    """Create a background task and keep a strong reference to prevent GC."""
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task


@router.post("", response_model=ReportResponse, status_code=201)
async def create_report(
    body: ReportCreate,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(body.portfolio_id, user, db)

    report = Report(
        portfolio_id=body.portfolio_id,
        type=body.type,
        status="pending",
        schema_config={"sections": body.sections} if body.sections else None,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    _spawn_background(
        ReportOrchestrator.generate(
            report_id=report.id,
            portfolio_id=body.portfolio_id,
            report_type=body.type,
            sections=body.sections,
        )
    )

    return ReportResponse.model_validate(report)


@router.get("/{report_id}/status", response_model=ReportStatusResponse)
async def get_report_status(
    report_id: uuid.UUID,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await verify_portfolio_owner(report.portfolio_id, user, db)

    return ReportStatusResponse(
        id=report.id,
        status=report.status,
        summary_sentence=report.summary_sentence,
        current_step=report.status,
    )


@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await verify_portfolio_owner(report.portfolio_id, user, db)

    if not report.file_path:
        raise HTTPException(status_code=404, detail="Report file not yet generated")

    fpath = Path(report.file_path)
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="Report file missing from disk")

    if fpath.suffix == ".pdf":
        return FileResponse(fpath, media_type="application/pdf")

    return FileResponse(
        fpath,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=fpath.name,
    )


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: uuid.UUID,
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    await verify_portfolio_owner(report.portfolio_id, user, db)

    if report.agent_output_ids:
        # 1. Find chart events linked to these agent outputs
        ce_result = await db.execute(
            select(ChartEvent.id).where(
                ChartEvent.agent_output_id.in_(report.agent_output_ids)
            )
        )
        chart_event_ids = [row[0] for row in ce_result.all()]

        # 2. Delete chart event RAG embeddings + rows
        if chart_event_ids:
            ce_deleted = await rag_store.delete_chunks(db, "chart_event", chart_event_ids)
            logger.info("Deleted %d chart_event rag_chunks for report %s", ce_deleted, report_id)
            await db.execute(
                delete(ChartEvent).where(ChartEvent.id.in_(chart_event_ids))
            )
            logger.info("Deleted %d chart_events for report %s", len(chart_event_ids), report_id)

        # 3. Delete agent output RAG embeddings + rows
        deleted = await rag_store.delete_chunks(db, "agent_output", report.agent_output_ids)
        logger.info("Deleted %d agent_output rag_chunks for report %s", deleted, report_id)

        await db.execute(
            delete(AgentOutput).where(AgentOutput.id.in_(report.agent_output_ids))
        )

    if report.file_path:
        Path(report.file_path).unlink(missing_ok=True)

    await db.delete(report)
    await db.commit()
    return Response(status_code=204)


@router.get("", response_model=list[ReportResponse])
async def list_reports(
    portfolio_id: uuid.UUID = Query(...),
    user: RequireAuth = ...,
    db: AsyncSession = Depends(get_db),
):
    await verify_portfolio_owner(portfolio_id, user, db)

    result = await db.execute(
        select(Report)
        .where(Report.portfolio_id == portfolio_id)
        .order_by(desc(Report.generated_at))
    )
    reports = result.scalars().all()
    return [ReportResponse.model_validate(r) for r in reports]
