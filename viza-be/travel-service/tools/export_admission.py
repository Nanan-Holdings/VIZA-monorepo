"""Bounded admission for CPU-heavy travel-plan exports.

Word and PDF generation runs in worker threads so it cannot block the
FastAPI event loop.  This module also limits how many export jobs may be
active or waiting before a caller receives a quick, retryable overload error.
"""

from __future__ import annotations

import asyncio
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
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


EXPORT_CONCURRENCY = min(_env_int("TRAVEL_EXPORT_CONCURRENCY", 2), 16)
EXPORT_MAX_WAITERS = min(_env_int("TRAVEL_EXPORT_MAX_WAITERS", 16), 64)
EXPORT_ACQUIRE_TIMEOUT_SECONDS = min(
    _env_float("TRAVEL_EXPORT_ACQUIRE_TIMEOUT_SECONDS", 5.0),
    30.0,
)
_export_semaphore: asyncio.Semaphore | None = None
_export_semaphore_loop: asyncio.AbstractEventLoop | None = None
_export_waiters = 0
_export_waiters_loop: asyncio.AbstractEventLoop | None = None


class ExportAdmissionTimeout(TimeoutError):
    """Raised when an export cannot enter the bounded admission queue."""


def _get_export_semaphore() -> asyncio.Semaphore:
    global _export_semaphore, _export_semaphore_loop
    global _export_waiters, _export_waiters_loop

    running_loop = asyncio.get_running_loop()
    if _export_semaphore is None or _export_semaphore_loop is not running_loop:
        _export_semaphore = asyncio.Semaphore(EXPORT_CONCURRENCY)
        _export_semaphore_loop = running_loop
        _export_waiters = 0
        _export_waiters_loop = running_loop
    return _export_semaphore


@asynccontextmanager
async def export_request_slot() -> AsyncIterator[None]:
    """Acquire one export slot while preserving cancellation safety."""

    global _export_waiters, _export_waiters_loop

    semaphore = _get_export_semaphore()
    running_loop = asyncio.get_running_loop()
    if _export_waiters_loop is not running_loop:
        _export_waiters = 0
        _export_waiters_loop = running_loop
    if _export_waiters >= EXPORT_MAX_WAITERS:
        raise ExportAdmissionTimeout("Export admission queue is full")

    _export_waiters += 1
    acquired = False
    try:
        try:
            acquired = await asyncio.wait_for(
                semaphore.acquire(),
                timeout=EXPORT_ACQUIRE_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as exc:
            raise ExportAdmissionTimeout(
                "Export admission slot was not available before the queue deadline"
            ) from exc
    finally:
        # The semaphore tracks active exports; this counter only tracks callers
        # waiting to acquire a slot.
        _export_waiters -= 1

    try:
        yield
    finally:
        if acquired:
            semaphore.release()
