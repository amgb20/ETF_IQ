from __future__ import annotations

import logging
from typing import Any

from data_connectors.base import BaseConnector

logger = logging.getLogger(__name__)


class ConnectorRegistry:
    """Register and look up data connectors by name."""

    def __init__(self) -> None:
        self._connectors: dict[str, BaseConnector] = {}

    def register(self, connector: BaseConnector) -> None:
        self._connectors[connector.name] = connector
        logger.info("Registered connector: %s", connector.name)

    def get(self, name: str) -> BaseConnector | None:
        return self._connectors.get(name)

    def names(self) -> list[str]:
        return list(self._connectors.keys())


_registry = ConnectorRegistry()


def get_registry() -> ConnectorRegistry:
    return _registry


def _register_defaults() -> None:
    from data_connectors.yfinance_conn.connector import YFinanceConnector
    from data_connectors.justetf_conn.connector import JustETFConnector
    from data_connectors.justetf_discovery.connector import JustETFDiscoveryConnector

    _registry.register(YFinanceConnector())
    _registry.register(JustETFConnector())
    _registry.register(JustETFDiscoveryConnector())


_register_defaults()
