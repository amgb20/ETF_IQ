"""RAG store — embed and retrieve chunks scoped to portfolio_id."""
from __future__ import annotations

import asyncio
import logging
import uuid

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import llm_client
from app.config import get_settings
from app.models.rag import RagChunk

logger = logging.getLogger(__name__)
SIMILARITY_THRESHOLD = 0.65  # cosine similarity floor; tune as needed
_EMBED_MAX_RETRIES = 3
_EMBED_BACKOFF_BASE = 1.0  # seconds


async def embed_text(text: str) -> list[float]:
    """Call Gemini embedding model with retry + exponential backoff."""
    client = llm_client.get_client()
    settings = get_settings()
    last_exc: Exception | None = None

    for attempt in range(_EMBED_MAX_RETRIES):
        try:
            response = await client.aio.models.embed_content(
                model=settings.GEMINI_EMBEDDING_MODEL,
                contents=text,
                config={"output_dimensionality": 768},
            )
            return response.embeddings[0].values
        except Exception as exc:
            last_exc = exc
            if attempt < _EMBED_MAX_RETRIES - 1:
                wait = _EMBED_BACKOFF_BASE * (2 ** attempt)
                logger.warning(
                    "embed_text attempt %d failed (%s), retrying in %.1fs",
                    attempt + 1, exc, wait,
                )
                await asyncio.sleep(wait)

    raise last_exc  # type: ignore[misc]


async def upsert_chunk(
    session: AsyncSession,
    portfolio_id: uuid.UUID,
    source_type: str,  # "agent_output" | "chart_event"
    source_id: uuid.UUID,
    text: str,
    metadata: dict | None = None,
) -> None:
    """Embed text and upsert a RagChunk, replacing any existing chunk for (source_type, source_id)."""
    try:
        vector = await embed_text(text)
        await session.execute(
            delete(RagChunk).where(
                RagChunk.portfolio_id == portfolio_id,
                RagChunk.source_type == source_type,
                RagChunk.source_id == source_id,
            )
        )
        session.add(RagChunk(
            portfolio_id=portfolio_id,
            source_type=source_type,
            source_id=source_id,
            chunk_text=text[:2000],
            embedding=vector,
            metadata_=metadata,
        ))
        await session.commit()
        logger.info("RAG upsert OK: %s/%s", source_type, source_id)
    except Exception:
        logger.exception("RAG upsert failed for %s/%s after retries", source_type, source_id)


async def delete_chunks(
    session: AsyncSession,
    source_type: str,
    source_ids: list[uuid.UUID],
) -> int:
    """Delete rag_chunks by source_type and a list of source_ids. Returns rows deleted."""
    if not source_ids:
        return 0
    result = await session.execute(
        delete(RagChunk).where(
            RagChunk.source_type == source_type,
            RagChunk.source_id.in_(source_ids),
        )
    )
    return result.rowcount  # type: ignore[return-value]


async def search(
    session: AsyncSession,
    portfolio_id: uuid.UUID,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """Semantic search over chunks belonging to portfolio_id. Returns top_k results above threshold."""
    try:
        query_vec = await embed_text(query)
    except Exception:
        logger.exception("RAG search embed failed")
        return []

    result = await session.execute(
        select(
            RagChunk.chunk_text,
            RagChunk.metadata_,
            RagChunk.source_type,
            (1 - RagChunk.embedding.cosine_distance(query_vec)).label("similarity"),
        )
        .where(RagChunk.portfolio_id == portfolio_id)  # ISOLATION: hard filter
        .order_by(RagChunk.embedding.cosine_distance(query_vec))
        .limit(top_k)
    )
    rows = result.all()
    return [
        {
            "text": r.chunk_text,
            "metadata": r.metadata_,
            "source_type": r.source_type,
            "similarity": float(r.similarity),
        }
        for r in rows
        if float(r.similarity) >= SIMILARITY_THRESHOLD
    ]
