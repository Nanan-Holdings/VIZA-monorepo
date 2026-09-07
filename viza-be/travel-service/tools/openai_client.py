"""Shared OpenAI request backpressure for the travel service.

The chat, itinerary, revision, and export endpoints all use the same upstream
provider.  A process-wide semaphore keeps a burst of browser requests from
creating an unbounded number of in-flight OpenAI calls while preserving the
existing per-request timeout and fallback behavior in their callers. Requests
that cannot enter the bounded admission queue promptly fail into those
existing fallbacks.
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from pathlib import Path

from dotenv import load_dotenv


load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def _env_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


OPENAI_REQUEST_CONCURRENCY = min(_env_int("TRAVEL_OPENAI_CONCURRENCY", 8), 64)
OPENAI_MAX_WAITERS = min(_env_int("TRAVEL_OPENAI_MAX_WAITERS", 32), 256)
OPENAI_ACQUIRE_TIMEOUT_SECONDS = min(
    _env_float("TRAVEL_OPENAI_ACQUIRE_TIMEOUT_SECONDS", 5.0),
    30.0,
)
_openai_semaphore: asyncio.Semaphore | None = None
_openai_semaphore_loop: asyncio.AbstractEventLoop | None = None
_openai_waiters = 0
_openai_waiters_loop: asyncio.AbstractEventLoop | None = None


class OpenAIAdmissionTimeout(TimeoutError):
    """Raised when an OpenAI request cannot enter the bounded queue."""


def _get_openai_semaphore() -> asyncio.Semaphore:
    global _openai_semaphore, _openai_semaphore_loop
    global _openai_waiters, _openai_waiters_loop

    running_loop = asyncio.get_running_loop()
    if _openai_semaphore is None or _openai_semaphore_loop is not running_loop:
        _openai_semaphore = asyncio.Semaphore(OPENAI_REQUEST_CONCURRENCY)
        _openai_semaphore_loop = running_loop
        _openai_waiters = 0
        _openai_waiters_loop = running_loop
    return _openai_semaphore


@asynccontextmanager
async def openai_request_slot() -> AsyncIterator[None]:
    """Hold one shared OpenAI request slot until the caller finishes.

    The context manager deliberately does not catch cancellation.  A request
    deadline or server shutdown must release the slot and propagate the
    cancellation to the endpoint instead of leaving orphaned provider work.
    """

    global _openai_waiters, _openai_waiters_loop

    semaphore = _get_openai_semaphore()
    running_loop = asyncio.get_running_loop()
    if _openai_waiters_loop is not running_loop:
        _openai_waiters = 0
        _openai_waiters_loop = running_loop
    if _openai_waiters >= OPENAI_MAX_WAITERS:
        raise OpenAIAdmissionTimeout("OpenAI admission queue is full")

    _openai_waiters += 1
    acquired = False
    try:
        try:
            acquired = await asyncio.wait_for(
                semaphore.acquire(),
                timeout=OPENAI_ACQUIRE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise OpenAIAdmissionTimeout(
                "OpenAI admission slot was not available before the queue deadline"
            ) from exc
    finally:
        # The semaphore tracks active calls; this counter only tracks callers
        # waiting to acquire a slot, so active requests do not consume queue
        # capacity.
        _openai_waiters -= 1

    try:
        yield
    finally:
        if acquired:
            semaphore.release()
