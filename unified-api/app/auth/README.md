# Auth Module — `unified-api/app/auth/`

Authentication and authorization for the PortfolioIQ backend. Uses **Auth0 passwordless email OTP** as the identity provider and issues **internal HS256 JWTs** for session management.

---

## Architecture Overview

```
Browser                        Backend                              External
───────                        ───────                              ────────
                               ┌──────────────┐
  POST /auth/.../start ──────► │  router.py   │──► Auth0 /passwordless/start
                               │              │         (sends OTP email)
  POST /auth/.../verify ─────► │              │──► Auth0 /oauth/token
                               │              │         (verifies OTP, returns id_token)
                               │              │
                               │  ┌───────────┤
                               │  │ auth0.py   │  RS256 id_token validation (JWKS)
                               │  │ jwt.py     │  HS256 internal JWT create/decode
                               │  └───────────┤
                               │              │
  (HttpOnly cookie) ◄──────────│  set cookies │
                               └──────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
           ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
           │ token_block-  │  │ otp_limiter  │  │   audit.py   │
           │  list.py      │  │    .py       │  │              │
           │ (Redis)       │  │ (Redis)      │  │ (stdout + DB)│
           └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Module Files

| File | Purpose |
|---|---|
| `router.py` | FastAPI router — `/auth` endpoints (start, verify, refresh, get-auth-role, logout) |
| `auth0.py` | Auth0 API client — passwordless OTP start/verify, RS256 id_token validation with JWKS caching |
| `jwt.py` | Internal HS256 JWT — `create_access_token()` and `decode_token()` for session tokens |
| `jwt_utils.py` | Internal HS256 JWT — `create_internal_token()` and `verify_internal_token()` for service-to-service calls |
| `dependencies.py` | FastAPI dependencies — `get_current_user`, `require_role(min_role)`, `RequireAuth`, `verify_portfolio_owner` |
| `token_blocklist.py` | Redis-backed token revocation — `block_token(jti, ttl)` and `is_token_blocked(jti)` |
| `otp_limiter.py` | Redis sliding-window rate limiter — per-email limits on `/start` and `/verify` |
| `audit.py` | Security audit logger — structured JSON events to stdout, optionally persisted to DB |
| `auth0_management.py` | Auth0 Management API v2 async client — admin CRUD (create, disable, enable, lookup users) |

---

## Auth Flow

### 1. Login (Passwordless OTP)

```
User enters email
  → POST /auth/login/passwordless/start
    → check_start_rate_limit (3/hour per email)
    → Auth0 sends 6-digit OTP to email

User enters OTP
  → POST /auth/login/passwordless/verify
    → check_otp_rate_limit (5/10min per email)
    → Auth0 verifies OTP, returns RS256 id_token
    → _decode_auth0_token: validate RS256 signature via JWKS, verify audience + issuer
    → Lookup user by email in local DB (allowlist model — email must exist and is_active=true)
    → Link auth0_id on first login
    → Issue internal HS256 JWT via create_access_token()
    → Set cookies: access_token (HttpOnly) + access_token_js (JS-readable user info)
    → Reset OTP rate limit counter
    → Log LOGIN_SUCCESS audit event
```

### 2. Token Refresh

```
POST /auth/refresh
  → Validate existing access_token cookie
  → Revoke old token (block jti in Redis with remaining TTL)
  → Issue new HS256 JWT
  → Set fresh cookies
  → Log TOKEN_REFRESH audit event
```

### 3. Logout

```
POST /auth/logout
  → Parse token claims (unverified — only need jti + exp for revocation)
  → Block jti in Redis with remaining TTL
  → Delete access_token and access_token_js cookies
  → Log LOGOUT audit event
```

### 4. Authenticated Requests

```
Any protected endpoint (via Depends(get_current_user))
  → Read access_token cookie
  → decode_token: verify HS256 signature, issuer, expiry
  → Check jti exists and is not in Redis blocklist
  → Lookup user in DB, verify is_active=true
  → Return User ORM object
```

---

## Security Features

### Token Revocation (Redis Blocklist)

- On logout and token refresh, the token's `jti` (unique ID) is written to Redis with a TTL matching the token's remaining lifetime
- Every authenticated request checks `is_token_blocked(jti)` before granting access
- Keys auto-expire from Redis — no background cleanup needed
- **Fails open** if Redis is unavailable (logs a warning; Auth0's server-side limits are the last line of defence)

### OTP Rate Limiting

Two independent sliding-window limits using Redis sorted sets:

| Endpoint | Window | Max Attempts | Purpose |
|---|---|---|---|
| `/start` | 1 hour | 3 per email | Prevents inbox spam |
| `/verify` | 10 minutes | 5 per email | Prevents OTP brute-force |

Rate limit counters are reset on successful login. If Redis is unavailable, limits fail open.

### Algorithm Confusion Guard

Before any JWKS fetch, Auth0 id_tokens are checked:
- Reject `none`, `HS256`, `HS384`, `HS512` algorithms
- Only accept `RS256`
- Prevents algorithm confusion attacks where an attacker signs a token with HMAC using the public key

### JWKS Caching

- Auth0 public keys are cached for 1 hour (module-level)
- Uses `asyncio.Lock` to prevent thundering herd on concurrent refreshes
- Emergency key rotation: if a `kid` is not found, forces one cache refresh and retries

### Security Audit Logging

All security events are emitted as structured JSON to the `security.audit` logger:

| Event | Level | When |
|---|---|---|
| `LOGIN_SUCCESS` | INFO | Successful OTP verification |
| `LOGIN_FAILURE` | WARNING | Invalid OTP, missing email claim, email not in allowlist |
| `ACCOUNT_DISABLED` | WARNING | Login attempt on disabled account |
| `LOGOUT` | INFO | User logout |
| `TOKEN_REFRESH` | INFO | Token refresh |
| `OTP_RATE_LIMITED` | WARNING | OTP verify rate limit exceeded |
| `START_RATE_LIMITED` | WARNING | OTP start rate limit exceeded |
| `INVALID_ALGORITHM` | WARNING | Token with disallowed algorithm rejected |
| `TOKEN_REVOKED` | WARNING | Attempt to use a revoked token |

Set `PERSIST_AUDIT_LOG=true` to additionally write events to the `auth_audit_log` database table.

---

## Role Hierarchy

```
super_admin (level 2) > admin (level 1) > user (level 0)
```

Use `require_role("admin")` as a FastAPI dependency to enforce minimum role:

```python
from app.auth.dependencies import require_role

@router.post("/admin/action")
async def admin_action(user: User = Depends(require_role("admin"))):
    ...
```

---

## Cookies

Two cookies are set on login/refresh:

| Cookie | HttpOnly | Purpose |
|---|---|---|
| `access_token` | Yes | HS256 JWT — used by backend for authentication |
| `access_token_js` | No | JSON payload (`{id, email, role, username}`) — used by frontend `UserContext` |

Both cookies share the same `max_age` (derived from `ACCESS_TOKEN_EXPIRE_MINUTES`), `path=/`, `samesite=lax`, and `secure=true` in production.

---

## Auth0 Management API

`auth0_management.py` provides an async client for Auth0's Management API v2 (admin user operations). It is **not wired into any router** — import and call directly.

### Prerequisites

1. Create a **Machine to Machine** application in the Auth0 dashboard
2. Authorize it for the **Auth0 Management API** with scopes: `read:users`, `create:users`, `update:users`
3. Set `AUTH0_MGMT_CLIENT_ID` and `AUTH0_MGMT_CLIENT_SECRET` in your environment

### Available Functions

```python
from app.auth.auth0_management import (
    get_auth0_user,      # Fetch user by auth0_id
    create_auth0_user,   # Create passwordless email user
    disable_auth0_user,  # Block user in Auth0
    enable_auth0_user,   # Unblock user in Auth0
)
```

Management tokens are cached in-process with automatic refresh before expiry.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AUTH0_DOMAIN` | Yes | — | Auth0 tenant domain (e.g. `your-tenant.auth0.com`) |
| `AUTH0_CLIENT_ID` | Yes | — | Auth0 application client ID |
| `AUTH0_CLIENT_SECRET` | Yes | — | Auth0 application client secret |
| `AUTH0_AUDIENCE` | Yes | — | Auth0 API identifier |
| `AUTH0_MGMT_CLIENT_ID` | No | `""` | Auth0 Management API M2M client ID |
| `AUTH0_MGMT_CLIENT_SECRET` | No | `""` | Auth0 Management API M2M client secret |
| `JWT_SECRET_KEY` | Yes | — | HS256 signing secret (must override default) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `600` | Session duration (10 hours) |
| `REDIS_URL` | No | `""` | Redis connection URL |
| `USE_REDIS` | No | `false` | Enable Redis for blocklist + rate limiting |
| `PERSIST_AUDIT_LOG` | No | `false` | Write audit events to `auth_audit_log` table |

---

## Database

### `auth_audit_log` table (migration: `011_auth_security.py`)

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `event` | VARCHAR(50) | Event type (e.g. `LOGIN_SUCCESS`) |
| `email` | VARCHAR(255) | User email (nullable) |
| `user_id` | UUID | Internal user ID — no FK (survives user deletion) |
| `ip_address` | VARCHAR(45) | Client IP (supports IPv6) |
| `detail` | TEXT | Freeform context |
| `created_at` | TIMESTAMPTZ | Auto-set to `now()` |

Indexes: `(email, created_at)`, `(created_at)`

---

## Testing

Tests are in `unified-api/tests/auth/` with one test file per module:

```
tests/auth/
├── conftest.py              # Shared fixtures (mock settings, mock Redis, mock DB)
├── test_auth0.py            # Auth0 passwordless start/verify, JWKS, algorithm guard
├── test_router.py           # Full endpoint tests (start, verify, refresh, logout, get-auth-role)
├── test_jwt.py              # Internal JWT create/decode
├── test_jwt_utils.py        # Internal service-to-service JWT
├── test_dependencies.py     # get_current_user, require_role, verify_portfolio_owner
├── test_token_blocklist.py  # Redis blocklist block/check/fail-open
├── test_otp_limiter.py      # Sliding-window rate limits
└── test_audit.py            # Audit event logging + DB persistence
```

Run auth tests:

```bash
cd unified-api
python -m pytest tests/auth/ -v
```
