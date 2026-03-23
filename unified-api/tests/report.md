# Test Report

| Field | Value |
|-------|-------|
| **Last Run** | 2026-03-23 UTC |
| **Command** | `JWT_SECRET_KEY=<generated> DATABASE_URL=postgresql+asyncpg://fake:fake@localhost/fake python -m pytest tests/test_chat_agent.py -v -W ignore --tb=short -q` |
| **Status** | PASS |
| **Passed** | 5 |
| **Failed** | 0 |
| **Skipped** | 0 |
| **Coverage** | N/A |

## Results

| Test | Status | Notes |
|------|--------|-------|
| test_chat_agent.py::test_web_search_tool_invoked | PASS | |
| test_chat_agent.py::test_rag_search_tool_invoked | PASS | |
| test_chat_agent.py::test_text_only_no_tool | PASS | |
| test_chat_agent.py::test_streaming_yields_chunks | PASS | |
| test_chat_agent.py::test_context_builder_called | PASS | |

## Failures

None.

## Observations

- All 5 ChatAgent tool-routing tests pass — web search, RAG search, text-only, streaming, and context builder integration all verified.
- Tests require `JWT_SECRET_KEY` and `DATABASE_URL` env vars set externally since `app.config.Settings` validates at import time (before fixtures run).
- No coverage data collected for this run — consider adding `--cov=app/agents` in future runs.
