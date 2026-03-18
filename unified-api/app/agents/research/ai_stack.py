"""Agent 1 — AI Stack Analyst: XAIX, SMGB, VPNG, URNG."""

from app.agents.base_agent import PREDICTION_INSTRUCTION, BaseAgent
from app.agents.context_builder import PortfolioContext
from app.agents.prompts.v1.agent1_ai_stack import SYSTEM_PROMPT
from app.models.agent import AgentOutput


class AIStackAgent(BaseAgent):
    agent_name = "ai_stack_analyst"
    covered_tickers = ["XAIX.L", "SMGB.L", "VPNG.L", "URNG.L"]

    def build_prompt(
        self,
        context: PortfolioContext,
        market_summary: str,
        past_output: AgentOutput | None,
        judge_eval: dict | None,
    ) -> str:
        parts = [SYSTEM_PROMPT]

        if past_output and judge_eval:
            parts.append(self._build_reflection_block(past_output, judge_eval))

        parts.append(context.to_prompt_string())
        parts.append(market_summary)
        parts.append(PREDICTION_INSTRUCTION)

        return "\n\n".join(parts)
