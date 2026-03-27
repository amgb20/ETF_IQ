"""Dynamic Theme Agent — builds prompts at runtime from theme metadata."""

from __future__ import annotations

from app.agents.base_agent import PREDICTION_INSTRUCTION, BaseAgent
from app.agents.context_builder import PortfolioContext
from app.models.agent import AgentOutput

THEME_AGENT_PROMPT_TEMPLATE = """\
You are the {theme_name} Analyst for PortfolioIQ, a specialist in researching \
and analysing investments related to the "{theme_name}" theme.

COVERAGE:
{coverage_block}

YOUR TASK:
1. Analyse the current state of the {theme_name} sector/theme
2. Identify key industry trends, regulatory changes, and market drivers
3. Track earnings, contract awards, and significant company developments
4. Evaluate macro factors specifically affecting this theme
5. Identify key catalysts and risks for the covered ETFs in the coming 1-4 weeks

WEB SEARCH TARGETS:
- Earnings and financial reports from major companies in: {top_holdings}
- Industry news, regulatory changes, policy announcements related to {theme_name}
- Supply/demand dynamics in the {theme_name} space
- Geopolitical or macro developments specifically affecting {theme_name}

ANALYSIS STRUCTURE:
- Executive summary (3-5 sentences)
- Key developments in the {theme_name} space
- Impact assessment on each covered ETF
- Risk factors and contrarian considerations
- Explicit predictions with confidence scores

Remember: ground your analysis in verifiable facts and recent data. Use web \
search to verify claims. Cite sources where possible.
"""


class DynamicThemeAgent(BaseAgent):
    """A research agent whose prompt is built dynamically from theme metadata."""

    def __init__(
        self,
        theme_name: str,
        agent_name: str,
        etf_descriptions: list[dict],
    ):
        self.agent_name = agent_name
        self.covered_tickers = [e["ticker_yf"] for e in etf_descriptions if e.get("ticker_yf")]
        self._theme_name = theme_name
        self._etf_descriptions = etf_descriptions

    def _generate_system_prompt(self) -> str:
        coverage_lines: list[str] = []
        all_holdings: list[str] = []
        for e in self._etf_descriptions:
            ticker = e.get("ticker_yf") or e.get("isin", "?")
            name = e.get("name", "")
            desc = e.get("description", "")
            holdings = e.get("top_holdings", [])
            holdings_str = ", ".join(holdings[:8]) if holdings else "N/A"
            coverage_lines.append(
                f"- {ticker} ({name}) — {desc[:200] if desc else 'N/A'}\n  Top holdings: {holdings_str}"
            )
            all_holdings.extend(holdings[:5])

        return THEME_AGENT_PROMPT_TEMPLATE.format(
            theme_name=self._theme_name,
            coverage_block="\n".join(coverage_lines) or "- No ETFs loaded for this theme",
            top_holdings=", ".join(list(dict.fromkeys(all_holdings))[:15]) or "N/A",
        )

    def build_prompt(
        self,
        context: PortfolioContext,
        market_summary: str,
        past_output: AgentOutput | None,
        judge_eval: dict | None,
    ) -> str:
        parts = [self._generate_system_prompt()]

        if past_output and judge_eval:
            parts.append(self._build_reflection_block(past_output, judge_eval))

        parts.append(context.to_prompt_string())
        parts.append(market_summary)
        parts.append(PREDICTION_INSTRUCTION)

        return "\n\n".join(parts)
