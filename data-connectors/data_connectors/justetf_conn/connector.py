from __future__ import annotations

import html as html_mod
import logging
import re
from collections import defaultdict
from datetime import datetime
from typing import Any

import httpx
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

JUSTETF_PROFILE_URL = "https://www.justetf.com/en/etf-profile.html"
JUSTETF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}


class JustETFConnector(BaseConnector):
    name = "justetf"

    async def fetch(self, *, isins: list[str] | None = None, **_: Any) -> list[dict]:
        """Fetch overview + chart data for each ISIN from justetf-scraping."""
        isins = isins or DEFAULT_ISINS
        results: list[dict] = []
        for isin in isins:
            overview: dict = {}
            chart = None
            try:
                overview = justetf_scraping.get_etf_overview(isin)
            except Exception as e:
                logger.warning("get_etf_overview failed for %s (%s), continuing with profile scrape", isin, e)
            try:
                chart = justetf_scraping.load_chart(isin)
            except Exception:
                logger.warning("load_chart failed for %s", isin)
            try:
                profile_meta = await self._scrape_profile_metadata(isin)
            except Exception:
                logger.warning("profile scrape failed for %s", isin)
                profile_meta = {}
            results.append({
                "isin": isin,
                "overview": overview,
                "chart": chart,
                "profile_meta": profile_meta,
            })
        return results

    async def normalize(self, raw: list[dict]) -> list[dict]:
        rows: list[dict] = []
        for item in raw:
            isin = item["isin"]
            overview = item.get("overview") or {}
            profile_meta = item.get("profile_meta") or {}

            rows.append(self._normalize_overview(isin, overview, profile_meta))

            for h in self._normalize_holdings(isin, overview, profile_meta):
                rows.append(h)

            for a in self._normalize_allocations(isin, overview, profile_meta):
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
    # Profile page scraper for fields not in get_etf_overview
    # ------------------------------------------------------------------

    @staticmethod
    async def _scrape_profile_metadata(isin: str) -> dict:
        """Scrape the justETF profile page via data-testid attributes."""
        meta: dict[str, Any] = {}
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(
                    JUSTETF_PROFILE_URL,
                    params={"isin": isin},
                    headers=JUSTETF_HEADERS,
                )
                resp.raise_for_status()
                html = resp.text

            testid_map = {
                "fund-provider": "fund_provider",
                "legal-structure": "legal_structure",
                "strategy-risk": "strategy_risk",
                "sustainable": "sustainability",
                "fund-currency": "fund_currency",
                "currency-hedge": "currency_risk",
                "distribution-interval": "distribution_frequency",
                "investment-focus": "investment_focus",
                "index-name": "index_name",
                "ter": "ter_raw",
                "replication": "replication",
                "launch-date": "inception_date_raw",
                "distribution-policy": "distribution",
                "domicile-country": "domicile",
                "volatility": "volatility_raw",
            }

            for testid, key in testid_map.items():
                pattern = re.compile(
                    rf'data-testid="[^"]*_value_{re.escape(testid)}"[^>]*>([^<]+)<',
                    re.IGNORECASE,
                )
                match = pattern.search(html)
                if match:
                    val = html_mod.unescape(match.group(1).strip())
                    if val and val != "-":
                        meta[key] = val

            if "ter_raw" in meta:
                m = re.search(r'([\d.]+)%', meta.pop("ter_raw"))
                if m:
                    meta["ter"] = float(m.group(1)) / 100

            if "inception_date_raw" in meta:
                raw = meta.pop("inception_date_raw")
                try:
                    meta["inception_date"] = datetime.strptime(raw, "%d %B %Y").date()
                except ValueError:
                    pass

            if "volatility_raw" in meta:
                m = re.search(r'([\d.]+)%', meta.pop("volatility_raw"))
                if m:
                    meta["vol_1y"] = float(m.group(1))

            # holdings_count — "etf-profile-header_holdings-value" → "36"
            m = re.search(
                r'data-testid="etf-profile-header_holdings-value"[^>]*>([^<]+)<',
                html, re.IGNORECASE,
            )
            if m:
                val = m.group(1).strip()
                if val and val != "-":
                    meta["holdings_count"] = _safe_int(val)

            # aum_eur — "etf-profile-header_fund-size-value" → "€123m" (when present)
            m = re.search(
                r'data-testid="etf-profile-header_fund-size-value"[^>]*>([^<]+)<',
                html, re.IGNORECASE,
            )
            if m:
                raw_size = html_mod.unescape(m.group(1).strip())
                # formats seen: "€123m", "€1.2b", "123,456,789"
                num = re.sub(r'[€$,\s]', '', raw_size.lower())
                multiplier = 1
                if num.endswith('b'):
                    multiplier = 1_000_000_000
                    num = num[:-1]
                elif num.endswith('m'):
                    multiplier = 1_000_000
                    num = num[:-1]
                aum = _safe_decimal(num)
                if aum is not None:
                    meta["aum_eur"] = int(aum * multiplier)

            meta["_holdings"] = _extract_top_holdings(html)
            meta["_countries"] = _extract_allocation_block(html, "countries")
            meta["_sectors"] = _extract_allocation_block(html, "sectors")

        except Exception:
            logger.warning("Failed to scrape profile metadata for %s", isin, exc_info=True)
        return meta

    # ------------------------------------------------------------------
    # Overlap computation
    # ------------------------------------------------------------------

    @staticmethod
    async def compute_overlap(session: AsyncSession) -> dict[str, dict[str, list[str]]]:
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
    def _normalize_overview(isin: str, overview: dict, profile_meta: dict | None = None) -> dict:
        profile_meta = profile_meta or {}

        holdings = overview.get("top_holdings") or overview.get("holdings") or []
        top10_weights = [_safe_decimal(h.get("weight") or h.get("share") or h.get("percentage")) for h in holdings[:10]]
        if not top10_weights:
            profile_holdings = profile_meta.get("_holdings") or []
            top10_weights = [h.get("weight") for h in profile_holdings[:10] if h.get("weight") is not None]
        top10_sum = sum(w for w in top10_weights if w is not None) or None
        if top10_sum and top10_sum > 1:
            top10_sum = top10_sum / 100

        return {
            "type": "etf_update",
            "isin": isin,
            "ter": _safe_decimal(overview.get("ter")) or profile_meta.get("ter"),
            "aum_eur": _safe_int(overview.get("fund_size_eur") or overview.get("fund_size")) or profile_meta.get("aum_eur"),
            "description": overview.get("description"),
            "domicile": overview.get("fund_domicile") or overview.get("domicile") or profile_meta.get("domicile"),
            "replication": overview.get("replication") or profile_meta.get("replication"),
            "distribution": overview.get("distribution_policy") or overview.get("distribution") or profile_meta.get("distribution"),
            "holdings_count": _safe_int(overview.get("number_of_holdings")) or profile_meta.get("holdings_count"),
            "inception_date": overview.get("inception_date") or profile_meta.get("inception_date"),
            "index_name": overview.get("index") or profile_meta.get("index_name"),
            "fund_currency": overview.get("fund_currency") or profile_meta.get("fund_currency"),
            "top10_weight": top10_sum,
            "vol_1y": profile_meta.get("vol_1y"),
            "index_description": profile_meta.get("index_description"),
            "investment_focus": profile_meta.get("investment_focus"),
            "legal_structure": profile_meta.get("legal_structure"),
            "strategy_risk": profile_meta.get("strategy_risk"),
            "sustainability": profile_meta.get("sustainability"),
            "currency_risk": profile_meta.get("currency_risk"),
            "distribution_frequency": profile_meta.get("distribution_frequency"),
            "fund_provider": profile_meta.get("fund_provider"),
        }

    @staticmethod
    def _normalize_holdings(isin: str, overview: dict, profile_meta: dict | None = None) -> list[dict]:
        holdings = overview.get("top_holdings") or overview.get("holdings") or []
        rows: list[dict] = []
        if holdings:
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
        elif profile_meta:
            for h in profile_meta.get("_holdings") or []:
                rows.append(
                    {
                        "type": "holding",
                        "etf_isin": isin,
                        "holding_name": h.get("name"),
                        "holding_isin": None,
                        "holding_ticker": None,
                        "weight": h.get("weight"),
                    }
                )
        return rows

    @staticmethod
    def _normalize_allocations(isin: str, overview: dict, profile_meta: dict | None = None) -> list[dict]:
        rows: list[dict] = []
        for alloc_type, key in [("country", "countries"), ("sector", "sectors")]:
            items = overview.get(key) or []
            if not items and profile_meta:
                items = profile_meta.get(f"_{key}") or []
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
        params = {k: v for k, v in row.items() if k != "type" and not k.startswith("_")}
        params["now"] = now
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
                    index_name = COALESCE(:index_name, index_name),
                    index_description = COALESCE(:index_description, index_description),
                    investment_focus = COALESCE(:investment_focus, investment_focus),
                    legal_structure = COALESCE(:legal_structure, legal_structure),
                    strategy_risk = COALESCE(:strategy_risk, strategy_risk),
                    sustainability = COALESCE(:sustainability, sustainability),
                    fund_currency = COALESCE(:fund_currency, fund_currency),
                    currency_risk = COALESCE(:currency_risk, currency_risk),
                    distribution_frequency = COALESCE(:distribution_frequency, distribution_frequency),
                    fund_provider = COALESCE(:fund_provider, fund_provider),
                    top10_weight = COALESCE(:top10_weight, top10_weight),
                    vol_1y = COALESCE(:vol_1y, vol_1y),
                    last_scraped_at = :now
                WHERE isin = :isin
                """
            ),
            params,
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


def _extract_top_holdings(html: str) -> list[dict]:
    """Extract top-10 holdings from profile page HTML using data-testid markers."""
    names = re.findall(
        r'data-testid="tl_etf-holdings_top-holdings_link_name"[^>]*title="([^"]+)"', html
    )
    pcts = re.findall(
        r'data-testid="tl_etf-holdings_top-holdings_value_percentage"[^>]*>([^<]+)<', html
    )
    holdings = []
    for i, name in enumerate(names):
        weight = _safe_decimal(pcts[i].replace("%", "").strip()) if i < len(pcts) else None
        if weight is not None:
            weight /= 100
        holdings.append({"name": html_mod.unescape(name.strip()), "weight": weight})
    return holdings


def _extract_allocation_block(html: str, block_type: str) -> list[dict]:
    """Extract country or sector allocations from profile page HTML."""
    names = re.findall(
        rf'data-testid="tl_etf-holdings_{re.escape(block_type)}_value_name"[^>]*>([^<]+)<', html
    )
    pcts = re.findall(
        rf'data-testid="tl_etf-holdings_{re.escape(block_type)}_value_percentage"[^>]*>([^<]+)<', html
    )
    items = []
    for i, name in enumerate(names):
        pct = _safe_decimal(pcts[i].replace("%", "").strip()) if i < len(pcts) else None
        items.append({"name": html_mod.unescape(name.strip()), "percentage": pct})
    return items


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
