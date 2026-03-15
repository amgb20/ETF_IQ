from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from data_connectors.scheduler import start_scheduler, stop_scheduler


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


limiter = Limiter(key_func=_rate_limit_key, default_limits=["60/minute"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = await start_scheduler()
    yield
    await stop_scheduler(scheduler)


app = FastAPI(title="PortfolioIQ API", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

from app.auth.router import router as auth_router  # noqa: E402
from app.routers import portfolios, etfs, prices, admin, agent_outputs, events, alerts, chat, reports, users, analytics, notifications, onboarding  # noqa: E402

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


@app.get("/health")
async def health():
    return {"status": "ok"}
