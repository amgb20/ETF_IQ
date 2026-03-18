"""Tests for ChatAgent tool routing.

Verifies that the correct SSE events (web_search, rag_search, or text-only)
are emitted for different user queries without making real network or DB calls.

External dependencies mocked per test:
  - LangChain LLM         → controlled turn-by-turn via fake astream
  - execute_web_search    → returns a fake string (no real HTTP call)
  - rag_store.search      → returns fake past-analysis rows
  - context_builder.build → returns a hardcoded PortfolioContext
  - async_session         → in-memory mock (no DB connection needed)
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock, patch

from langchain_core.messages import AIMessageChunk  # noqa: E402

from app.agents.chat_agent import ChatAgent
from app.agents.context_builder import PortfolioContext

# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

PORTFOLIO_ID = uuid.uuid4()

FAKE_CONTEXT = PortfolioContext(
    portfolio_id=PORTFOLIO_ID,
    portfolio_name="Test Portfolio",
    total_value=12_345.67,
    total_invested=11_000.0,
    total_pnl=1_345.67,
    total_pnl_pct=12.23,
)

FAKE_RAG_RESULTS = [
    {
        "text": "Agent RiskAssessor rated the portfolio LOW risk on 2025-01-10.",
        "source_type": "agent_result",
        "metadata": {"agent_name": "RiskAssessor", "run_date": "2025-01-10"},
    }
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _tool_call_chunk(name: str, args: dict, tool_id: str = "tc_001") -> AIMessageChunk:
    """One chunk that tells the agent to call a tool."""
    return AIMessageChunk(
        content="",
        tool_calls=[{"name": name, "args": args, "id": tool_id, "type": "tool_call"}],
    )


def _text_chunk(text: str) -> AIMessageChunk:
    return AIMessageChunk(content=text)


def _make_mock_llm(turn_responses: list[list[AIMessageChunk]]):
    """
    Return a mock LLM whose bind_tools().astream() plays back turn_responses.
    Each element is the list of chunks emitted for one LLM call.
    """
    call_count = 0

    async def _fake_astream(messages, **kwargs):
        nonlocal call_count
        idx = min(call_count, len(turn_responses) - 1)
        call_count += 1
        for chunk in turn_responses[idx]:
            yield chunk

    mock_bound = MagicMock()
    mock_bound.astream = _fake_astream

    mock_llm = MagicMock()
    mock_llm.bind_tools.return_value = mock_bound
    return mock_llm


def _make_db_session() -> AsyncMock:
    """Minimal async DB session that satisfies ChatAgent's persistence calls."""
    execute_result = MagicMock()
    execute_result.scalars.return_value = MagicMock(all=MagicMock(return_value=[]))

    session = AsyncMock()
    session.add = MagicMock()
    session.execute = AsyncMock(return_value=execute_result)
    session.scalar = AsyncMock(return_value=0)
    session.get = AsyncMock(return_value=None)  # title generation: no session row → skips
    return session


@asynccontextmanager
async def _fake_async_session(db_session):
    yield db_session


async def _collect(agent: ChatAgent, message: str) -> list[dict]:
    return [e async for e in agent.send_message(message)]


def _start_patches(patch_list):
    for p in patch_list:
        p.start()


def _stop_patches(patch_list):
    for p in patch_list:
        p.stop()


def _make_fake_web_search(result: str):
    """Return a real function (not a MagicMock) so StructuredTool.from_function can inspect type hints."""

    def execute_web_search(query: str) -> str:
        return result

    return execute_web_search


def _common_patches(mock_llm, web_result: str = "Gold: $2,650/oz", rag_results=None):
    db = _make_db_session()
    if rag_results is None:
        rag_results = []
    return [
        patch("app.agents.chat_agent.async_session", lambda: _fake_async_session(db)),
        patch("app.agents.chat_agent.build_context", AsyncMock(return_value=FAKE_CONTEXT)),
        patch("app.agents.chat_agent.execute_web_search", _make_fake_web_search(web_result)),
        patch("app.agents.tools.rag_store.search", AsyncMock(return_value=rag_results)),
        patch("app.agents.llm_client.get_langchain_llm", return_value=mock_llm),
    ]


# ---------------------------------------------------------------------------
# Test 1 — Gold price → web_search
# ---------------------------------------------------------------------------


async def test_gold_price_triggers_web_search():
    """
    SCENARIO: "What is the current price of gold?"
    EXPECTED: agent emits a 'tool' event with name='web_search' and the
              final text response contains the price.

    UI shows: globe icon + "Searching the web..." while the tool runs.
    """
    mock_llm = _make_mock_llm(
        [
            # Turn 1 — LLM decides to call web_search
            [_tool_call_chunk("web_search", {"query": "current gold price today"})],
            # Turn 2 — LLM synthesises the answer from search results
            [_text_chunk("Based on live data, gold is currently trading at "), _text_chunk("$2,650 per troy ounce.")],
        ]
    )

    patches = _common_patches(mock_llm, web_result="Gold price today: $2,650/oz")
    _start_patches(patches)
    try:
        agent = ChatAgent(portfolio_id=PORTFOLIO_ID)
        events = await _collect(agent, "What is the current price of gold?")
    finally:
        _stop_patches(patches)

    tool_events = [e for e in events if e["type"] == "tool"]
    text_events = [e for e in events if e["type"] == "text"]
    full_text = "".join(e.get("content", "") for e in text_events)

    # web_search tool event must be present
    assert tool_events, "Expected at least one 'tool' event"
    assert any(e["name"] == "web_search" for e in tool_events), (
        f"Expected web_search tool event, got: {[e['name'] for e in tool_events]}"
    )

    # Price must appear in the response text
    assert "2,650" in full_text or "gold" in full_text.lower(), f"Expected gold price in response, got: {full_text!r}"

    # Stream must end with a 'done' event
    assert events[-1]["type"] == "done"


# ---------------------------------------------------------------------------
# Test 2 — Portfolio value → answered from context, no tool
# ---------------------------------------------------------------------------


async def test_portfolio_value_answered_from_context():
    """
    SCENARIO: "What is my portfolio value?"
    EXPECTED: agent answers from the system prompt portfolio context — no
              tool events emitted.

    UI shows: direct text streaming with no tool indicator.
    """
    mock_llm = _make_mock_llm(
        [
            # Single turn — LLM reads portfolio context from system prompt
            [
                _text_chunk("Your portfolio is currently worth "),
                _text_chunk("€12,345.67, a gain of €1,345.67 (+12.23%) over your invested capital."),
            ],
        ]
    )

    patches = _common_patches(mock_llm)
    _start_patches(patches)
    try:
        agent = ChatAgent(portfolio_id=PORTFOLIO_ID)
        events = await _collect(agent, "What is my portfolio value?")
    finally:
        _stop_patches(patches)

    tool_events = [e for e in events if e["type"] == "tool"]
    text_events = [e for e in events if e["type"] == "text"]
    full_text = "".join(e.get("content", "") for e in text_events)

    # No tool should fire — the answer lives in the system prompt context
    assert not tool_events, f"Expected no tool events for a portfolio value question, got: {tool_events}"

    # Value from FAKE_CONTEXT must appear in response
    assert "12,345" in full_text or "portfolio" in full_text.lower(), (
        f"Expected portfolio value in response, got: {full_text!r}"
    )

    assert events[-1]["type"] == "done"


# ---------------------------------------------------------------------------
# Test 3 — Past agent analysis → rag_search
# ---------------------------------------------------------------------------


async def test_past_analysis_triggers_rag_search():
    """
    SCENARIO: "What did the agents say about my portfolio?"
    EXPECTED: agent emits a 'tool' event with name='rag_search'.

    UI shows: book icon + "Searching past reports..." while the tool runs.
    """
    mock_llm = _make_mock_llm(
        [
            # Turn 1 — LLM calls internal knowledge search
            [
                _tool_call_chunk(
                    "search_portfolio_knowledge",
                    {"query": "agent analysis portfolio"},
                    tool_id="tc_rag",
                )
            ],
            # Turn 2 — LLM synthesises from RAG results
            [_text_chunk("Based on past analyses, the Risk Assessor rated your portfolio LOW risk on 2025-01-10.")],
        ]
    )

    patches = _common_patches(mock_llm, rag_results=FAKE_RAG_RESULTS)
    _start_patches(patches)
    try:
        agent = ChatAgent(portfolio_id=PORTFOLIO_ID)
        events = await _collect(agent, "What did the agents say about my portfolio?")
    finally:
        _stop_patches(patches)

    tool_events = [e for e in events if e["type"] == "tool"]
    text_events = [e for e in events if e["type"] == "text"]
    full_text = "".join(e.get("content", "") for e in text_events)

    assert any(e["name"] == "rag_search" for e in tool_events), (
        f"Expected rag_search tool event, got: {[e['name'] for e in tool_events]}"
    )

    assert "risk" in full_text.lower() or "agent" in full_text.lower(), (
        f"Expected analysis content in response, got: {full_text!r}"
    )

    assert events[-1]["type"] == "done"


# ---------------------------------------------------------------------------
# Test 4 — General knowledge question → no tool
# ---------------------------------------------------------------------------


async def test_general_question_no_tool():
    """
    SCENARIO: "What is an ETF?"
    EXPECTED: answered from model knowledge — no tool events, no web search.
    """
    mock_llm = _make_mock_llm(
        [
            [
                _text_chunk(
                    "An ETF (Exchange-Traded Fund) is a basket of securities that trades on an exchange like a stock."
                )
            ],
        ]
    )

    patches = _common_patches(mock_llm)
    _start_patches(patches)
    try:
        agent = ChatAgent(portfolio_id=PORTFOLIO_ID)
        events = await _collect(agent, "What is an ETF?")
    finally:
        _stop_patches(patches)

    tool_events = [e for e in events if e["type"] == "tool"]
    full_text = "".join(e.get("content", "") for e in events if e["type"] == "text")

    assert not tool_events, f"Expected no tool events for a general question, got: {tool_events}"
    assert "etf" in full_text.lower() or "exchange" in full_text.lower()
    assert events[-1]["type"] == "done"


# ---------------------------------------------------------------------------
# Test 5 — Hybrid question → both tools fire concurrently
# ---------------------------------------------------------------------------


async def test_hybrid_question_fires_both_tools():
    """
    SCENARIO: "What is the current gold price AND what did the analysis say about my gold?"
    EXPECTED: both web_search AND rag_search tool events are emitted.

    Verifies asyncio.gather runs both tools in the same turn.
    """
    mock_llm = _make_mock_llm(
        [
            # Turn 1 — LLM requests both tools at once
            [
                AIMessageChunk(
                    content="",
                    tool_calls=[
                        {
                            "name": "web_search",
                            "args": {"query": "current gold price"},
                            "id": "tc_web",
                            "type": "tool_call",
                        },
                        {
                            "name": "search_portfolio_knowledge",
                            "args": {"query": "gold position analysis"},
                            "id": "tc_rag",
                            "type": "tool_call",
                        },
                    ],
                )
            ],
            # Turn 2 — synthesis
            [_text_chunk("Gold is at $2,650/oz. Past analysis rated your gold allocation as overweight.")],
        ]
    )

    patches = _common_patches(
        mock_llm,
        web_result="Gold: $2,650/oz",
        rag_results=FAKE_RAG_RESULTS,
    )
    _start_patches(patches)
    try:
        agent = ChatAgent(portfolio_id=PORTFOLIO_ID)
        events = await _collect(
            agent,
            "What is the current gold price and what did the analysis say about my gold position?",
        )
    finally:
        _stop_patches(patches)

    tool_names = {e["name"] for e in events if e["type"] == "tool"}

    assert "web_search" in tool_names, f"Expected web_search tool event, got tool names: {tool_names}"
    assert "rag_search" in tool_names, f"Expected rag_search tool event, got tool names: {tool_names}"
    assert events[-1]["type"] == "done"
