"""Singleton Gemini client with standard and deep-research generation configs."""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field

from google import genai
from google.genai.types import (
    GenerateContentConfig,
    GoogleSearch,
    ThinkingConfig,
    Tool,
)

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def get_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        _client = genai.Client(api_key=settings.GOOGLE_API_KEY)
        logger.info("Gemini client initialised (model=%s)", settings.GEMINI_MODEL)
    return _client


STANDARD_CONFIG = GenerateContentConfig(
    temperature=0.3,
    max_output_tokens=4096,
    tools=[Tool(google_search=GoogleSearch())],
)

STRUCTURED_OUTPUT_CONFIG = GenerateContentConfig(
    temperature=0.2,
    max_output_tokens=8192,
)


DEEP_RESEARCH_CONFIG = GenerateContentConfig(
    temperature=0.2,
    max_output_tokens=16384,
    thinking_config=ThinkingConfig(thinking_budget=32768),
    tools=[Tool(google_search=GoogleSearch())],
)


def get_langchain_llm(temperature: float = 0.2, max_output_tokens: int = 4096):
    """Return a ChatGoogleGenerativeAI instance for the LangChain chat agent."""
    from langchain_google_genai import ChatGoogleGenerativeAI
    settings = get_settings()
    model_name = settings.GEMINI_MODEL.removeprefix("models/")
    return ChatGoogleGenerativeAI(
        model=model_name,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=temperature,
        max_output_tokens=max_output_tokens,
    )


@dataclass
class LLMResponse:
    text: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
    model_used: str = ""
    sources_cited: list[dict] = field(default_factory=list)


async def generate(
    prompt: str,
    config: GenerateContentConfig | None = None,
    model: str | None = None,
) -> LLMResponse:
    """Call Gemini generate_content and return a structured response with metrics."""
    client = get_client()
    settings = get_settings()
    model_name = model or settings.GEMINI_MODEL
    cfg = config or STANDARD_CONFIG

    t0 = time.perf_counter()
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=cfg,
    )
    latency_ms = int((time.perf_counter() - t0) * 1000)

    text = response.text or ""
    prompt_tokens = 0
    completion_tokens = 0
    if response.usage_metadata:
        prompt_tokens = response.usage_metadata.prompt_token_count or 0
        completion_tokens = response.usage_metadata.candidates_token_count or 0

    sources: list[dict] = []
    if response.candidates:
        cand = response.candidates[0]
        gm = getattr(cand, "grounding_metadata", None)
        if gm and getattr(gm, "grounding_chunks", None):
            for chunk in gm.grounding_chunks:
                web = getattr(chunk, "web", None)
                if web:
                    sources.append({"url": web.uri or "", "title": web.title or ""})

    logger.info(
        "LLM call: model=%s prompt_tokens=%d completion_tokens=%d latency=%dms sources=%d",
        model_name, prompt_tokens, completion_tokens, latency_ms, len(sources),
    )

    return LLMResponse(
        text=text,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        latency_ms=latency_ms,
        model_used=model_name,
        sources_cited=sources,
    )
