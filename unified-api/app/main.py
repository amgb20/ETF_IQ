import logging
import sys
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from data_connectors.scheduler import start_scheduler, stop_scheduler
from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


# Fail fast on missing Auth0 credentials and validate Settings (JWT_SECRET_KEY is
# validated by the Pydantic field_validator in config.py and will raise on import
# if the default is still set).
def _check_secrets() -> None:
    from app.config import get_settings

    s = get_settings()
    if not s.AUTH0_DOMAIN or not s.AUTH0_CLIENT_ID or not s.AUTH0_CLIENT_SECRET:
        print(
            "FATAL: AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET must all be set.",
            file=sys.stderr,
        )
        sys.exit(1)


_check_secrets()


def _rate_limit_key(request: Request) -> str:
    token = request.cookies.get("access_token")
    if token:
        try:
            from jose import jwt

            payload = jwt.get_unverified_claims(token)
            return payload.get("sub", get_remote_address(request))
        except Exception:
            pass
    return get_remote_address(request)


def _build_limiter():
    from app.config import get_settings

    settings = get_settings()
    if settings.USE_REDIS and settings.REDIS_URL:
        return Limiter(
            key_func=_rate_limit_key,
            default_limits=["60/minute"],
            storage_uri=settings.REDIS_URL,
        )
    return Limiter(key_func=_rate_limit_key, default_limits=["60/minute"])


limiter = _build_limiter()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = await start_scheduler()
    yield
    await stop_scheduler(scheduler)


app = FastAPI(title="PortfolioIQ API", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.auth.router import router as auth_router  # noqa: E402
from app.routers import (  # noqa: E402
    admin,
    agent_outputs,
    alerts,
    analytics,
    chat,
    etfs,
    events,
    meta,
    notifications,
    onboarding,
    portfolios,
    prices,
    reports,
    users,
)

app.include_router(auth_router)
app.include_router(portfolios.router)
app.include_router(etfs.router)
app.include_router(prices.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(agent_outputs.router)
app.include_router(events.router)
app.include_router(alerts.router)
app.include_router(chat.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(notifications.router)
app.include_router(onboarding.router)
app.include_router(meta.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
