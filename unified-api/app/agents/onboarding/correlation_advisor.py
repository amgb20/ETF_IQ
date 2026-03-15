"""LLM-powered correlation advisor for onboarding.

Ranks correlated ETF pairs by financial quality and suggests replacements.
Not a BaseAgent — on-demand, no reflection/memory.
"""

from __future__ import annotations

import json
import logging
import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.models.etf import ETF

logger = logging.getLogger(__name__)


def _parse_json_array(text: str) -> list[dict]:
    """Extract a JSON array from LLM response text with fallback regex."""
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

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


def _etf_metrics_block(etf: ETF) -> str:
    """Format an ETF's key financial metrics for the advisor prompt."""
    lines = [
        f"ID: {etf.id}",
        f"ISIN: {etf.isin}",
        f"Name: {etf.name}",
        f"TER: {etf.ter or 'N/A'}",
        f"AUM (EUR): {etf.aum_eur or 'N/A'}",
        f"Volatility 1Y: {etf.vol_1y or 'N/A'}",
        f"Return/Risk 1Y: {etf.ret_risk_1y or 'N/A'}",
        f"Max Drawdown 1Y: {etf.max_dd_1y or 'N/A'}",
        f"Max Drawdown 3Y: {etf.max_dd_3y or 'N/A'}",
        f"Top 10 Weight: {etf.top10_weight or 'N/A'}%",
        f"Holdings Count: {etf.holdings_count or 'N/A'}",
        f"Replication: {etf.replication or 'N/A'}",
        f"Distribution: {etf.distribution or 'N/A'}",
    ]
    if etf.investment_focus:
        lines.append(f"Focus: {etf.investment_focus}")
    if etf.fund_provider:
        lines.append(f"Provider: {etf.fund_provider}")
    return "\n".join(lines)


BEST_PICK_PROMPT = """You are a portfolio optimization advisor.

The user has selected ETFs for their portfolio, but some pairs are highly correlated
and may cause unwanted redundancy. For each correlated pair below, rank the ETFs
by overall quality as an investment.

Consider these factors (in rough order of importance):
1. Lower TER (expense ratio) is better
2. Higher return/risk ratio is better
3. Lower max drawdown is better (less downside risk)
4. Higher AUM indicates better liquidity and lower tracking error
5. Physical replication is generally preferred over synthetic
6. More holdings = better diversification within the ETF

For each pair, provide a ranking with a score breakdown and clear reasoning.

CORRELATED PAIRS:
{pairs_text}

Return ONLY a JSON array:
[
  {{
    "pair": ["{example_id_a}", "{example_id_b}"],
    "ranked": [
      {{
        "etf_id": "uuid",
        "isin": "ISIN",
        "name": "ETF Name",
        "rank": 1,
        "score_breakdown": {{
          "ter": "0.20% — low cost",
          "return_risk": "1.2 — strong risk-adjusted returns",
          "max_drawdown": "-12% — moderate",
          "aum": "5.2B — highly liquid",
          "diversification": "1500 holdings — well diversified"
        }}
      }}
    ],
    "reasoning": "ETF A is preferred because..."
  }}
]"""


REPLACEMENT_PROMPT = """You are a portfolio diversification advisor.

The user may discard some ETFs from correlated pairs. For each ETF they might remove,
suggest 1-3 alternative ETFs from the same investment theme that would be LESS correlated
with their remaining holdings. The alternatives should provide genuine diversification.

IMPORTANT: Only suggest real, existing ETFs with valid ISINs. Prefer European-listed ETFs.

ETFs that might be discarded:
{discards_text}

User's remaining ETFs (to avoid correlation with):
{remaining_text}

Return ONLY a JSON array:
[
  {{
    "discard_isin": "ISIN of ETF being replaced",
    "discard_etf_id": "uuid",
    "theme": "theme label",
    "suggestions": [
      {{
        "isin": "ISIN of alternative",
        "name": "Alternative ETF Name",
        "why": "Brief reason this is a good, less-correlated alternative"
      }}
    ],
    "reasoning": "Overall rationale for these suggestions"
  }}
]"""


async def advise_on_correlations(
    correlated_pairs: list[dict],
    etf_metadata: dict[uuid.UUID, ETF],
    theme_assignments: dict[uuid.UUID, str] | None = None,
) -> dict:
    """Rank correlated ETFs and suggest replacements.

    Args:
        correlated_pairs: List of {etf_id_a, etf_id_b, price_correlation, holdings_overlap_pct}.
        etf_metadata: Dict mapping ETF ID → ETF ORM object with full metadata.
        theme_assignments: Optional dict mapping ETF ID → theme label.

    Returns:
        {"rankings": [...], "replacements": [...]}
    """
    if not correlated_pairs:
        return {"rankings": [], "replacements": []}

    # ── Best Pick ranking ──────────────────────────────────────────
    pairs_text_parts = []
    for pair in correlated_pairs:
        id_a = pair["etf_id_a"]
        id_b = pair["etf_id_b"]
        etf_a = etf_metadata.get(id_a if isinstance(id_a, uuid.UUID) else uuid.UUID(str(id_a)))
        etf_b = etf_metadata.get(id_b if isinstance(id_b, uuid.UUID) else uuid.UUID(str(id_b)))

        if not etf_a or not etf_b:
            continue

        corr_info = []
        if pair.get("price_correlation") is not None:
            corr_info.append(f"Price Correlation: {pair['price_correlation']:.2f}")
        if pair.get("holdings_overlap_pct") is not None:
            corr_info.append(f"Holdings Overlap: {pair['holdings_overlap_pct']:.1f}%")

        pairs_text_parts.append(
            f"--- Pair ---\n"
            f"Correlation: {', '.join(corr_info)}\n\n"
            f"ETF A:\n{_etf_metrics_block(etf_a)}\n\n"
            f"ETF B:\n{_etf_metrics_block(etf_b)}"
        )

    pairs_text = "\n\n".join(pairs_text_parts)

    # Use first pair for example IDs in prompt
    example_a = str(correlated_pairs[0]["etf_id_a"])
    example_b = str(correlated_pairs[0]["etf_id_b"])

    ranking_prompt = BEST_PICK_PROMPT.format(
        pairs_text=pairs_text,
        example_id_a=example_a,
        example_id_b=example_b,
    )

    ranking_response = await llm_client.generate(ranking_prompt, config=llm_client.STANDARD_CONFIG)
    rankings = _parse_json_array(ranking_response.text)

    # ── Replacement suggestions ────────────────────────────────────
    # Identify lower-ranked ETFs from each pair as discard candidates
    discard_candidates: list[dict] = []
    all_pair_ids: set[str] = set()

    for ranking in rankings:
        ranked_list = ranking.get("ranked", [])
        if len(ranked_list) >= 2:
            # The last in the ranking is the discard candidate
            loser = ranked_list[-1]
            loser_id = loser.get("etf_id", "")
            theme = ""
            if theme_assignments:
                loser_uuid = uuid.UUID(loser_id) if isinstance(loser_id, str) else loser_id
                theme = theme_assignments.get(loser_uuid, "Other")

            discard_candidates.append({
                "etf_id": loser_id,
                "isin": loser.get("isin", ""),
                "name": loser.get("name", ""),
                "theme": theme,
            })

        for r in ranked_list:
            all_pair_ids.add(str(r.get("etf_id", "")))

    replacements: list[dict] = []
    if discard_candidates:
        # Build remaining ETFs text (all user ETFs minus discard candidates)
        discard_ids = {d["etf_id"] for d in discard_candidates}
        remaining_etfs = [
            etf for eid, etf in etf_metadata.items()
            if str(eid) not in discard_ids
        ]

        discards_text = "\n\n".join(
            f"ISIN: {d['isin']}, Name: {d['name']}, Theme: {d['theme']}"
            for d in discard_candidates
        )
        remaining_text = "\n".join(
            f"- {etf.isin}: {etf.name}"
            for etf in remaining_etfs
        )

        replacement_prompt = REPLACEMENT_PROMPT.format(
            discards_text=discards_text,
            remaining_text=remaining_text,
        )

        replacement_response = await llm_client.generate(
            replacement_prompt, config=llm_client.STANDARD_CONFIG
        )
        replacements = _parse_json_array(replacement_response.text)

    return {"rankings": rankings, "replacements": replacements}


async def enrich_suggestions_from_db(
    db: AsyncSession,
    replacements: list[dict],
) -> list[dict]:
    """Look up suggested ETF ISINs in the local DB and enrich with metrics."""
    all_isins: set[str] = set()
    for r in replacements:
        for s in r.get("suggestions", []):
            if s.get("isin"):
                all_isins.add(s["isin"])

    if not all_isins:
        return replacements

    result = await db.execute(
        select(ETF).where(ETF.isin.in_(all_isins))
    )
    etf_by_isin: dict[str, ETF] = {etf.isin: etf for etf in result.scalars().all()}

    for r in replacements:
        for s in r.get("suggestions", []):
            local_etf = etf_by_isin.get(s.get("isin", ""))
            if local_etf:
                s["ter"] = float(local_etf.ter) if local_etf.ter else None
                s["vol_1y"] = float(local_etf.vol_1y) if local_etf.vol_1y else None
                s["ret_risk_1y"] = float(local_etf.ret_risk_1y) if local_etf.ret_risk_1y else None

    return replacements
