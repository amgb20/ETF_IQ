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
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.agents import llm_client
from app.agents.context_builder import build as build_context
from app.agents.tools import rag_store
from app.config import get_settings
from app.database import async_session
from app.models.alert import Alert
from app.models.chat import ChatMessage, ChatSession
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
- close_trade: use when the user says they sold shares, closed a position, or wants to record
  a sell trade. Extract the ETF name/ticker, number of shares, sell price, and optional date.
- open_trade: use when the user says they bought shares or wants to record a purchase.
  Extract the ETF name/ticker, number of shares, buy price, and optional date.
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


def execute_web_search(query: str) -> str:
    """Search the live web using a nested Gemini call with native Google Search grounding."""
    from google import genai
    from google.genai import types

    from app.agents.llm_client import _resolve_vertex_urls

    settings = get_settings()
    client = genai.Client(api_key=settings.GOOGLE_API_KEY)
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=query,
            config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
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
                        sources.append({"url": web.uri, "title": web.title or ""})

        sources = _resolve_vertex_urls(sources)

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
            return "\n\n---\n\n".join(
                [
                    f"[{r['metadata'].get('agent_name', r['source_type'])} "
                    f"— {r['metadata'].get('run_date', r['metadata'].get('event_date', ''))}]\n"
                    f"{r['text']}"
                    for r in results
                ]
            )

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
                db_session.add(
                    Notification(
                        user_id=portfolio_row.user_id,
                        type="alert_configured",
                        title="Alert configured",
                        message=f"{alert_type.replace('_', ' ').title()} alert set at {threshold} for {etf.ticker_yf or etf.name}",
                        ref_id=new_alert.id,
                    )
                )

            await db_session.commit()

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

        async def _close_trade(etf_name_or_isin: str, shares: float, sell_price: float, date: str = "", notes: str = "") -> str:
            """Sell (partially or fully) an ETF position in the user's portfolio.

            Args:
                etf_name_or_isin: ETF ticker, name, or ISIN to sell.
                shares: Number of shares to sell.
                sell_price: Price per share at which shares were sold.
                date: Optional sell date in YYYY-MM-DD format. Defaults to today.
                notes: Optional notes about the trade.
            """
            from datetime import date as date_type

            from app.models.etf import ETF as ETFModel
            from app.models.position import Position as PosModel, Transaction as TxnModel

            result = await db_session.execute(
                select(PosModel)
                .join(ETFModel, PosModel.etf_id == ETFModel.id)
                .options(selectinload(PosModel.etf))
                .where(
                    PosModel.portfolio_id == portfolio_id,
                    PosModel.is_active == True,  # noqa: E712
                    sa.or_(
                        ETFModel.ticker_yf.ilike(f"%{etf_name_or_isin}%"),
                        ETFModel.name.ilike(f"%{etf_name_or_isin}%"),
                        ETFModel.isin.ilike(f"%{etf_name_or_isin}%"),
                    ),
                )
            )
            position = result.scalar_one_or_none()
            if not position:
                return f"Could not find an active position matching '{etf_name_or_isin}' in your portfolio."

            held = float(position.shares)
            if shares > held:
                return f"You only hold {held} shares of {position.etf.name}. Cannot sell {shares}."

            sell_date = date_type.fromisoformat(date) if date else date_type.today()
            sell_amount = round(shares * sell_price, 2)
            cost_per_share = float(position.invested_amount) / held if held else 0
            cost_basis = round(cost_per_share * shares, 2)
            pnl = round(sell_amount - cost_basis, 2)
            pnl_pct = round((pnl / cost_basis) * 100, 2) if cost_basis else 0

            txn = TxnModel(
                position_id=position.id, type="sell", date=sell_date,
                price=sell_price, shares=shares, amount=sell_amount,
                notes=notes or None,
            )
            db_session.add(txn)

            remaining = held - shares
            position.shares = remaining
            position.invested_amount = round(cost_per_share * remaining, 2)
            if remaining <= 0:
                position.is_active = False
                position.exit_date = sell_date
                position.exit_price = sell_price

            await db_session.commit()

            label = position.etf.ticker_yf or position.etf.name
            status = "fully closed" if remaining <= 0 else f"{remaining} shares remaining"
            sign = "+" if pnl >= 0 else ""
            return (
                f"Trade recorded: Sold {shares} shares of {label} at {sell_price} "
                f"for {sell_amount}. Realized P&L: {sign}{pnl} ({sign}{pnl_pct}%). "
                f"Position {status}."
            )

        close_trade_tool = StructuredTool.from_function(
            coroutine=_close_trade,
            name="close_trade",
            description=(
                "Sell or partially sell an ETF position in the user's portfolio. "
                "Use when the user says they sold shares, closed a position, or wants to record a sell trade."
            ),
        )

        async def _open_trade(etf_name_or_isin: str, shares: float, buy_price: float, date: str = "", notes: str = "") -> str:
            """Record a buy trade — add shares to an existing position or open a new one.

            Args:
                etf_name_or_isin: ETF ticker, name, or ISIN to buy.
                shares: Number of shares bought.
                buy_price: Price per share at which shares were bought.
                date: Optional buy date in YYYY-MM-DD format. Defaults to today.
                notes: Optional notes about the trade.
            """
            from datetime import date as date_type

            from app.models.etf import ETF as ETFModel
            from app.models.position import Position as PosModel, Transaction as TxnModel

            etf_result = await db_session.execute(
                select(ETFModel).where(
                    sa.or_(
                        ETFModel.ticker_yf.ilike(f"%{etf_name_or_isin}%"),
                        ETFModel.name.ilike(f"%{etf_name_or_isin}%"),
                        ETFModel.isin.ilike(f"%{etf_name_or_isin}%"),
                    )
                )
            )
            etf = etf_result.scalar_one_or_none()
            if not etf:
                return f"Could not find an ETF matching '{etf_name_or_isin}'. Please check the name or ISIN."

            buy_date = date_type.fromisoformat(date) if date else date_type.today()
            buy_amount = round(shares * buy_price, 2)

            existing_result = await db_session.execute(
                select(PosModel).where(
                    PosModel.portfolio_id == portfolio_id,
                    PosModel.etf_id == etf.id,
                    PosModel.is_active == True,  # noqa: E712
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                old_shares = float(existing.shares)
                old_invested = float(existing.invested_amount)
                existing.shares = old_shares + shares
                existing.invested_amount = old_invested + buy_amount
                existing.entry_price = (old_invested + buy_amount) / (old_shares + shares)
                position = existing
            else:
                position = PosModel(
                    portfolio_id=portfolio_id, etf_id=etf.id,
                    entry_date=buy_date, entry_price=buy_price,
                    shares=shares, invested_amount=buy_amount,
                )
                db_session.add(position)
                await db_session.flush()

            txn = TxnModel(
                position_id=position.id, type="buy", date=buy_date,
                price=buy_price, shares=shares, amount=buy_amount,
                notes=notes or None,
            )
            db_session.add(txn)
            await db_session.commit()

            label = etf.ticker_yf or etf.name
            action = "Added to existing position" if existing else "New position opened"
            return (
                f"Trade recorded: Bought {shares} shares of {label} at {buy_price} "
                f"for {buy_amount}. {action} — now holding {float(position.shares)} shares total."
            )

        open_trade_tool = StructuredTool.from_function(
            coroutine=_open_trade,
            name="open_trade",
            description=(
                "Record a buy trade for an ETF. Adds shares to an existing position or opens a new one. "
                "Use when the user says they bought shares or wants to record a purchase."
            ),
        )

        return [web_tool, rag_tool, alert_tool, close_trade_tool, open_trade_tool]

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
                    update(ChatSession).where(ChatSession.id == self.session_id).values(last_message_at=func.now())
                )

            session.add(
                ChatMessage(
                    session_id=self.session_id,
                    role="user",
                    content=user_text,
                )
            )
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
            all_sources: list[dict] = []

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
                                    part.get("text", "")
                                    for part in chunk.content
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
                    messages.append(
                        ToolMessage(
                            tool_call_id=tc["id"],
                            name=tc["name"],
                            content=result_str,
                        )
                    )
                    sse_name = tc["name"] if tc["name"] in ("web_search", "create_alert") else "rag_search"
                    yield {"type": "tool_result", "name": sse_name}

                    if tc["name"] == "web_search" and not isinstance(result, Exception):
                        try:
                            parsed = json.loads(result_str)
                            sources = parsed.get("sources", [])
                            if sources:
                                all_sources.extend(sources)
                                yield {"type": "sources", "sources": sources}
                        except (json.JSONDecodeError, AttributeError):
                            pass

            # 6. Persist assistant message
            session.add(
                ChatMessage(
                    session_id=self.session_id,
                    role="assistant",
                    content=full_text,
                    tools_used=tools_used if tools_used else None,
                    sources=all_sources if all_sources else None,
                )
            )
            await session.execute(
                update(ChatSession).where(ChatSession.id == self.session_id).values(last_message_at=func.now())
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
                select(func.count()).select_from(ChatMessage).where(ChatMessage.session_id == self.session_id)
            )
            if msg_count != 2:
                return

            from google.genai.types import GenerateContentConfig

            client = llm_client.get_client()
            settings = get_settings()
            resp = await client.aio.models.generate_content(
                model=settings.GEMINI_FLASH_MODEL,
                contents=(
                    "Rephrase the following user message as a concise chat title "
                    "(3-6 words) that captures the main topic and intent. "
                    "Do not extract a single keyword.\n\n"
                    "Examples:\n"
                    'User: "hello"\n'
                    "Title: New Conversation\n"
                    'User: "AU"\n'
                    "Title: AU ETF Discussion\n"
                    'User: "What happened to my portfolio last Friday?"\n'
                    "Title: Portfolio Changes Last Friday\n"
                    'User: "Can you compare my ETF performance over 6 months?"\n'
                    "Title: ETF Performance 6-Month Comparison\n\n"
                    f'User: "{first_msg}"\nTitle:'
                ),
                config=GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=30,
                ),
            )
            title = (resp.text or first_msg.strip()[:100]).strip().strip('"').strip("'")[:120]

            logger.info(
                "Title generated for session %s: %r (from: %r)",
                self.session_id,
                title,
                first_msg[:80],
            )

            await session.execute(update(ChatSession).where(ChatSession.id == self.session_id).values(title=title))
            await session.commit()
        except Exception:
            logger.warning("Title generation failed for session %s", self.session_id, exc_info=True)

    async def _load_history(self, session: AsyncSession) -> list[ChatMessage]:
        result = await session.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == self.session_id)
            .order_by(ChatMessage.created_at)
            .limit(50)
        )
        return list(result.scalars().all())
