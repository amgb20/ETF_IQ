"""
Debug script — run inside the unified-api container to inspect exactly
what justetf-scraping returns and what the HTML scraper finds.

Usage (from project root):
    docker compose run --rm --no-deps --entrypoint="" unified-api \
        python unified-api/scripts/debug_justetf.py IE00B3CNHG25

Or multiple ISINs:
    python unified-api/scripts/debug_justetf.py IE00B3CNHG25 IE00BMC38736
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
import html as html_mod

import httpx
import justetf_scraping

ISIN = sys.argv[1] if len(sys.argv) > 1 else "IE00B3CNHG25"
ISINS = sys.argv[1:] or [ISIN]

JUSTETF_PROFILE_URL = "https://www.justetf.com/en/etf-profile.html"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
}

SEP = "-" * 70


def section(title: str) -> None:
    print(f"\n{SEP}\n  {title}\n{SEP}")


# ---------------------------------------------------------------------------
# 1. Library — get_etf_overview
# ---------------------------------------------------------------------------

def debug_library(isin: str) -> dict:
    section(f"[1] justetf_scraping.get_etf_overview({isin})")
    try:
        overview = justetf_scraping.get_etf_overview(isin)
        print(json.dumps(overview, indent=2, default=str))
        return overview
    except Exception as exc:
        print(f"  ERROR: {exc}")
        return {}


# ---------------------------------------------------------------------------
# 2. Library — load_chart (shows what price/return data is available)
# ---------------------------------------------------------------------------

def debug_chart(isin: str) -> None:
    section(f"[2] justetf_scraping.load_chart({isin})  — first 5 rows")
    try:
        chart = justetf_scraping.load_chart(isin)
        if hasattr(chart, "head"):
            print(chart.head().to_string())
        else:
            print(repr(chart)[:500])
    except Exception as exc:
        print(f"  ERROR: {exc}")


# ---------------------------------------------------------------------------
# 3. Raw HTML — fetch and show ALL data-testid values found on the page
# ---------------------------------------------------------------------------

async def debug_html(isin: str) -> str:
    section(f"[3] Raw justETF profile page — all data-testid attributes ({isin})")
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(
            JUSTETF_PROFILE_URL,
            params={"isin": isin},
            headers=HEADERS,
        )
        resp.raise_for_status()
        html = resp.text

    # Find every data-testid attribute and the text content of its element
    pattern = re.compile(
        r'data-testid="([^"]+)"[^>]*>([^<]{1,200})<',
        re.IGNORECASE,
    )
    matches = pattern.findall(html)

    if not matches:
        print("  No data-testid attributes found — page may have changed structure or blocked the request.")
    else:
        for testid, content in matches:
            content = html_mod.unescape(content.strip())
            if content:  # skip empty elements
                print(f"  {testid:<60}  →  {content}")

    return html


# ---------------------------------------------------------------------------
# 4. Our scraper — show exactly what _scrape_profile_metadata extracts
# ---------------------------------------------------------------------------

async def debug_our_scraper(isin: str, html: str) -> None:
    section(f"[4] Our testid_map extraction result ({isin})")

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
            print(f"  ✓  {key:<30}  →  {val!r}")
        else:
            print(f"  ✗  {key:<30}  →  NOT FOUND (testid pattern: *_value_{testid})")

    # Show what holdings testids look like
    section(f"[5] Holdings testid matches ({isin})")
    names = re.findall(
        r'data-testid="tl_etf-holdings_top-holdings_link_name"[^>]*title="([^"]+)"', html
    )
    pcts = re.findall(
        r'data-testid="tl_etf-holdings_top-holdings_value_percentage"[^>]*>([^<]+)<', html
    )
    if names:
        for i, name in enumerate(names):
            pct = pcts[i] if i < len(pcts) else "?"
            print(f"  {name}  →  {pct}")
    else:
        print("  No holdings found via tl_etf-holdings_top-holdings_link_name")
        # Show nearby testids to help find the right pattern
        nearby = re.findall(r'data-testid="([^"]*holding[^"]*)"', html)
        if nearby:
            print(f"\n  Testids containing 'holding' on this page:")
            for t in sorted(set(nearby)):
                print(f"    {t}")

    section(f"[6] Missing fields — testids containing key terms ({isin})")
    for term in ["fund.size", "aum", "size", "description", "index.desc",
                 "holdings.count", "number", "drawdown", "return", "risk"]:
        hits = re.findall(
            rf'data-testid="([^"]*{re.escape(term)}[^"]*)"', html, re.IGNORECASE
        )
        if hits:
            print(f"  '{term}' → {sorted(set(hits))}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main() -> None:
    for isin in ISINS:
        debug_library(isin)
        debug_chart(isin)
        html = await debug_html(isin)
        await debug_our_scraper(isin, html)
        print(f"\n{'=' * 70}\n  Done for {isin}\n{'=' * 70}\n")


if __name__ == "__main__":
    asyncio.run(main())
