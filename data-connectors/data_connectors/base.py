from abc import ABC, abstractmethod

from sqlalchemy.ext.asyncio import AsyncSession


class BaseConnector(ABC):
    """Every data connector must implement fetch, normalize, and ingest."""

    name: str

    @abstractmethod
    async def fetch(self, **params) -> list[dict]:
        """Pull raw data from the external source."""
        ...

    @abstractmethod
    async def normalize(self, raw: list[dict]) -> list[dict]:
        """Transform raw data into the target DB schema."""
        ...

    @abstractmethod
    async def ingest(self, session: AsyncSession, **params) -> None:
        """fetch -> normalize -> upsert to Postgres."""
        ...
