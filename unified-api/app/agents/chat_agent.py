"""Agent 9 — Portfolio Chatbot with LangChain ReAct loop and nested Gemini search."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import AsyncGenerator

import sqlalchemy as sa
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.agents.context_builder import build as build_context
from app.agents.tools import rag_store
from app.config import get_settings
from app.database import async_session
from app.models.alert import Alert
from app.models.chat import ChatSession, ChatMessage
from app.models.notification import Notification

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_TEMPLATE = """\
You are Charles, a conversational AI assistant for an ETF portfolio investor.

PORTFOLIO CONTEXT (live data):
{portfolio_context}

TOOL ROUTING RULES — choose the right source for each question:
- search_portfolio_knowledge: use when the question is about PAST analyses, agent reports,
  predictions, historical events in this portfolio, or "what did the analysis say about X".
- web_search: use for CURRENT prices, live news, recent market events,
  or anything requiring up-to-date information from the internet.
- create_alert: use when the user wants to set up a price alert, notification, or monitoring
  threshold for an ETF. Extract the ETF name/ticker, alert type (price_above, price_below,
  pct_change, volatility), and numeric threshold from the user's message.
- Neither tool: answer from your own knowledge for general financial concepts, definitions,
  ETF mechanics, or questions that don't require live or historical portfolio data.

You may call multiple tools in parallel if a question needs both past analysis AND current data.

RULES:
- Always ground responses in the user's actual portfolio data shown above.
- When citing past agent analysis, include the agent name, date, and Judge score if available.
- Never give financial advice. Say "Based on the analysis..." not "You should...".
- If unsure, say so. Do not fabricate agent outputs.
- Include disclaimers when discussing actionable information.
- Keep responses concise and actionable.
"""


def _resolve_sources(sources: list[dict]) -> list[dict]:
    """Resolve vertexaisearch redirect URLs to actual website URLs."""
    import httpx

    needs_resolve = any("vertexaisearch" in s.get("uri", "") for s in sources)
    if not needs_resolve:
        return sources

    resolved: list[dict] = []
    seen: set[str] = set()
    try:
        with httpx.Client(follow_redirects=True, timeout=10) as client:
            for s in sources:
                uri = s["uri"]
                if "vertexaisearch" in uri:
                    try:
                        resp = client.head(uri)
                        final = str(resp.url)
                        if "vertexaisearch" not in final and final not in seen:
                            seen.add(final)
                            resolved.append({"uri": final, "title": s.get("title", "")})
                    except Exception:
                        continue
                elif uri not in seen:
                    seen.add(uri)
                    resolved.append(s)
    except Exception:
        return [s for s in sources if "vertexaisearch" not in s.get("uri", "")]

    return resolved


def execute_web_search(query: str) -> str:
    """Search the live web using a nested Gemini call with native Google Search grounding."""
    from google import genai
    from google.genai import types

    settings = get_settings()
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=query,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())]
            ),
        )
        text = response.text or "No results found."

        sources: list[dict] = []
        if response.candidates:
            gm = getattr(response.candidates[0], "grounding_metadata", None)
            if gm and getattr(gm, "grounding_chunks", None):
                seen_uris: set[str] = set()
                for chunk in gm.grounding_chunks:
                    web = getattr(chunk, "web", None)
                    if web and web.uri and web.uri not in seen_uris:
                        seen_uris.add(web.uri)
                        sources.append({"uri": web.uri, "title": web.title or ""})

        sources = _resolve_sources(sources)

        return json.dumps({"text": text, "sources": sources})
    except Exception as exc:
        logger.exception("Web search sub-agent failed: %s", exc)
        return json.dumps({"text": f"Web search failed: {exc}", "sources": []})


class ChatAgent:
    def __init__(self, portfolio_id: uuid.UUID, session_id: uuid.UUID | None = None):
        self.portfolio_id = portfolio_id
        self.session_id = session_id

    async def _build_system_prompt(self, session: AsyncSession) -> str:
        ctx = await build_context(self.portfolio_id, session)
        return SYSTEM_PROMPT_TEMPLATE.format(portfolio_context=ctx.to_prompt_string())

    def _make_tools(self, db_session: AsyncSession) -> list:
        portfolio_id = self.portfolio_id

        web_tool = StructuredTool.from_function(
            func=execute_web_search,
            name="web_search",
            description=(
                "Search the internet for current financial news, live ETF/stock prices, "
                "and recent market events. Use for any question needing up-to-date information."
            ),
        )

        async def _rag_search(query: str) -> str:
            results = await rag_store.search(db_session, portfolio_id, query)
            if not results:
                return "No relevant past analyses found."
            return "\n\n---\n\n".join([
                f"[{r['metadata'].get('agent_name', r['source_type'])} "
                f"— {r['metadata'].get('run_date', r['metadata'].get('event_date', ''))}]\n"
                f"{r['text']}"
                for r in results
            ])

        rag_tool = StructuredTool.from_function(
            coroutine=_rag_search,
            name="search_portfolio_knowledge",
            description=(
                "Search the user's past portfolio analyses, agent reports, predictions, "
                "and historical market events stored internally. Use when asked about what "
                "past agents said, previous predictions, past recommendations, or historical "
                "events affecting this portfolio."
            ),
        )

        async def _create_alert(etf_name: str, alert_type: str, threshold: float) -> str:
            """Create a price alert for an ETF in the user's portfolio.

            Args:
                etf_name: ETF ticker or name (e.g. "XAIX", "Gold Mining").
                alert_type: One of price_above, price_below, pct_change, volatility.
                threshold: Numeric threshold value for the alert.
            """
            valid_types = {"price_above", "price_below", "pct_change", "volatility"}
            if alert_type not in valid_types:
                return f"Invalid alert type '{alert_type}'. Must be one of: {', '.join(sorted(valid_types))}"

            from app.models.etf import ETF
            from app.models.position import Position

            result = await db_session.execute(
                select(ETF)
                .join(Position, Position.etf_id == ETF.id)
                .where(
                    Position.portfolio_id == portfolio_id,
                    Position.is_active == True,  # noqa: E712
                    sa.or_(
                        ETF.ticker_yf.ilike(f"%{etf_name}%"),
                        ETF.name.ilike(f"%{etf_name}%"),
                        ETF.isin.ilike(f"%{etf_name}%"),
                    ),
                )
            )
            etf = result.scalar_one_or_none()
            if not etf:
                return (
                    f"Could not find an ETF matching '{etf_name}' in your portfolio. "
                    "Please check the ticker or name and try again."
                )

            new_alert = Alert(
                portfolio_id=portfolio_id,
                etf_id=etf.id,
                type=alert_type,
                threshold=threshold,
            )
            db_session.add(new_alert)
            await db_session.flush()

            from app.models.portfolio import Portfolio
            portfolio_row = await db_session.get(Portfolio, portfolio_id)
            if portfolio_row:
                db_session.add(Notification(
                    user_id=portfolio_row.user_id,
                    type="alert_configured",
                    title="Alert configured",
                    message=f"{alert_type.replace('_', ' ').title()} alert set at {threshold} for {etf.ticker_yf or etf.name}",
                    ref_id=new_alert.id,
                ))

            label = etf.ticker_yf or etf.name
            return (
                f"Alert created: {alert_type.replace('_', ' ')} at {threshold} for {label}. "
                "You'll be notified when this threshold is hit."
            )

        alert_tool = StructuredTool.from_function(
            coroutine=_create_alert,
            name="create_alert",
            description=(
                "Create a price alert for an ETF in the user's portfolio. "
                "Use when the user asks to be notified about price thresholds, "
                "monitoring conditions, or alert setups."
            ),
        )

        return [web_tool, rag_tool, alert_tool]

    async def send_message(self, user_text: str) -> AsyncGenerator[dict, None]:
        """Process a user message and yield SSE event dicts."""
        async with async_session() as session:
            # 1. Persist session and user message
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

            # 2. Build system prompt with live portfolio context
            system_prompt = await self._build_system_prompt(session)

            # 3. Build LangChain message history
            history = await self._load_history(session)
            messages = [SystemMessage(content=system_prompt)]
            for msg in history[:-1]:  # exclude current user message
                if msg.role == "user":
                    messages.append(HumanMessage(content=msg.content))
                else:
                    messages.append(AIMessage(content=msg.content))
            messages.append(HumanMessage(content=user_text))

            # 4. LLM + tools
            llm = llm_client.get_langchain_llm()
            tools = self._make_tools(session)
            tool_map = {t.name: t for t in tools}
            llm_with_tools = llm.bind_tools(tools)

            # 5. ReAct streaming loop (max 4 turns)
            full_text = ""
            tools_used: list[dict] = []

            for _turn in range(4):
                all_chunks: list[AIMessageChunk] = []
                try:
                    async for chunk in llm_with_tools.astream(messages):
                        all_chunks.append(chunk)
                        if chunk.content:
                            if isinstance(chunk.content, str):
                                text = chunk.content
                            elif isinstance(chunk.content, list):
                                text = "".join(
                                    part.get("text", "") for part in chunk.content
                                    if isinstance(part, dict) and part.get("type") == "text"
                                )
                            else:
                                text = ""
                            if text:
                                full_text += text
                                yield {"type": "text", "content": text}
                except Exception as exc:
                    logger.exception("Chat streaming failed: %s", exc)
                    error_msg = "I'm sorry, I encountered an error. Please try again."
                    full_text = error_msg
                    yield {"type": "text", "content": error_msg}
                    break

                if not all_chunks:
                    break

                # Aggregate chunks into a complete AIMessage
                full_ai_msg: AIMessage = all_chunks[0]
                for c in all_chunks[1:]:
                    full_ai_msg = full_ai_msg + c
                messages.append(full_ai_msg)

                if not full_ai_msg.tool_calls:
                    break  # Final text response — done

                # Emit tool-start SSE events
                for tc in full_ai_msg.tool_calls:
                    sse_name = tc["name"] if tc["name"] in ("web_search", "create_alert") else "rag_search"
                    yield {"type": "tool", "name": sse_name}
                    tools_used.append({"tool": sse_name, "query": str(tc.get("args", ""))[:200]})

                # Execute all tool calls concurrently
                async def _invoke(tc):
                    return await tool_map[tc["name"]].ainvoke(tc["args"])

                results = await asyncio.gather(
                    *[_invoke(tc) for tc in full_ai_msg.tool_calls],
                    return_exceptions=True,
                )

                for tc, result in zip(full_ai_msg.tool_calls, results):
                    result_str = str(result) if not isinstance(result, Exception) else f"Error: {result}"
                    messages.append(ToolMessage(
                        tool_call_id=tc["id"],
                        name=tc["name"],
                        content=result_str,
                    ))
                    sse_name = tc["name"] if tc["name"] in ("web_search", "create_alert") else "rag_search"
                    yield {"type": "tool_result", "name": sse_name}

                    if tc["name"] == "web_search" and not isinstance(result, Exception):
                        try:
                            parsed = json.loads(result_str)
                            sources = parsed.get("sources", [])
                            if sources:
                                yield {"type": "sources", "sources": sources}
                        except (json.JSONDecodeError, AttributeError):
                            pass

            # 6. Persist assistant message
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

            await self._maybe_generate_title(session, user_text)

    async def _maybe_generate_title(self, session: AsyncSession, first_msg: str) -> None:
        """Generate a short title for the session based on the first user message."""
        try:
            row = await session.get(ChatSession, self.session_id)
            if not row or row.title:
                return

            msg_count = await session.scalar(
                select(func.count())
                .select_from(ChatMessage)
                .where(ChatMessage.session_id == self.session_id)
            )
            if msg_count != 2:
                return

            title = first_msg.strip()[:100]
            if len(title) > 50:
                from google.genai.types import GenerateContentConfig
                client = llm_client.get_client()
                settings = get_settings()
                resp = await client.aio.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=(
                        "Summarize the following user question into a short chat title "
                        "(max 6 words, no quotes, no punctuation at the end):\n\n"
                        f"{first_msg}"
                    ),
                    config=GenerateContentConfig(
                        temperature=0.0,
                        max_output_tokens=30,
                    ),
                )
                title = (resp.text or title).strip().strip('"').strip("'")[:120]

            await session.execute(
                update(ChatSession)
                .where(ChatSession.id == self.session_id)
                .values(title=title)
            )
            await session.commit()
        except Exception:
            logger.debug("Title generation failed, skipping", exc_info=True)

    async def _load_history(self, session: AsyncSession) -> list[ChatMessage]:
        result = await session.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == self.session_id)
            .order_by(ChatMessage.created_at)
            .limit(50)
        )
        return list(result.scalars().all())
