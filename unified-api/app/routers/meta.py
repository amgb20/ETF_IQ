"""Lightweight metadata endpoints (OG image, link previews)."""

from __future__ import annotations

import logging
import re
import time as _time

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/meta", tags=["meta"])

# Simple TTL cache — {url: (timestamp, result)}
_og_cache: dict[str, tuple[float, dict]] = {}
_OG_CACHE_TTL = 3600  # 1 hour — OG data rarely changes


class OGResponse(BaseModel):
    url: str
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site_name: str | None = None
    favicon: str | None = None


_OG_RE = re.compile(
    r'<meta\s+(?:[^>]*?\s+)?'
    r'(?:property|name)\s*=\s*["\']og:(\w+)["\']'
    r'\s+content\s*=\s*["\']([^"\']*)["\']',
    re.IGNORECASE,
)

_OG_RE_REVERSED = re.compile(
    r'<meta\s+(?:[^>]*?\s+)?'
    r'content\s*=\s*["\']([^"\']*)["\']'
    r'\s+(?:property|name)\s*=\s*["\']og:(\w+)["\']',
    re.IGNORECASE,
)

_FAVICON_RE = re.compile(
    r'<link\s+[^>]*?rel\s*=\s*["\'](?:shortcut\s+)?icon["\'][^>]*?href\s*=\s*["\']([^"\']+)["\']',
    re.IGNORECASE,
)


def _parse_og(html: str, base_url: str) -> dict:
    """Extract Open Graph tags + favicon from raw HTML."""
    og: dict[str, str] = {}

    for match in _OG_RE.finditer(html[:30_000]):  # only scan head area
        prop, content = match.group(1).lower(), match.group(2)
        if prop not in og:
            og[prop] = content

    for match in _OG_RE_REVERSED.finditer(html[:30_000]):
        content, prop = match.group(1), match.group(2).lower()
        if prop not in og:
            og[prop] = content

    favicon = None
    fav_match = _FAVICON_RE.search(html[:30_000])
    if fav_match:
        fav_href = fav_match.group(1)
        if fav_href.startswith("//"):
            favicon = "https:" + fav_href
        elif fav_href.startswith("/"):
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            favicon = f"{parsed.scheme}://{parsed.netloc}{fav_href}"
        elif fav_href.startswith("http"):
            favicon = fav_href

    return {
        "title": og.get("title"),
        "description": og.get("description"),
        "image": og.get("image"),
        "site_name": og.get("site_name"),
        "favicon": favicon,
    }


@router.get("/og", response_model=OGResponse)
async def get_og_metadata(
    url: str = Query(..., description="URL to fetch OG metadata from"),
):
    """Fetch Open Graph metadata (title, description, image) for a URL."""
    if not url.startswith("http"):
        raise HTTPException(status_code=400, detail="URL must start with http(s)")

    # Block internal/private URLs
    from urllib.parse import urlparse
    hostname = urlparse(url).hostname or ""
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0") or hostname.startswith("192.168.") or hostname.startswith("10."):
        raise HTTPException(status_code=400, detail="Cannot fetch internal URLs")

    # Check cache
    entry = _og_cache.get(url)
    if entry:
        ts, cached = entry
        if _time.time() - ts < _OG_CACHE_TTL:
            return OGResponse(url=url, **cached)
        else:
            del _og_cache[url]

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0 (compatible; PortfolioIQ/1.0; +https://portfolioiq.app)"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.warning("OG fetch HTTP error for %s: %s", url, exc.response.status_code)
        raise HTTPException(status_code=502, detail=f"Upstream returned {exc.response.status_code}")
    except Exception as exc:
        logger.warning("OG fetch failed for %s: %s", url, exc)
        raise HTTPException(status_code=502, detail="Failed to fetch URL")

    result = _parse_og(resp.text, url)

    # Fall back to Google favicon service if no favicon found in HTML
    if not result["favicon"]:
        result["favicon"] = f"https://www.google.com/s2/favicons?domain={hostname}&sz=32"

    _og_cache[url] = (_time.time(), result)
    return OGResponse(url=url, **result)
