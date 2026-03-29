"""Onboarding endpoints — theme classification, correlation analysis, advisor, and completion."""

from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents.onboarding.correlation import (
    compute_holdings_overlap,
    compute_price_correlations,
    flag_correlated_pairs,
)
from app.agents.onboarding.correlation_advisor import (
    advise_on_correlations,
    enrich_suggestions_from_db,
)
from app.agents.onboarding.theme_classifier import classify_themes
from app.auth.dependencies import RequireAuth
from app.database import get_db
from app.models.alert import Alert, AlertEvent
from app.models.etf import ETF, ETFHolding
from app.models.portfolio import Portfolio, PortfolioSnapshot, PortfolioTheme
from app.models.position import Position, Transaction
from app.models.price import Price
from app.models.report import Report
from app.schemas.onboarding import (
    AdvisorRequest,
    AdvisorResponse,
    ClassifyThemesRequest,
    ClassifyThemesResponse,
    CorrelationsRequest,
    CorrelationsResponse,
    FlaggedPair,
    HydrateETFsRequest,
    HydrateETFsResponse,
    OnboardingCompleteRequest,
    OnboardingStatusResponse,
    PairCorrelation,
    PairOverlap,
    PairRanking,
    RankedETF,
    ReplacementSuggestion,
    SuggestedETF,
    ThemeClassification,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])

REPORTS_DIR = Path(__file__).resolve().parent.parent.parent / "reports"


# ── Helpers ─────────────────────────────────────────────────────────


async def _load_etfs_by_ids(
    db: AsyncSession,
    etf_ids: list[uuid.UUID],
    with_holdings: bool = False,
) -> dict[uuid.UUID, ETF]:
    """Load ETFs by ID. Optionally eager-load holdings and allocations."""
    stmt = select(ETF).where(ETF.id.in_(etf_ids))
    if with_holdings:
        stmt = stmt.options(
            selectinload(ETF.holdings),
            selectinload(ETF.allocations),
        )
    result = await db.execute(stmt)
    etfs = result.scalars().all()

    etf_map = {etf.id: etf for etf in etfs}

    # Validate all requested IDs were found
    missing = set(etf_ids) - set(etf_map.keys())
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"ETFs not found: {[str(m) for m in missing]}",
        )

    return etf_map


async def _delete_user_portfolios(user_id: uuid.UUID, db: AsyncSession) -> tuple[int, list[Path]]:
    """Delete all portfolios for a user, handling tables that lack CASCADE FKs.

    Returns the count of deleted portfolios and a list of report file paths
    to clean up.  Callers must delete files only **after** the DB transaction
    commits so that a rollback never leaves the filesystem out of sync.
    """
    result = await db.execute(select(Portfolio).where(Portfolio.user_id == user_id))
    old_portfolios = result.scalars().all()
    if not old_portfolios:
        return 0, []

    old_ids = [p.id for p in old_portfolios]

    # AlertEvent lacks a direct CASCADE from Portfolio; delete explicitly.
    # Alert (the direct child of Portfolio) *is* covered by CASCADE.
    await db.execute(
        delete(AlertEvent).where(AlertEvent.alert_id.in_(select(Alert.id).where(Alert.portfolio_id.in_(old_ids))))
    )
    await db.execute(
        delete(Transaction).where(
            Transaction.position_id.in_(select(Position.id).where(Position.portfolio_id.in_(old_ids)))
        )
    )
    await db.execute(delete(PortfolioSnapshot).where(PortfolioSnapshot.portfolio_id.in_(old_ids)))

    # Collect report file paths for post-commit cleanup
    report_result = await db.execute(select(Report.file_path).where(Report.portfolio_id.in_(old_ids)))
    files_to_delete: list[Path] = []
    for (fpath,) in report_result.all():
        if not fpath:
            continue
        resolved = Path(fpath).resolve()
        if resolved.is_relative_to(REPORTS_DIR.resolve()):
            files_to_delete.append(resolved)
        else:
            logger.warning("Skipping report file outside REPORTS_DIR: %s", fpath)

    # Detach positions from themes (positions.theme_id FK has no CASCADE)
    await db.execute(delete(Position).where(Position.portfolio_id.in_(old_ids)))

    # Bulk-delete portfolios — CASCADE handles themes, alerts, agent_outputs,
    # chart_events, reports, chat_sessions, rag_chunks
    await db.execute(delete(Portfolio).where(Portfolio.id.in_(old_ids)))
    await db.flush()

    return len(old_portfolios), files_to_delete


# ── Endpoints ───────────────────────────────────────────────────────


@router.get("/status", response_model=OnboardingStatusResponse)
async def onboarding_status(user: RequireAuth):
    """Check whether the current user has completed onboarding."""
    return OnboardingStatusResponse(is_onboarded=user.is_onboarded)


@router.post("/hydrate-etfs", response_model=HydrateETFsResponse)
async def hydrate_etfs(
    body: HydrateETFsRequest,
    user: RequireAuth,
    db: AsyncSession = Depends(get_db),
):
    """Fetch prices and holdings on-demand for ETFs that lack data.

    Discovers which of the requested ETFs are missing price history or
    holdings data, then triggers the yfinance and justETF connectors to
    fill the gaps.  Designed to be called before the correlation step so
    that newly-discovered ETFs have data to analyse.
    """
    if not body.etf_ids:
        return HydrateETFsResponse(hydrated=0, already_populated=0, errors=[])

    etf_map = await _load_etfs_by_ids(db, body.etf_ids)
    errors: list[str] = []

    # Determine which ETFs are missing prices / holdings
    price_counts = dict(
        (await db.execute(
            select(Price.etf_id, func.count())
            .where(Price.etf_id.in_(body.etf_ids))
            .group_by(Price.etf_id)
        )).all()
    )
    holdings_counts = dict(
        (await db.execute(
            select(ETFHolding.etf_id, func.count())
            .where(ETFHolding.etf_id.in_(body.etf_ids))
            .group_by(ETFHolding.etf_id)
        )).all()
    )

    needs_prices: list[str] = []
    needs_holdings: list[str] = []

    for eid, etf in etf_map.items():
        has_prices = price_counts.get(eid, 0) > 0
        has_holdings = holdings_counts.get(eid, 0) > 0
        resolvable = bool(etf.ticker_yf and "." in etf.ticker_yf)
        logger.info(
            "Hydrate check: isin=%s ticker_yf=%s prices=%d holdings=%d resolvable=%s",
            etf.isin, etf.ticker_yf, price_counts.get(eid, 0), holdings_counts.get(eid, 0), resolvable,
        )
        if not has_prices and resolvable:
            needs_prices.append(etf.ticker_yf)
        if not has_holdings:
            needs_holdings.append(etf.isin)

    logger.info(
        "Hydrate plan: needs_prices=%s needs_holdings=%s",
        needs_prices, needs_holdings,
    )

    already_populated = len(body.etf_ids) - len(set(needs_prices) | set(needs_holdings))
    if already_populated < 0:
        already_populated = 0

    from data_connectors.registry import get_registry
    registry = get_registry()

    async def _fetch_prices() -> None:
        if not needs_prices:
            logger.info("Hydrate: no ETFs need price data, skipping yfinance")
            return
        yf_conn = registry.get("yfinance")
        if not yf_conn:
            errors.append("yfinance connector not available")
            return
        logger.info("Hydrate: calling yfinance.ingest for tickers=%s period=1y", needs_prices)
        try:
            await yf_conn.ingest(db, tickers=needs_prices, period="1y")
            logger.info("Hydrate: yfinance ingest complete for %d tickers", len(needs_prices))
        except Exception as exc:
            logger.exception("Hydrate: yfinance ingest failed")
            errors.append(f"Price fetch failed: {exc}")

    async def _fetch_holdings() -> None:
        if not needs_holdings:
            logger.info("Hydrate: no ETFs need holdings data, skipping justETF")
            return
        je_conn = registry.get("justetf")
        if not je_conn:
            errors.append("justETF connector not available")
            return
        logger.info("Hydrate: calling justETF.ingest for isins=%s", needs_holdings)
        try:
            await je_conn.ingest(db, isins=needs_holdings)
            logger.info("Hydrate: justETF ingest complete for %d ISINs", len(needs_holdings))
        except Exception as exc:
            logger.exception("Hydrate: justETF ingest failed")
            errors.append(f"Holdings fetch failed: {exc}")

    await asyncio.gather(_fetch_prices(), _fetch_holdings())

    hydrated = len(needs_prices) + len(needs_holdings)
    logger.info(
        "Hydrate complete: hydrated=%d already_populated=%d errors=%d",
        hydrated, already_populated, len(errors),
    )

    return HydrateETFsResponse(
        hydrated=hydrated,
        already_populated=already_populated,
        errors=errors,
    )


@router.post("/classify-themes", response_model=ClassifyThemesResponse)
async def classify_themes_endpoint(
    body: ClassifyThemesRequest,
    user: RequireAuth,
    db: AsyncSession = Depends(get_db),
):
    """Classify selected ETFs into investment themes using LLM."""
    if not body.etf_ids:
        raise HTTPException(status_code=400, detail="At least one ETF ID is required")

    etf_map = await _load_etfs_by_ids(db, body.etf_ids, with_holdings=True)
    etfs = list(etf_map.values())

    raw_themes = await classify_themes(etfs)

    themes = [
        ThemeClassification(
            label=t["label"],
            color=t["color"],
            etf_ids=[uuid.UUID(eid) for eid in t["etf_ids"]],
            etf_isins=t["etf_isins"],
            research_agent=t.get("research_agent"),
        )
        for t in raw_themes
    ]

    return ClassifyThemesResponse(themes=themes)


@router.post("/correlations", response_model=CorrelationsResponse)
async def correlations_endpoint(
    body: CorrelationsRequest,
    user: RequireAuth,
    db: AsyncSession = Depends(get_db),
):
    """Compute dual correlation (price + holdings) for selected ETFs."""
    if len(body.etf_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two ETF IDs are required")

    etf_map = await _load_etfs_by_ids(db, body.etf_ids)

    # Compute both correlation types
    raw_price_corrs = await compute_price_correlations(db, body.etf_ids, body.lookback_days)
    raw_holdings_overlaps = await compute_holdings_overlap(db, body.etf_ids)

    # Map to response models
    price_correlations = [
        PairCorrelation(
            etf_id_a=pc["etf_id_a"],
            etf_id_b=pc["etf_id_b"],
            isin_a=etf_map[pc["etf_id_a"]].isin,
            isin_b=etf_map[pc["etf_id_b"]].isin,
            name_a=etf_map[pc["etf_id_a"]].name,
            name_b=etf_map[pc["etf_id_b"]].name,
            correlation=pc["correlation"],
        )
        for pc in raw_price_corrs
    ]

    holdings_overlaps = [
        PairOverlap(
            etf_id_a=ho["etf_id_a"],
            etf_id_b=ho["etf_id_b"],
            isin_a=etf_map[ho["etf_id_a"]].isin,
            isin_b=etf_map[ho["etf_id_b"]].isin,
            name_a=etf_map[ho["etf_id_a"]].name,
            name_b=etf_map[ho["etf_id_b"]].name,
            overlap_pct=ho["overlap_pct"],
            shared_holdings_count=ho["shared_count"],
        )
        for ho in raw_holdings_overlaps
    ]

    raw_flagged = flag_correlated_pairs(raw_price_corrs, raw_holdings_overlaps)
    flagged_pairs = [
        FlaggedPair(
            etf_id_a=f["etf_id_a"],
            etf_id_b=f["etf_id_b"],
            isin_a=etf_map[f["etf_id_a"]].isin,
            isin_b=etf_map[f["etf_id_b"]].isin,
            reason=f["reason"],
            value=f["value"],
        )
        for f in raw_flagged
    ]

    return CorrelationsResponse(
        price_correlations=price_correlations,
        holdings_overlaps=holdings_overlaps,
        flagged_pairs=flagged_pairs,
    )


@router.post("/advisor", response_model=AdvisorResponse)
async def advisor_endpoint(
    body: AdvisorRequest,
    user: RequireAuth,
    db: AsyncSession = Depends(get_db),
):
    """Get LLM-powered rankings and replacement suggestions for correlated pairs."""
    if not body.correlated_pairs:
        return AdvisorResponse(rankings=[], replacements=[])

    # Collect all ETF IDs referenced
    all_ids = set(body.all_etf_ids)
    for pair in body.correlated_pairs:
        all_ids.add(pair.etf_id_a)
        all_ids.add(pair.etf_id_b)

    etf_map = await _load_etfs_by_ids(db, list(all_ids), with_holdings=True)

    # Build correlated_pairs dicts for the advisor
    pairs_for_advisor = [
        {
            "etf_id_a": pair.etf_id_a,
            "etf_id_b": pair.etf_id_b,
            "price_correlation": pair.price_correlation,
            "holdings_overlap_pct": pair.holdings_overlap_pct,
        }
        for pair in body.correlated_pairs
    ]

    raw_result = await advise_on_correlations(pairs_for_advisor, etf_map)

    # Enrich replacement suggestions with local DB metrics
    raw_replacements = await enrich_suggestions_from_db(db, raw_result.get("replacements", []))

    # Map rankings to response models
    rankings = []
    for r in raw_result.get("rankings", []):
        ranked_etfs = [
            RankedETF(
                etf_id=uuid.UUID(re_item["etf_id"]) if isinstance(re_item["etf_id"], str) else re_item["etf_id"],
                isin=re_item.get("isin", ""),
                name=re_item.get("name", ""),
                rank=re_item.get("rank", 0),
                score_breakdown=re_item.get("score_breakdown", {}),
            )
            for re_item in r.get("ranked", [])
        ]
        pair_ids = [uuid.UUID(pid) if isinstance(pid, str) else pid for pid in r.get("pair", [])]
        rankings.append(
            PairRanking(
                pair_etf_ids=pair_ids,
                ranked_etfs=ranked_etfs,
                reasoning=r.get("reasoning", ""),
            )
        )

    # Map replacements to response models
    replacements = []
    for rep in raw_replacements:
        suggested = [
            SuggestedETF(
                isin=s.get("isin", ""),
                name=s.get("name", ""),
                ter=s.get("ter"),
                vol_1y=s.get("vol_1y"),
                ret_risk_1y=s.get("ret_risk_1y"),
                why=s.get("why", ""),
            )
            for s in rep.get("suggestions", [])
        ]
        discard_id = rep.get("discard_etf_id", "")
        replacements.append(
            ReplacementSuggestion(
                discard_etf_id=uuid.UUID(discard_id) if isinstance(discard_id, str) else discard_id,
                theme=rep.get("theme", "Other"),
                suggested_etfs=suggested,
                reasoning=rep.get("reasoning", ""),
            )
        )

    return AdvisorResponse(rankings=rankings, replacements=replacements)


@router.post("/complete", status_code=201)
async def complete_onboarding(
    body: OnboardingCompleteRequest,
    user: RequireAuth,
    db: AsyncSession = Depends(get_db),
):
    """Create portfolio with themes and positions, then mark user as onboarded.

    Deletes any existing portfolios for this user first so re-onboarding
    produces a clean state. Runs as a single DB transaction.
    """
    if not body.themes:
        raise HTTPException(status_code=400, detail="At least one theme is required")

    deleted, report_files = await _delete_user_portfolios(user.id, db)
    if deleted:
        logger.info("Deleted %d old portfolio(s) for user %s", deleted, user.id)

    # Create portfolio
    portfolio = Portfolio(
        user_id=user.id,
        name=body.portfolio_name,
        description=body.description,
    )
    db.add(portfolio)
    await db.flush()

    # Create themes and positions
    for idx, theme_input in enumerate(body.themes):
        theme = PortfolioTheme(
            portfolio_id=portfolio.id,
            name=theme_input.name,
            color=theme_input.color,
            sort_order=idx,
            research_agent=theme_input.research_agent,
        )
        db.add(theme)
        await db.flush()

        for pos_input in theme_input.positions:
            # Validate ETF exists
            etf = await db.get(ETF, pos_input.etf_id)
            if not etf:
                raise HTTPException(
                    status_code=404,
                    detail=f"ETF not found: {pos_input.etf_id}",
                )

            position = Position(
                portfolio_id=portfolio.id,
                etf_id=pos_input.etf_id,
                theme_id=theme.id,
                entry_date=pos_input.entry_date,
                entry_price=pos_input.entry_price,
                shares=pos_input.shares,
                invested_amount=pos_input.invested_amount,
                target_allocation=pos_input.target_allocation,
            )
            db.add(position)

    # Mark user as onboarded
    user.is_onboarded = True
    db.add(user)

    await db.commit()

    for fpath in report_files:
        try:
            fpath.unlink(missing_ok=True)
        except OSError:
            logger.warning("Failed to delete orphaned report file: %s", fpath)

    logger.info(
        "Onboarding complete: user=%s portfolio=%s themes=%d",
        user.id,
        portfolio.id,
        len(body.themes),
    )

    return {"portfolio_id": str(portfolio.id), "status": "onboarded"}
