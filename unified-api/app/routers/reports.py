"""Reports endpoints -- trigger generation, poll status, download, list."""

from __future__ import annotations

import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.report_orchestrator import ReportOrchestrator
from app.database import get_db
from app.models.report import Report
from app.schemas.report import ReportCreate, ReportResponse, ReportStatusResponse
from app.auth.dependencies import RequireAuth, verify_portfolio_owner

router = APIRouter(prefix="/reports", tags=["reports"])


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

    asyncio.create_task(
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

    return FileResponse(
        report.file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=report.file_path.split("/")[-1].split("\\")[-1],
    )


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
