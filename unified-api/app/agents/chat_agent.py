"""Agent 9 -- Portfolio Chatbot with streaming, web search, and report history tools."""

from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import AsyncGenerator
from datetime import date

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.agents.context_builder import build as build_context
from app.agents.tools.report_history import ReportHistoryTool
from app.config import get_settings
from app.database import async_session
from app.models.chat import ChatSession, ChatMessage

logger = logging.getLogger(__name__)

REPORT_HISTORY_KEYWORDS = [
    "agent", "analyst", "predicted", "prediction", "last week", "previous",
    "said about", "analysis", "report", "judge", "score", "accuracy",
    "recommendation", "what did", "history", "past",
]

SYSTEM_PROMPT_TEMPLATE = """\
You are PortfolioIQ Assistant, a conversational AI for an ETF portfolio investor.

PORTFOLIO CONTEXT:
{portfolio_context}

You have access to real-time web search (via Google Search grounding) to answer \
questions about current financial events, prices, and news.

{report_context}

RULES:
- Always ground responses in the user's actual portfolio
- When citing past agent analysis, include the date and the Judge's accuracy score
- Never give financial advice. Say "Based on the analysis..." not "You should..."
- If unsure, say so. Do not fabricate agent outputs.
- Include disclaimers when discussing any actionable information.
- Keep responses concise and actionable.
"""


class ChatAgent:
    def __init__(self, portfolio_id: uuid.UUID, session_id: uuid.UUID | None = None):
        self.portfolio_id = portfolio_id
        self.session_id = session_id

    async def _build_system_prompt(self, session: AsyncSession, report_results: str = "") -> str:
        ctx = await build_context(self.portfolio_id, session)
        report_block = ""
        if report_results:
            report_block = (
                "RELEVANT PAST AGENT ANALYSES:\n"
                "The following results were found from searching past agent reports. "
                "Use these to ground your response:\n\n"
                f"{report_results}"
            )
        return SYSTEM_PROMPT_TEMPLATE.format(
            portfolio_context=ctx.to_prompt_string(),
            report_context=report_block,
        )

    def _should_search_history(self, message: str) -> bool:
        lower = message.lower()
        return any(kw in lower for kw in REPORT_HISTORY_KEYWORDS)

    async def _search_report_history(
        self, session: AsyncSession, query: str
    ) -> tuple[list[dict], str]:
        results = await ReportHistoryTool.search(
            session=session,
            portfolio_id=str(self.portfolio_id),
            query=query,
        )
        if not results:
            return results, ""

        parts = []
        for r in results:
            score_str = f" (Judge score: {r['judge_overall_score']}/10)" if r["judge_overall_score"] else ""
            parts.append(
                f"--- {r['agent_name']} ({r['run_date']}){score_str} ---\n"
                f"{r['summary_excerpt']}"
            )
        return results, "\n\n".join(parts)

    async def send_message(
        self, user_text: str
    ) -> AsyncGenerator[dict, None]:
        """Process a user message and yield SSE event dicts."""
        async with async_session() as session:
            if not self.session_id:
                chat_session = ChatSession(portfolio_id=self.portfolio_id)
                session.add(chat_session)
                await session.flush()
                self.session_id = chat_session.id
            else:
                await session.execute(
                    update(ChatSession)
                    .where(ChatSession.id == self.session_id)
                    .values(last_message_at=func.now())
                )

            session.add(ChatMessage(
                session_id=self.session_id,
                role="user",
                content=user_text,
            ))
            await session.commit()

            tools_used = []
            report_context = ""

            if self._should_search_history(user_text):
                yield {"type": "tool", "name": "report_history"}
                tools_used.append({"tool": "report_history", "query": user_text[:200]})
                results, report_context = await self._search_report_history(session, user_text)
                if results:
                    yield {"type": "tool_result", "name": "report_history", "count": len(results)}

            yield {"type": "tool", "name": "web_search"}
            tools_used.append({"tool": "web_search"})

            system_prompt = await self._build_system_prompt(session, report_context)

            history = await self._load_history(session)
            contents = [system_prompt]
            for msg in history[:-1]:
                contents.append(f"{'User' if msg.role == 'user' else 'Assistant'}: {msg.content}")
            contents.append(f"User: {user_text}")

            full_prompt = "\n\n".join(contents)

            client = llm_client.get_client()
            settings = get_settings()
            model_name = settings.GEMINI_MODEL

            full_text = ""
            try:
                response = client.models.generate_content_stream(
                    model=model_name,
                    contents=full_prompt,
                    config=llm_client.STANDARD_CONFIG,
                )
                for chunk in response:
                    if chunk.text:
                        full_text += chunk.text
                        yield {"type": "text", "content": chunk.text}
            except Exception as exc:
                logger.exception("Chat streaming failed: %s", exc)
                error_msg = "I'm sorry, I encountered an error processing your request. Please try again."
                full_text = error_msg
                yield {"type": "text", "content": error_msg}

            session.add(ChatMessage(
                session_id=self.session_id,
                role="assistant",
                content=full_text,
                tools_used=tools_used if tools_used else None,
            ))
            await session.execute(
                update(ChatSession)
                .where(ChatSession.id == self.session_id)
                .values(last_message_at=func.now())
            )
            await session.commit()

            yield {"type": "done", "session_id": str(self.session_id)}

    async def _load_history(self, session: AsyncSession) -> list[ChatMessage]:
        result = await session.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == self.session_id)
            .order_by(ChatMessage.created_at)
            .limit(50)
        )
        return list(result.scalars().all())
