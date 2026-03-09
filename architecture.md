# Architecture

## Overview

ETF IQ is a full-stack financial intelligence platform composed of two independently deployable containers — a **React frontend** and a **Python API backend** — backed by a **PostgreSQL** database. Authentication is handled centrally via **Auth0 passwordless email OTP**, with internal JWT signing for API-to-API trust.

---

## Repository Structure

```
ETF_IQ/
├── frontend/                  # React 18 SPA
├── unified-api/               # FastAPI backend
├── db/
│   └── init.sql               # Static PostgreSQL schema
├── data-connectors/           # Pluggable data-connector modules (see below)
├── docker-compose.yml
└── architecture.md
```

---

## Frontend

| Concern        | Technology                              |
|----------------|-----------------------------------------|
| Runtime        | Node 20, TypeScript                     |
| Build tool     | Vite 6                                  |
| UI framework   | React 18                                |
| Styling        | Tailwind CSS 3                          |
| Components     | Radix UI / shadcn-style components      |
| Server state   | TanStack React Query                    |
| Charts         | lightweight-charts v5 (interactive), Recharts |
| Auth           | Auth0 passwordless email OTP + JWT decode |

### Key conventions

- All API calls go through a single React Query client configured with the Auth0 access token as a Bearer header.
- Chart data (price series, indicators) uses **lightweight-charts v5**; aggregated/comparative charts use **Recharts**.
- shadcn-style components are local copies under `frontend/src/components/ui/`, not an external package.

---

## Unified API (`unified-api/`)

| Concern        | Technology                                    |
|----------------|-----------------------------------------------|
| Runtime        | Python 3.11                                   |
| Framework      | FastAPI + Uvicorn                             |
| LLM            | Google Gemini (`google-genai`)                |
| ORM            | SQLAlchemy 2.0 async + asyncpg                |
| Migrations     | Alembic                                       |
| Auth           | Auth0 (passwordless email OTP) + internal HS256 JWT |

### LLM surface

Four Gemini-backed functions exposed as API endpoints:

| Function          | Description                                  |
|-------------------|----------------------------------------------|
| `chat()`          | General conversational LLM query             |
| `search_chat()`   | LLM query augmented with live search         |
| `url_chat()`      | LLM query grounded on a supplied URL         |
| `deep_research()` | Multi-step agentic research pipeline         |

---

## Database

**PostgreSQL 15** — schema defined statically in `db/init.sql`.

### Tables

| Table                | Purpose                                      |
|----------------------|----------------------------------------------|
| `domains`            | Tenant / domain isolation                    |
| `users`              | User accounts, role, domain membership       |
| `pipeline_runs`      | Execution records for research pipelines     |
| `agent_results`      | LLM / agent output per pipeline step         |
| `news_events`        | Ingested news items linked to instruments    |
| `uploaded_documents` | User-uploaded files (PDF, CSV, etc.)         |
| `reports`            | Generated research reports                   |
| `price_data`         | OHLCV time-series data                       |

### Role hierarchy

```
super_admin > admin > user
```

---

## Data-Connector Flow

Data connectors are isolated, pluggable modules under `data-connectors/`. Every future external data source (market data vendors, news APIs, macro feeds, etc.) must implement this interface:

```
data-connectors/
└── <connector-name>/
    ├── connector.py        # Implements BaseConnector
    ├── models.py           # Pydantic schemas for source data
    ├── tests/
    └── README.md
```

### `BaseConnector` contract

```python
class BaseConnector(ABC):
    name: str                          # unique connector identifier
    async def fetch(self, **params) -> list[dict]:  ...
    async def normalize(self, raw: list[dict]) -> list[dict]: ...
    async def ingest(self, **params) -> None: ...  # fetch → normalize → upsert to DB
```

The unified API schedules or triggers connectors via an internal `ConnectorRegistry`. New APIs are registered there — no changes to core API routes are required.

---

## Authentication Flow

```
User → Auth0 (email OTP) → Auth0 access token (JWT)
                                  │
                     ┌────────────▼────────────┐
                     │       Frontend           │
                     │  React Query + Bearer    │
                     └────────────┬────────────┘
                                  │ HTTPS
                     ┌────────────▼────────────┐
                     │      Unified API         │
                     │  Verify Auth0 JWT        │
                     │  Issue internal HS256    │
                     │  JWT for service calls   │
                     └─────────────────────────┘
```

---

## Container Architecture

Each layer is built as its own mini-container. Both containers are versioned and deployable independently.

### `docker-compose.yml` services

| Service        | Image / Build context | Exposed port |
|----------------|-----------------------|--------------|
| `frontend`     | `frontend/`           | 5173 (dev) / 80 (prod) |
| `unified-api`  | `unified-api/`        | 8000         |
| `postgres`     | `postgres:15`         | 5432 (internal) |

### Frontend Dockerfile (outline)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build          # vite build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

### Unified API Dockerfile (outline)

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Request Lifecycle (end-to-end)

```
Browser
  └─► React Query (Bearer token)
        └─► FastAPI route
              ├─► Auth0 JWT validation
              ├─► SQLAlchemy async session (PostgreSQL)
              ├─► ConnectorRegistry.ingest() [if data needed]
              └─► Gemini LLM [if AI feature]
                    └─► Response streamed back to React
```
