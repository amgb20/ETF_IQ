"""Agent 5 — Portfolio Risk Assessor.

Computes correlation matrix, allocation drift, and volatility regime,
then sends these along with research outputs to the LLM for synthesis.
"""

from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.agents.base_agent import PREDICTION_INSTRUCTION, BaseAgent
from app.agents.context_builder import PortfolioContext, build, build_market_summary, market_data_to_prompt
from app.agents.prediction_parser import parse as parse_predictions
from app.agents.prompts.v1.agent5_risk import SYSTEM_PROMPT
from app.database import async_session
from app.models.agent import AgentOutput
from app.models.etf import ETF
from app.models.price import Price

logger = logging.getLogger(__name__)


class RiskAssessorAgent(BaseAgent):
    agent_name = "risk_assessor"
    covered_tickers = ["XAIX.L", "SMGB.L", "VPNG.L", "URNG.L", "AUCP.L", "SGLN.L", "ARMG.L"]

    def build_prompt(
        self,
        context: PortfolioContext,
        market_summary: str,
        past_output: AgentOutput | None,
        judge_eval: dict | None,
        **kwargs,
    ) -> str:
        parts = [SYSTEM_PROMPT]

        if past_output and judge_eval:
            parts.append(self._build_reflection_block(past_output, judge_eval))

        parts.append(context.to_prompt_string())
        parts.append(market_summary)

        if "correlation_data" in kwargs:
            parts.append(kwargs["correlation_data"])
        if "drift_data" in kwargs:
            parts.append(kwargs["drift_data"])
        if "volatility_data" in kwargs:
            parts.append(kwargs["volatility_data"])
        if "research_summaries" in kwargs:
            parts.append(kwargs["research_summaries"])

        parts.append(PREDICTION_INSTRUCTION)
        return "\n\n".join(parts)

    async def run(
        self,
        portfolio_id: uuid.UUID,
        run_date: date,
        run_type: str = "standard",
        research_outputs: list[AgentOutput] | None = None,
    ) -> AgentOutput:
        """Run the risk assessor with local quantitative computations + LLM synthesis."""
        import time as _time

        t0 = _time.perf_counter()
        logger.info(
            "RiskAssessorAgent starting for portfolio %s (run_date=%s, run_type=%s)",
            portfolio_id,
            run_date,
            run_type,
        )

        async with async_session() as session:
            logger.debug("RiskAssessorAgent: building context...")
            ctx = await build(portfolio_id, session)
            market = await build_market_summary(session)
            market_str = market_data_to_prompt(market)

            logger.debug("RiskAssessorAgent: computing quant metrics (correlation, drift, volatility)...")
            corr_str = await self._compute_correlation(session, days=90)
            drift_str = self._compute_drift(ctx)
            vol_str = await self._compute_volatility(session, days=20)

            research_str = ""
            if research_outputs:
                summaries = []
                for o in research_outputs:
                    summaries.append(f"--- {o.agent_name} (run_date: {o.run_date}) ---\n{o.summary[:1200]}")
                research_str = "RESEARCH AGENT OUTPUTS:\n" + "\n\n".join(summaries)

            past_output = await self.load_past_output(session, portfolio_id, run_date)
            judge_eval = past_output.judge_evaluation if past_output and past_output.judge_evaluation else None

            prompt = self.build_prompt(
                ctx,
                market_str,
                past_output,
                judge_eval,
                correlation_data=corr_str,
                drift_data=drift_str,
                volatility_data=vol_str,
                research_summaries=research_str,
            )

            logger.info("RiskAssessorAgent: calling LLM...")
            config = llm_client.DEEP_RESEARCH_CONFIG if run_type == "deep_research" else llm_client.STANDARD_CONFIG
            response = await llm_client.generate(prompt, config=config)
            predictions = parse_predictions(response.text)

            logger.debug("RiskAssessorAgent: storing output...")
            output = await self.store_output(
                session=session,
                portfolio_id=portfolio_id,
                run_date=run_date,
                run_type=run_type,
                summary=response.text,
                predictions=predictions,
                reflection=f"Reflected on Week {past_output.run_date} evaluation."
                if past_output and judge_eval
                else None,
                research_mode=run_type,
                model_used=response.model_used,
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
                latency_ms=response.latency_ms,
                sources_cited=response.sources_cited,
            )

            elapsed_ms = int((_time.perf_counter() - t0) * 1000)
            logger.info(
                "RiskAssessorAgent completed for portfolio %s (predictions=%d, elapsed=%dms)",
                portfolio_id,
                len(predictions),
                elapsed_ms,
            )
            return output

    async def _compute_correlation(self, session: AsyncSession, days: int = 90) -> str:
        """Compute pairwise correlation matrix from recent close prices."""
        cutoff = date.today() - timedelta(days=days)
        result = await session.execute(
            select(Price.etf_id, Price.date, Price.close, ETF.ticker_yf)
            .join(ETF, ETF.id == Price.etf_id)
            .where(Price.date >= cutoff)
            .order_by(Price.date)
        )
        rows = result.all()

        ticker_series: dict[str, list[float]] = {}
        ticker_dates: dict[str, list[str]] = {}
        for etf_id, dt, close, ticker in rows:
            ticker_series.setdefault(ticker, []).append(float(close))
            ticker_dates.setdefault(ticker, []).append(str(dt))

        if len(ticker_series) < 2:
            return "CORRELATION MATRIX: Insufficient data (< 2 ETFs with price history)"

        tickers = sorted(ticker_series.keys())
        min_len = min(len(ticker_series[t]) for t in tickers)
        if min_len < 10:
            return "CORRELATION MATRIX: Insufficient data (< 10 price points)"

        matrix = np.array([ticker_series[t][-min_len:] for t in tickers])
        returns = np.diff(matrix, axis=1) / matrix[:, :-1]
        corr = np.corrcoef(returns)

        lines = [f"CORRELATION MATRIX ({days}-day returns, {len(tickers)} ETFs):"]
        header = "         " + "  ".join(f"{t:>7}" for t in tickers)
        lines.append(header)
        for i, t in enumerate(tickers):
            row_vals = "  ".join(f"{corr[i][j]:7.3f}" for j in range(len(tickers)))
            lines.append(f"{t:>8} {row_vals}")
        return "\n".join(lines)

    def _compute_drift(self, ctx: PortfolioContext) -> str:
        """Compute allocation drift for each position."""
        if not ctx.positions or ctx.total_value <= 0:
            return "ALLOCATION DRIFT: No positions or zero portfolio value"

        lines = ["ALLOCATION DRIFT:"]
        for p in ctx.positions:
            actual_pct = (p.current_value / ctx.total_value * 100) if p.current_value else 0
            target = p.target_allocation or 0
            drift = actual_pct - target if target else 0
            flag = " *** ALERT" if abs(drift) > 5 else ""
            lines.append(f"  {p.ticker_yf}: actual={actual_pct:.1f}% target={target:.1f}% drift={drift:+.1f}%{flag}")
        return "\n".join(lines)

    async def _compute_volatility(self, session: AsyncSession, days: int = 20) -> str:
        """Classify volatility regime based on rolling stdev of returns."""
        cutoff = date.today() - timedelta(days=days + 10)
        result = await session.execute(
            select(ETF.ticker_yf, Price.close)
            .join(ETF, ETF.id == Price.etf_id)
            .where(Price.date >= cutoff)
            .order_by(ETF.ticker_yf, Price.date)
        )
        rows = result.all()

        ticker_prices: dict[str, list[float]] = {}
        for ticker, close in rows:
            ticker_prices.setdefault(ticker, []).append(float(close))

        lines = ["VOLATILITY REGIME (20-day rolling stdev of daily returns):"]
        for ticker in sorted(ticker_prices.keys()):
            prices = ticker_prices[ticker]
            if len(prices) < 5:
                lines.append(f"  {ticker}: insufficient data")
                continue
            arr = np.array(prices)
            returns = np.diff(arr) / arr[:-1]
            stdev = float(np.std(returns[-days:])) * 100
            regime = "HIGH" if stdev > 2.5 else "MEDIUM" if stdev > 1.0 else "LOW"
            lines.append(f"  {ticker}: stdev={stdev:.2f}% regime={regime}")
        return "\n".join(lines)
