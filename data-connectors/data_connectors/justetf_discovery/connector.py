"""JustETF Discovery Connector -- search across the full justETF universe.

Uses justETF's internal Wicket AJAX search endpoint to discover ETFs
by name, ISIN, asset class, or other filters.
"""

from __future__ import annotations

import logging
import re
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from data_connectors.base import BaseConnector

logger = logging.getLogger(__name__)

JUSTETF_SEARCH_URL = "https://www.justetf.com/api/etfs/search"
JUSTETF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
    "Referer": "https://www.justetf.com/en/find-etf.html",
}


class JustETFDiscoveryConnector(BaseConnector):
    name = "justetf_discovery"

    async def fetch(self, **params) -> list[dict]:
        query = params.get("query", "")
        asset_class = params.get("asset_class")
        country = params.get("country")

        if not query and not asset_class:
            return []

        search_params: dict[str, Any] = {
            "search": query,
            "groupField": "none",
            "sortField": "fundSize",
            "sortOrder": "desc",
            "from": 0,
            "size": 30,
            "locale": "en",
        }

        if asset_class:
            search_params["assetClass"] = asset_class
        if country:
            search_params["country"] = country

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    JUSTETF_SEARCH_URL,
                    params=search_params,
                    headers=JUSTETF_HEADERS,
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError:
            logger.warning("justETF search returned non-200; falling back to scrape-based search")
            return await self._fallback_search(query)
        except Exception:
            logger.exception("justETF search failed")
            return await self._fallback_search(query)

        etfs = data.get("data", data.get("etfs", []))
        if isinstance(etfs, list):
            return etfs
        return []

    async def _fallback_search(self, query: str) -> list[dict]:
        """Fallback: scrape the justETF search results page."""
        url = f"https://www.justetf.com/en/find-etf.html?query={query}"
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(url, headers=JUSTETF_HEADERS)
                resp.raise_for_status()
                text = resp.text

            results = []
            isin_pattern = re.compile(r"([A-Z]{2}[A-Z0-9]{10})")
            isins_found = set(isin_pattern.findall(text))
            for isin in list(isins_found)[:20]:
                results.append({"isin": isin, "name": isin})
            return results
        except Exception:
            logger.exception("Fallback justETF search failed")
            return []

    async def normalize(self, raw: list[dict]) -> list[dict]:
        results = []
        for item in raw:
            isin = item.get("isin") or item.get("ISIN", "")
            if not isin or len(isin) != 12:
                continue
            results.append({
                "isin": isin,
                "name": item.get("name") or item.get("fundName", isin),
                "ticker_yf": item.get("ticker") or item.get("tickerSymbol"),
                "currency": item.get("fundCurrency") or item.get("currency"),
                "exchange": item.get("exchange") or item.get("listingExchange"),
                "ter": item.get("ter") or item.get("totalExpenseRatio"),
                "aum_eur": item.get("fundSize") or item.get("fundSizeEUR"),
                "domicile": item.get("domicile") or item.get("fundDomicile"),
                "asset_class": item.get("assetClass"),
            })
        return results

    async def ingest(self, session: AsyncSession, **params) -> None:
        raw = await self.fetch(**params)
        normalized = await self.normalize(raw)

        from app.models.etf import ETF

        for item in normalized:
            stmt = pg_insert(ETF.__table__).values(
                isin=item["isin"],
                name=item["name"],
                ticker_yf=item.get("ticker_yf"),
                currency=item.get("currency"),
                exchange=item.get("exchange"),
                ter=item.get("ter"),
                aum_eur=item.get("aum_eur"),
                domicile=item.get("domicile"),
            ).on_conflict_do_nothing(index_elements=["isin"])
            await session.execute(stmt)

        await session.commit()
        logger.info("JustETF Discovery: ingested %d ETFs", len(normalized))
