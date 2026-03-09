from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any

import justetf_scraping
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from data_connectors.base import BaseConnector

logger = logging.getLogger(__name__)

DEFAULT_ISINS = [
    "IE00BGV5VN51",  # XAIX
    "IE00BMC38736",  # SMGB
    "IE00BMH5Y327",  # VPNG
    "IE000NDWFGA5",  # URNG
    "IE00B3CNHG25",  # AUCP
    "IE00B4ND3602",  # SGLN
    "IE000JCW3DZ3",  # ARMG
]


class JustETFConnector(BaseConnector):
    name = "justetf"

    async def fetch(self, *, isins: list[str] | None = None, **_: Any) -> list[dict]:
        """Fetch overview + chart data for each ISIN from justetf-scraping."""
        isins = isins or DEFAULT_ISINS
        results: list[dict] = []
        for isin in isins:
            try:
                overview = justetf_scraping.get_etf_overview(isin)
                chart = justetf_scraping.load_chart(isin)
                results.append({"isin": isin, "overview": overview, "chart": chart})
            except Exception:
                logger.exception("Failed to fetch justETF data for %s", isin)
        return results

    async def normalize(self, raw: list[dict]) -> list[dict]:
        """Normalize all raw fetches into a flat list of update dicts.

        Each dict has a 'type' key: 'etf_update', 'holding', or 'allocation'.
        """
        rows: list[dict] = []
        for item in raw:
            isin = item["isin"]
            overview = item.get("overview") or {}

            rows.append(self._normalize_overview(isin, overview))

            for h in self._normalize_holdings(isin, overview):
                rows.append(h)

            for a in self._normalize_allocations(isin, overview):
                rows.append(a)
        return rows

    async def ingest(self, session: AsyncSession, *, isins: list[str] | None = None, **_: Any) -> None:
        raw = await self.fetch(isins=isins)
        rows = await self.normalize(raw)
        now = datetime.utcnow()

        for row in rows:
            rtype = row["type"]
            if rtype == "etf_update":
                await self._upsert_etf(session, row, now)
            elif rtype == "holding":
                await self._upsert_holding(session, row, now)
            elif rtype == "allocation":
                await self._upsert_allocation(session, row, now)

        await session.commit()
        logger.info("justetf ingest: processed %d rows", len(rows))

    # ------------------------------------------------------------------
    # Overlap computation
    # ------------------------------------------------------------------

    @staticmethod
    async def compute_overlap(session: AsyncSession) -> dict[str, dict[str, list[str]]]:
        """Cross-reference holding_isin across all ETFs to detect overlap.

        Returns: { "ETF_A_isin": { "ETF_B_isin": ["shared_holding_isin", ...] } }
        """
        result = await session.execute(
            text(
                """
                SELECT e.isin AS etf_isin, h.holding_isin
                FROM etf_holdings h
                JOIN etfs e ON e.id = h.etf_id
                WHERE h.holding_isin IS NOT NULL
                """
            )
        )
        etf_holdings: dict[str, set[str]] = defaultdict(set)
        for row in result:
            etf_holdings[row.etf_isin].add(row.holding_isin)

        isins = sorted(etf_holdings.keys())
        overlap: dict[str, dict[str, list[str]]] = {}
        for i, a in enumerate(isins):
            overlap[a] = {}
            for b in isins[i + 1 :]:
                shared = etf_holdings[a] & etf_holdings[b]
                if shared:
                    overlap[a][b] = sorted(shared)
        return overlap

    # ------------------------------------------------------------------
    # Comparison chart
    # ------------------------------------------------------------------

    @staticmethod
    async def fetch_comparison_chart(isins: list[str] | None = None) -> dict:
        """Fetch rebased comparison chart for all portfolio ETFs."""
        isins = isins or DEFAULT_ISINS
        charts = {}
        for isin in isins:
            try:
                charts[isin] = justetf_scraping.load_chart(isin)
            except Exception:
                logger.exception("Failed to load chart for %s", isin)
        if len(charts) < 2:
            return {}
        comparison = justetf_scraping.compare_charts(charts)
        return comparison.to_dict() if hasattr(comparison, "to_dict") else {}

    # ------------------------------------------------------------------
    # Normalization helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _normalize_overview(isin: str, overview: dict) -> dict:
        return {
            "type": "etf_update",
            "isin": isin,
            "ter": _safe_decimal(overview.get("ter")),
            "aum_eur": _safe_int(overview.get("fund_size_eur") or overview.get("fund_size")),
            "description": overview.get("description"),
            "domicile": overview.get("domicile"),
            "replication": overview.get("replication"),
            "distribution": overview.get("distribution_policy") or overview.get("distribution"),
            "holdings_count": _safe_int(overview.get("number_of_holdings")),
            "inception_date": overview.get("inception_date"),
        }

    @staticmethod
    def _normalize_holdings(isin: str, overview: dict) -> list[dict]:
        holdings = overview.get("top_holdings") or overview.get("holdings") or []
        rows: list[dict] = []
        for h in holdings:
            rows.append(
                {
                    "type": "holding",
                    "etf_isin": isin,
                    "holding_name": h.get("name"),
                    "holding_isin": h.get("isin"),
                    "holding_ticker": h.get("ticker"),
                    "weight": _safe_decimal(h.get("weight") or h.get("share")),
                }
            )
        return rows

    @staticmethod
    def _normalize_allocations(isin: str, overview: dict) -> list[dict]:
        rows: list[dict] = []
        for alloc_type, key in [("country", "countries"), ("sector", "sectors")]:
            items = overview.get(key) or []
            for item in items:
                name = item.get("name") or item.get("country") or item.get("sector") or ""
                rows.append(
                    {
                        "type": "allocation",
                        "etf_isin": isin,
                        "allocation_type": alloc_type,
                        "name": name,
                        "percentage": _safe_decimal(item.get("share") or item.get("percentage")),
                    }
                )
        return rows

    # ------------------------------------------------------------------
    # DB upsert helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _upsert_etf(session: AsyncSession, row: dict, now: datetime) -> None:
        await session.execute(
            text(
                """
                UPDATE etfs SET
                    ter = COALESCE(:ter, ter),
                    aum_eur = COALESCE(:aum_eur, aum_eur),
                    description = COALESCE(:description, description),
                    domicile = COALESCE(:domicile, domicile),
                    replication = COALESCE(:replication, replication),
                    distribution = COALESCE(:distribution, distribution),
                    holdings_count = COALESCE(:holdings_count, holdings_count),
                    inception_date = COALESCE(:inception_date, inception_date),
                    last_scraped_at = :now
                WHERE isin = :isin
                """
            ),
            {**{k: v for k, v in row.items() if k != "type"}, "now": now},
        )

    @staticmethod
    async def _upsert_holding(session: AsyncSession, row: dict, now: datetime) -> None:
        etf_id_row = await session.execute(text("SELECT id FROM etfs WHERE isin = :isin"), {"isin": row["etf_isin"]})
        etf_id = etf_id_row.scalar_one_or_none()
        if not etf_id:
            return
        await session.execute(
            text(
                """
                INSERT INTO etf_holdings (etf_id, holding_name, holding_isin, holding_ticker, weight, refreshed_at)
                VALUES (:etf_id, :name, :h_isin, :ticker, :weight, :now)
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "etf_id": str(etf_id),
                "name": row["holding_name"],
                "h_isin": row["holding_isin"],
                "ticker": row["holding_ticker"],
                "weight": row["weight"],
                "now": now,
            },
        )

    @staticmethod
    async def _upsert_allocation(session: AsyncSession, row: dict, now: datetime) -> None:
        etf_id_row = await session.execute(text("SELECT id FROM etfs WHERE isin = :isin"), {"isin": row["etf_isin"]})
        etf_id = etf_id_row.scalar_one_or_none()
        if not etf_id:
            return
        await session.execute(
            text(
                """
                INSERT INTO etf_allocations (etf_id, allocation_type, name, percentage, refreshed_at)
                VALUES (:etf_id, :allocation_type, :name, :percentage, :now)
                ON CONFLICT DO NOTHING
                """
            ),
            {
                "etf_id": str(etf_id),
                "allocation_type": row["allocation_type"],
                "name": row["name"],
                "percentage": row["percentage"],
                "now": now,
            },
        )


def _safe_decimal(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_int(val: Any) -> int | None:
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None
