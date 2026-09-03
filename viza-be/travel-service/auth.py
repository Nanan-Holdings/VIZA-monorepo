"""Internal authentication and CORS configuration for the travel service.

The travel service drives paid upstream calls (OpenAI itinerary/chat, RapidAPI
flight/hotel search). It must not be an open relay. The frontend reaches it
server-to-server through the Next.js proxy (`lib/travel/backend.ts`), so the
mutating endpoints are gated behind a shared secret header rather than a user
session or cookie.

Two knobs, both env-driven:

- ``TRAVEL_SERVICE_TOKEN`` — when set, every mutating route requires a matching
  ``x-internal-token`` request header (constant-time compared). The Next.js
  proxy must send the same value (see the handoff note in the PR/report).
- ``TRAVEL_ALLOWED_ORIGINS`` — comma-separated browser origin allowlist for
  CORS. Defaults to the known production portal + marketing origins.
"""

from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException, status

INTERNAL_TOKEN_HEADER = "x-internal-token"

# Known production origins. Server-to-server proxy calls are not subject to
# CORS, so this only matters if a browser ever calls the service directly; the
# safe default is the real portal/marketing origins rather than "*".
DEFAULT_ALLOWED_ORIGINS = (
    "https://app.viza.it.com",
    "https://viza.it.com",
)

_warned_unconfigured = False


def _configured_token() -> str | None:
    token = os.getenv("TRAVEL_SERVICE_TOKEN", "").strip()
    return token or None


def allowed_origins() -> list[str]:
    """Return the CORS origin allowlist from the environment or the default."""

    raw = os.getenv("TRAVEL_ALLOWED_ORIGINS", "").strip()
    if raw:
        origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
        if origins:
            return origins
    return list(DEFAULT_ALLOWED_ORIGINS)


async def require_internal_auth(
    x_internal_token: str | None = Header(default=None),
) -> None:
    """FastAPI dependency guarding the mutating travel-service routes.

    When ``TRAVEL_SERVICE_TOKEN`` is configured the caller must present a
    matching ``x-internal-token`` header. When it is not configured the
    dependency fails open with a one-time warning so an as-yet-unconfigured
    deployment keeps serving its existing frontend proxy until ops rolls the
    shared secret out on both sides. Setting the env var flips the same code to
    fail closed with no further changes.
    """

    expected = _configured_token()
    if expected is None:
        global _warned_unconfigured
        if not _warned_unconfigured:
            print(
                "WARNING: TRAVEL_SERVICE_TOKEN is not set; travel-service "
                "mutating routes are UNAUTHENTICATED. Set TRAVEL_SERVICE_TOKEN "
                "here and send the matching 'x-internal-token' header from the "
                "frontend proxy to require the shared secret."
            )
            _warned_unconfigured = True
        return

    provided = (x_internal_token or "").strip()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid internal service token.",
        )
