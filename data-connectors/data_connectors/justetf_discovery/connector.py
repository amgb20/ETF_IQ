"""JustETF Discovery Connector -- search across the full justETF universe.

Uses justETF's Wicket AJAX endpoint: first GET the search page to
establish a session and extract the dynamic counter, then POST for
JSON ETF data.
"""

from __future__ import annotations

import logging
import re
from typing import Any
from urllib.parse import quote as url_quote

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from data_connectors.base import BaseConnector

logger = logging.getLogger(__name__)

JUSTETF_BASE_URL = "https://www.justetf.com/en/search.html"
JUSTETF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.justetf.com/en/search.html?search=ETFS",
}

WICKET_PANEL_PATTERN = re.compile(
    r"(\d)-1\.0-container-tabsContentContainer-tabsContentRepeater-"
    r"1-container-content-etfsTablePanel"
)


EXCHANGE_TO_YF_SUFFIX: dict[str, str] = {
    "XETRA": ".DE",
    "XETR": ".DE",
    "gettex": ".DE",
    "Frankfurt": ".F",
    "LSE": ".L",
    "London": ".L",
    "Euronext Paris": ".PA",
    "Paris": ".PA",
    "Euronext Amsterdam": ".AS",
    "Amsterdam": ".AS",
    "Borsa Italiana": ".MI",
    "Milan": ".MI",
    "SIX": ".SW",
    "Zurich": ".SW",
    "Euronext Brussels": ".BR",
    "BME": ".MC",
    "Madrid": ".MC",
    "Nasdaq Stockholm": ".ST",
    "Stockholm": ".ST",
    "Vienna": ".VI",
    "Wien": ".VI",
    "Helsinki": ".HE",
    "Oslo": ".OL",
    "Copenhagen": ".CO",
    "Lisbon": ".LS",
    "XLON": ".L",
    "XPAR": ".PA",
    "XAMS": ".AS",
    "XMIL": ".MI",
    "XSWX": ".SW",
    "XBRU": ".BR",
    "XMAD": ".MC",
    "XSTO": ".ST",
    "XWBO": ".VI",
    "XHEL": ".HE",
    "XOSL": ".OL",
    "XCSE": ".CO",
    "XLIS": ".LS",
}


def _qualify_ticker_for_yf(ticker: str | None, exchange: str | None) -> str | None:
    """Append the Yahoo Finance exchange suffix if the ticker is bare."""
    if not ticker:
        return None
    if "." in ticker or "=" in ticker:
        return ticker
    if exchange:
        suffix = EXCHANGE_TO_YF_SUFFIX.get(exchange)
        if suffix:
            return f"{ticker}{suffix}"
    return None


class JustETFDiscoveryConnector(BaseConnector):
    name = "justetf_discovery"

    @staticmethod
    def _sanitize_query(query: str) -> str:
        """Trim and strip characters that break the Wicket AJAX endpoint."""
        q = re.sub(r"[()&]", " ", query).strip()
        q = re.sub(r"\s+", " ", q)
        if len(q) > 80:
            q = q[:80].rsplit(" ", 1)[0]
        return q

    async def _wicket_search(self, client: httpx.AsyncClient, query: str) -> list[dict]:
        """Two-step Wicket AJAX search: GET page → POST for JSON data."""
        query = self._sanitize_query(query)
        if not query:
            return []

        page_resp = await client.get(
            JUSTETF_BASE_URL,
            params={"search": "ETFS"},
            headers=JUSTETF_HEADERS,
            follow_redirects=True,
        )
        page_resp.raise_for_status()

        match = WICKET_PANEL_PATTERN.search(page_resp.text)
        counter = int(match.group(1)) if match else 0

        wicket_url = (
            f"{JUSTETF_BASE_URL}?{counter}-1.0-container-tabsContentContainer-"
            f"tabsContentRepeater-1-container-content-etfsTablePanel"
            f"&search=ETFS&_wicket=1"
        )

        payload = {
            "draw": "1",
            "start": "0",
            "length": "30",
            "lang": "en",
            "country": "DE",
            "universeType": "private",
            "defaultCurrency": "EUR",
            "etfsParams": f"search=ETFS&query={url_quote(query)}",
        }

        data_resp = await client.post(
            wicket_url,
            data=payload,
            headers={
                **JUSTETF_HEADERS,
                "Accept": "application/json",
                "Wicket-Ajax": "true",
                "Wicket-Ajax-BaseURL": "en/search.html?search=ETFS",
                "X-Requested-With": "XMLHttpRequest",
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            follow_redirects=True,
        )
        data_resp.raise_for_status()

        content_type = data_resp.headers.get("content-type", "")
        if "json" not in content_type:
            logger.warning(
                "Wicket search returned non-JSON response (content-type=%s) for query=%r",
                content_type, query,
            )
            return []

        return data_resp.json().get("data", [])

    async def fetch(self, **params) -> list[dict]:
        query = params.get("query", "")
        if not query:
            return []

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                return await self._wicket_search(client, query)
        except Exception:
            logger.exception("justETF Wicket search failed for query=%r", query)
            return []

    @staticmethod
    def _parse_ter(raw_ter: Any) -> float | None:
        """Convert '0.50%' or '0.50' to decimal ratio 0.005."""
        if raw_ter is None:
            return None
        s = str(raw_ter).strip().replace("%", "").replace(",", ".")
        try:
            return float(s) / 100.0
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_aum(raw_aum: Any) -> int | None:
        """Convert fund-size strings like '415' or '1,234' to int (millions)."""
        if raw_aum is None:
            return None
        s = str(raw_aum).strip().replace(",", "").replace(".", "")
        try:
            return int(s)
        except (ValueError, TypeError):
            return None

    async def normalize(self, raw: list[dict]) -> list[dict]:
        results = []
        for item in raw:
            isin = item.get("isin") or item.get("ISIN", "")
            if not isin or len(isin) != 12:
                continue
            raw_ticker = item.get("ticker") or item.get("tickerSymbol")
            exchange = item.get("exchange") or item.get("listingExchange")
            ticker_yf = _qualify_ticker_for_yf(raw_ticker, exchange)
            results.append({
                "isin": isin,
                "name": item.get("name") or item.get("fundName", isin),
                "ticker_yf": ticker_yf,
                "currency": item.get("fundCurrency") or item.get("currency"),
                "exchange": exchange,
                "ter": self._parse_ter(
                    item.get("ter") or item.get("totalExpenseRatio")
                ),
                "aum_eur": self._parse_aum(
                    item.get("fundSize") or item.get("fundSizeEUR")
                ),
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
