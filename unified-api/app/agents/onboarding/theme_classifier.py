"""Lightweight LLM-powered theme classifier for onboarding.

Classifies a set of ETFs into short investment theme labels using Gemini.
Not a BaseAgent — no reflection/memory, just a single on-demand call.
"""

from __future__ import annotations

import json
import logging
import re
import uuid

from app.agents import llm_client
from app.models.etf import ETF

logger = logging.getLogger(__name__)

# Maps theme keywords to existing research agent names
KNOWN_RESEARCH_AGENTS: dict[str, str] = {
    "ai": "ai_stack_analyst",
    "artificial intelligence": "ai_stack_analyst",
    "technology": "ai_stack_analyst",
    "tech": "ai_stack_analyst",
    "gold": "gold_analyst",
    "precious metals": "gold_analyst",
    "silver": "gold_analyst",
    "commodities": "gold_analyst",
    "defence": "defence_analyst",
    "defense": "defence_analyst",
    "military": "defence_analyst",
    "aerospace": "defence_analyst",
}


def _etf_to_prompt_block(etf: ETF) -> str:
    """Format a single ETF's metadata for the classification prompt."""
    parts = [
        f"ID: {etf.id}",
        f"ISIN: {etf.isin}",
        f"Name: {etf.name}",
    ]
    if etf.description:
        parts.append(f"Description: {etf.description[:300]}")
    if etf.investment_focus:
        parts.append(f"Investment Focus: {etf.investment_focus}")
    if etf.index_name:
        parts.append(f"Index: {etf.index_name}")
    if etf.fund_provider:
        parts.append(f"Provider: {etf.fund_provider}")

    # Top sector allocations
    sector_allocs = [a for a in (etf.allocations or []) if a.allocation_type == "sector"]
    if sector_allocs:
        top_sectors = sorted(sector_allocs, key=lambda a: float(a.percentage or 0), reverse=True)[:5]
        sectors_str = ", ".join(f"{a.name} ({a.percentage}%)" for a in top_sectors)
        parts.append(f"Top Sectors: {sectors_str}")

    # Top geography allocations
    geo_allocs = [a for a in (etf.allocations or []) if a.allocation_type == "geography"]
    if geo_allocs:
        top_geos = sorted(geo_allocs, key=lambda a: float(a.percentage or 0), reverse=True)[:5]
        geos_str = ", ".join(f"{a.name} ({a.percentage}%)" for a in top_geos)
        parts.append(f"Top Geographies: {geos_str}")

    # Top holdings
    if etf.holdings:
        top_holdings = sorted(etf.holdings, key=lambda h: float(h.weight or 0), reverse=True)[:5]
        holdings_str = ", ".join(
            f"{h.holding_name or h.holding_ticker or h.holding_isin} ({h.weight})"
            for h in top_holdings
        )
        parts.append(f"Top Holdings: {holdings_str}")

    return "\n".join(parts)


def _match_research_agent(label: str) -> str | None:
    """Match a theme label to a known research agent via case-insensitive substring."""
    lower = label.lower().strip()
    for keyword, agent_name in KNOWN_RESEARCH_AGENTS.items():
        if keyword in lower:
            return agent_name
    return None


def _parse_json_array(text: str) -> list[dict]:
    """Extract a JSON array from LLM response text with fallback regex."""
    # Try direct parse first
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Regex fallback: find JSON array in markdown code block or raw text
    patterns = [
        r"```(?:json)?\s*(\[[\s\S]*?\])\s*```",
        r"(\[[\s\S]*\])",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            try:
                parsed = json.loads(match.group(1))
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                continue

    logger.warning("Failed to parse JSON array from LLM response")
    return []


SYSTEM_PROMPT = """You are a financial analyst classifying ETFs into investment themes.

Given the following ETFs, group them into coherent investment themes.

RULES:
- Each theme label must be 1-2 words maximum (e.g., "AI", "Gold", "Defence", "Pharma", "Clean Energy", "Semiconductors", "Bonds")
- Suggest a hex color for each theme
- Every ETF must belong to exactly one theme
- If an ETF doesn't fit any clear theme, assign it to "Other"
- Prefer well-known investment categories

Return ONLY a JSON array with no surrounding text:
[
  {
    "label": "AI",
    "color": "#6366f1",
    "etf_ids": ["uuid1", "uuid2"],
    "etf_isins": ["ISIN1", "ISIN2"]
  }
]"""


SINGLE_ETF_PROMPT = """You are a financial analyst. Given an ETF and a list of existing portfolio themes, decide where the ETF fits best.

RULES:
- If the ETF clearly fits an existing theme, return that theme's name EXACTLY as given.
- Only create a new theme if the ETF does not fit ANY existing theme.
- New theme labels must be 1-2 words maximum.
- Suggest a hex color for new themes.

Existing themes: {theme_names}

Return ONLY a JSON object (no surrounding text):
For an existing theme: {{"action": "assign", "theme_name": "<exact existing name>"}}
For a new theme: {{"action": "create", "theme_name": "<new label>", "theme_color": "#hex"}}"""


async def classify_single_etf(
    etf: ETF,
    existing_themes: list[dict],
) -> dict:
    """Classify a single ETF into an existing theme or propose a new one.

    Args:
        etf: ETF model with holdings/allocations loaded.
        existing_themes: List of dicts with at least ``name`` and ``id`` keys.

    Returns:
        ``{"action": "assign", "theme_id": <uuid>}`` or
        ``{"action": "create", "name": ..., "color": ...}``.
    """
    theme_names = ", ".join(t["name"] for t in existing_themes) if existing_themes else "(none)"
    prompt = SINGLE_ETF_PROMPT.format(theme_names=theme_names)
    prompt += f"\n\nETF to classify:\n{_etf_to_prompt_block(etf)}"

    response = await llm_client.generate(prompt, config=llm_client.STRUCTURED_OUTPUT_CONFIG)

    try:
        result = json.loads(response.text.strip().strip("`").strip())
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", response.text)
        if match:
            try:
                result = json.loads(match.group(0))
            except json.JSONDecodeError:
                result = {}
        else:
            result = {}

    action = result.get("action", "")
    theme_name = result.get("theme_name", "")

    if action == "assign" and theme_name:
        for t in existing_themes:
            if t["name"].lower() == theme_name.lower():
                return {"action": "assign", "theme_id": t["id"]}
        # Name didn't match exactly — fall through to create
        logger.warning("LLM returned assign but theme '%s' not found; creating new.", theme_name)

    return {
        "action": "create",
        "name": theme_name or "Other",
        "color": result.get("theme_color", "#71717a"),
    }


async def classify_themes(etfs: list[ETF]) -> list[dict]:
    """Classify ETFs into investment themes using Gemini.

    Args:
        etfs: List of SQLAlchemy ETF objects with holdings and allocations loaded.

    Returns:
        List of dicts with keys: label, color, etf_ids, etf_isins, research_agent.
    """
    if not etfs:
        return []

    etf_blocks = "\n\n".join(
        f"--- ETF {i + 1} ---\n{_etf_to_prompt_block(etf)}"
        for i, etf in enumerate(etfs)
    )

    prompt = f"{SYSTEM_PROMPT}\n\nETFs to classify:\n\n{etf_blocks}"

    response = await llm_client.generate(prompt, config=llm_client.STRUCTURED_OUTPUT_CONFIG)
    raw_themes = _parse_json_array(response.text)

    if not raw_themes:
        # Fallback: put everything in "Other"
        logger.warning("Theme classification returned no results, falling back to 'Other'")
        return [{
            "label": "Other",
            "color": "#71717a",
            "etf_ids": [str(etf.id) for etf in etfs],
            "etf_isins": [etf.isin for etf in etfs],
            "research_agent": None,
        }]

    # Validate and enrich with research agent mapping
    etf_id_set = {str(etf.id) for etf in etfs}
    results: list[dict] = []

    for theme in raw_themes:
        label = theme.get("label", "Other")
        color = theme.get("color", "#71717a")
        raw_ids = theme.get("etf_ids", [])
        raw_isins = theme.get("etf_isins", [])

        # Validate ETF IDs belong to the input set
        valid_ids = [eid for eid in raw_ids if eid in etf_id_set]

        results.append({
            "label": label,
            "color": color,
            "etf_ids": valid_ids,
            "etf_isins": raw_isins,
            "research_agent": _match_research_agent(label),
        })

    return results
