import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.dependencies import require_role
from data_connectors.registry import get_registry

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/connectors/{name}/run")
async def run_connector(name: str, _user=Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    registry = get_registry()
    connector = registry.get(name)
    if not connector:
        raise HTTPException(status_code=404, detail=f"Connector '{name}' not found. Available: {registry.names()}")

    await connector.ingest(db)
    return {"status": "ok", "connector": name}


class AgentRunRequest(BaseModel):
    portfolio_id: uuid.UUID | None = None
    run_date: date | None = None
    run_type: str = "standard"


@router.post("/agents/run")
async def run_agents(body: AgentRunRequest, _user=Depends(require_role("admin")), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.agents.orchestrator import WeeklyOrchestrator
    from app.models import Portfolio

    run_date = body.run_date or date.today()

    if body.portfolio_id:
        portfolio = await db.get(Portfolio, body.portfolio_id)
        if not portfolio:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        result = await WeeklyOrchestrator.run(body.portfolio_id, run_date, body.run_type)
        return {"status": "ok", "result": result}

    portfolios = (await db.execute(select(Portfolio))).scalars().all()
    if not portfolios:
        raise HTTPException(status_code=404, detail="No portfolios found")

    results = []
    for p in portfolios:
        r = await WeeklyOrchestrator.run(p.id, run_date, body.run_type)
        results.append(r)
    return {"status": "ok", "results": results}


@router.post("/etfs/enrich")
async def enrich_etfs(
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Run yfinance metadata enrichment + risk field computation on all ETFs."""
    registry = get_registry()
    yf_conn = registry.get("yfinance")
    if not yf_conn:
        raise HTTPException(status_code=500, detail="yfinance connector not available")

    meta_count = await yf_conn.enrich_metadata(db)
    risk_count = await yf_conn.compute_risk_fields(db)
    return {"status": "ok", "metadata_enriched": meta_count, "risk_computed": risk_count}


@router.get("/costs")
async def get_costs(
    month: date | None = Query(None, description="First day of month, e.g. 2026-03-01"),
    user_id: uuid.UUID | None = Query(None),
    _user=Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    from app.services.cost_tracker import get_monthly_costs

    costs = await get_monthly_costs(
        session=db,
        month=month,
        user_id=str(user_id) if user_id else None,
    )
    return {"month": str(month or date.today().replace(day=1)), "costs": costs}
