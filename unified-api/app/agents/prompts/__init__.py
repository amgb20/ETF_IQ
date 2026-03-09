"""Prompt version router -- loads system prompts by agent name and version."""

from __future__ import annotations

import importlib
import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


def get_prompt(agent_name: str, version: str | None = None) -> str:
    """Load the SYSTEM_PROMPT for a given agent from the versioned prompt module.

    Args:
        agent_name: The prompt module name (e.g., "agent1_ai_stack").
        version: Prompt version directory (e.g., "v1"). Defaults to PROMPT_VERSION setting.
    """
    version = version or get_settings().PROMPT_VERSION
    module_path = f"app.agents.prompts.{version}.{agent_name}"
    try:
        module = importlib.import_module(module_path)
        return module.SYSTEM_PROMPT
    except (ImportError, AttributeError) as exc:
        logger.error("Failed to load prompt %s/%s: %s", version, agent_name, exc)
        raise ValueError(f"Prompt not found: {version}/{agent_name}") from exc


def get_prompt_version() -> str:
    return get_settings().PROMPT_VERSION
