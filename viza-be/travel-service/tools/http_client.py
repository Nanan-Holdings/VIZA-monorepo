"""Shared bounded async HTTP client for travel-service integrations.

The travel service talks to third-party providers from several request paths.
Keeping one client (and one small request semaphore) avoids creating an unbounded
number of sockets while the explicit phase timeouts ensure a provider cannot
hold a FastAPI worker forever.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any

import httpx


def _env_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


RAPIDAPI_CONNECT_TIMEOUT_SECONDS = _env_float("RAPIDAPI_CONNECT_TIMEOUT_SECONDS", 5.0)
RAPIDAPI_READ_TIMEOUT_SECONDS = _env_float("RAPIDAPI_READ_TIMEOUT_SECONDS", 15.0)
RAPIDAPI_WRITE_TIMEOUT_SECONDS = _env_float("RAPIDAPI_WRITE_TIMEOUT_SECONDS", 5.0)
RAPIDAPI_POOL_TIMEOUT_SECONDS = _env_float("RAPIDAPI_POOL_TIMEOUT_SECONDS", 5.0)
RAPIDAPI_MAX_CONNECTIONS = _env_int("RAPIDAPI_MAX_CONNECTIONS", 20)
RAPIDAPI_MAX_KEEPALIVE_CONNECTIONS = min(
    _env_int("RAPIDAPI_MAX_KEEPALIVE_CONNECTIONS", 10),
    RAPIDAPI_MAX_CONNECTIONS,
)
RAPIDAPI_REQUEST_CONCURRENCY = _env_int("RAPIDAPI_REQUEST_CONCURRENCY", 8)
RAPIDAPI_RATE_LIMIT_RETRY_SECONDS = _env_float(
    "RAPIDAPI_RATE_LIMIT_RETRY_SECONDS", 1.0
)

REQUEST_TIMEOUT = httpx.Timeout(
    connect=RAPIDAPI_CONNECT_TIMEOUT_SECONDS,
    read=RAPIDAPI_READ_TIMEOUT_SECONDS,
    write=RAPIDAPI_WRITE_TIMEOUT_SECONDS,
    pool=RAPIDAPI_POOL_TIMEOUT_SECONDS,
)
CLIENT_LIMITS = httpx.Limits(
    max_connections=RAPIDAPI_MAX_CONNECTIONS,
    max_keepalive_connections=RAPIDAPI_MAX_KEEPALIVE_CONNECTIONS,
)

_client: httpx.AsyncClient | None = None
_client_loop: asyncio.AbstractEventLoop | None = None
_request_semaphore: asyncio.Semaphore | None = None
_request_semaphore_loop: asyncio.AbstractEventLoop | None = None


async def get_http_client() -> httpx.AsyncClient:
    """Return the process-shared AsyncClient, creating it lazily when needed."""

    global _client, _client_loop
    running_loop = asyncio.get_running_loop()
    if (
        _client is not None
        and not _client.is_closed
        and _client_loop is not None
        and _client_loop is not running_loop
    ):
        await _client.aclose()
        _client = None

    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT, limits=CLIENT_LIMITS)
        _client_loop = running_loop
    return _client


def _get_request_semaphore() -> asyncio.Semaphore:
    global _request_semaphore, _request_semaphore_loop
    running_loop = asyncio.get_running_loop()
    if _request_semaphore is None or _request_semaphore_loop is not running_loop:
        _request_semaphore = asyncio.Semaphore(RAPIDAPI_REQUEST_CONCURRENCY)
        _request_semaphore_loop = running_loop
    return _request_semaphore


async def request_json(
    url: str,
    *,
    params: dict[str, Any],
    headers: dict[str, str],
) -> Any:
    """GET JSON under the shared semaphore and bounded phase timeouts.

    Provider failures intentionally become ``None`` so callers can use their
    deterministic fallback payloads. Cancellation is not swallowed, allowing
    FastAPI request deadlines and graceful shutdown to work as expected.
    """

    client = await get_http_client()
    async with _get_request_semaphore():
        for attempt in range(2):
            try:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 429 and attempt == 0:
                    retry_after = exc.response.headers.get("retry-after")
                    try:
                        delay = float(retry_after) if retry_after else RAPIDAPI_RATE_LIMIT_RETRY_SECONDS
                    except (TypeError, ValueError):
                        delay = RAPIDAPI_RATE_LIMIT_RETRY_SECONDS
                    await asyncio.sleep(max(0.1, min(delay, 2.0)))
                    continue
                print(f"Travel provider request failed ({url}):", exc)
                return None
            except Exception as exc:
                print(f"Travel provider request failed ({url}):", exc)
                return None
    return None


async def close_http_client() -> None:
    """Close the shared client during application shutdown."""

    global _client, _client_loop, _request_semaphore, _request_semaphore_loop
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
    _client_loop = None
    _request_semaphore = None
    _request_semaphore_loop = None
