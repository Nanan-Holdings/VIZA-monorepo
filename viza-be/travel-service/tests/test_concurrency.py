"""Concurrency contracts for shared travel-service provider work."""

from __future__ import annotations

import asyncio
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Event
import unittest
from unittest.mock import patch

from fastapi import BackgroundTasks
import main
from main import _export_to_file
from tools import openai_client
from tools import export_admission
from tools import flights
from tools.hotels import _destination_cache, _destination_inflight, _resolve_destination


class TravelConcurrencyTests(unittest.TestCase):
    def tearDown(self):
        flights._destination_id_cache.clear()
        flights._destination_id_inflight.clear()
        _destination_cache.clear()
        _destination_inflight.clear()
        openai_client._openai_semaphore = None
        openai_client._openai_semaphore_loop = None
        openai_client._openai_waiters = 0
        openai_client._openai_waiters_loop = None
        export_admission._export_semaphore = None
        export_admission._export_semaphore_loop = None
        export_admission._export_waiters = 0
        export_admission._export_waiters_loop = None

    def test_concurrent_hotel_cache_misses_share_one_destination_lookup(self):
        calls = 0
        lookup_started = asyncio.Event()
        release_lookup = asyncio.Event()

        async def provider_payload(_path, _params):
            nonlocal calls
            calls += 1
            lookup_started.set()
            await release_lookup.wait()
            return {
                "status": True,
                "data": [{"dest_id": "DEST_TYO", "search_type": "city"}],
            }

        async def run_lookups():
            tasks = [
                asyncio.create_task(_resolve_destination("Tokyo"))
                for _ in range(6)
            ]
            await lookup_started.wait()
            release_lookup.set()
            return await asyncio.gather(*tasks)

        with patch("tools.hotels._request_json", new=provider_payload):
            results = asyncio.run(run_lookups())

        self.assertEqual(results, [("DEST_TYO", "city")] * 6)
        self.assertEqual(calls, 1)

    def test_cancelled_flight_waiter_does_not_cancel_shared_lookup(self):
        calls = 0
        lookup_started = asyncio.Event()
        release_lookup = asyncio.Event()

        async def provider_payload(_path, _params):
            nonlocal calls
            calls += 1
            lookup_started.set()
            await release_lookup.wait()
            return {
                "status": True,
                "data": [{"id": "CITY_TYO", "cityName": "Tokyo"}],
            }

        async def run_lookup():
            cancelled_waiter = asyncio.create_task(
                flights._resolve_destination_id("Tokyo")
            )
            surviving_waiter = asyncio.create_task(
                flights._resolve_destination_id("Tokyo")
            )
            await lookup_started.wait()
            cancelled_waiter.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await cancelled_waiter
            release_lookup.set()
            return await surviving_waiter

        with patch("tools.flights._request_json", new=provider_payload):
            result = asyncio.run(run_lookup())

        self.assertEqual(result, "CITY_TYO")
        self.assertEqual(calls, 1)

    def test_all_cancelled_flight_waiters_expire_and_key_can_retry(self):
        calls = 0
        lookup_started = asyncio.Event()

        async def provider_payload(_path, _params):
            nonlocal calls
            calls += 1
            if calls == 1:
                lookup_started.set()
                await asyncio.sleep(1)
            return {
                "status": True,
                "data": [{"id": "CITY_TYO", "cityName": "Tokyo"}],
            }

        async def run_lookup_and_retry():
            waiter = asyncio.create_task(flights._resolve_destination_id("Tokyo"))
            await lookup_started.wait()
            waiter.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await waiter
            await asyncio.sleep(0.05)
            self.assertNotIn("tokyo", flights._destination_id_inflight)
            return await flights._resolve_destination_id("Tokyo")

        with (
            patch("tools.flights._request_json", new=provider_payload),
            patch.object(flights, "DESTINATION_LOOKUP_DEADLINE_SECONDS", 0.01),
        ):
            result = asyncio.run(run_lookup_and_retry())

        self.assertEqual(result, "CITY_TYO")
        self.assertEqual(calls, 2)

    def test_destination_lookup_saturation_returns_fallback_signal(self):
        release_lookup = asyncio.Event()
        lookup_started = asyncio.Event()

        async def provider_payload(_path, _params):
            lookup_started.set()
            await release_lookup.wait()
            return {
                "status": True,
                "data": [{"id": "CITY_TYO", "cityName": "Tokyo"}],
            }

        async def run_lookups():
            first = asyncio.create_task(flights._resolve_destination_id("Tokyo"))
            await lookup_started.wait()
            saturated = await flights._resolve_destination_id("Paris")
            release_lookup.set()
            return saturated, await first

        with (
            patch("tools.flights._request_json", new=provider_payload),
            patch.object(flights, "DESTINATION_LOOKUP_MAX_INFLIGHT", 1),
        ):
            saturated, first = asyncio.run(run_lookups())

        self.assertIsNone(saturated)
        self.assertEqual(first, "CITY_TYO")

    def test_openai_request_slots_bound_parallel_work(self):
        previous_limit = openai_client.OPENAI_REQUEST_CONCURRENCY
        openai_client.OPENAI_REQUEST_CONCURRENCY = 2

        async def run_work():
            active = 0
            maximum_active = 0

            async def worker():
                nonlocal active, maximum_active
                async with openai_client.openai_request_slot():
                    active += 1
                    maximum_active = max(maximum_active, active)
                    await asyncio.sleep(0)
                    await asyncio.sleep(0)
                    active -= 1

            await asyncio.gather(*(worker() for _ in range(8)))
            return maximum_active

        try:
            maximum_active = asyncio.run(run_work())
        finally:
            openai_client.OPENAI_REQUEST_CONCURRENCY = previous_limit

        self.assertEqual(maximum_active, 2)

    def test_cancelled_openai_request_releases_slot(self):
        previous_limit = openai_client.OPENAI_REQUEST_CONCURRENCY
        openai_client.OPENAI_REQUEST_CONCURRENCY = 1

        async def run_work():
            entered = asyncio.Event()

            async def blocked_worker():
                async with openai_client.openai_request_slot():
                    entered.set()
                    await asyncio.Future()

            blocked = asyncio.create_task(blocked_worker())
            await entered.wait()
            blocked.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await blocked

            acquired = asyncio.Event()

            async def next_worker():
                async with openai_client.openai_request_slot():
                    acquired.set()

            await asyncio.wait_for(next_worker(), timeout=0.1)
            return acquired.is_set()

        try:
            acquired = asyncio.run(run_work())
        finally:
            openai_client.OPENAI_REQUEST_CONCURRENCY = previous_limit

        self.assertTrue(acquired)

    def test_openai_admission_queue_is_bounded_and_times_out(self):
        previous_limit = openai_client.OPENAI_REQUEST_CONCURRENCY
        previous_waiters = openai_client.OPENAI_MAX_WAITERS
        previous_timeout = openai_client.OPENAI_ACQUIRE_TIMEOUT_SECONDS
        openai_client.OPENAI_REQUEST_CONCURRENCY = 1
        openai_client.OPENAI_MAX_WAITERS = 1
        openai_client.OPENAI_ACQUIRE_TIMEOUT_SECONDS = 0.01

        async def run_work():
            entered = asyncio.Event()
            release = asyncio.Event()

            async def holder():
                async with openai_client.openai_request_slot():
                    entered.set()
                    await release.wait()

            task = asyncio.create_task(holder())
            await entered.wait()

            async def queued():
                async with openai_client.openai_request_slot():
                    return True

            waiting = asyncio.create_task(queued())
            for _ in range(10):
                if openai_client._openai_waiters >= 1:
                    break
                await asyncio.sleep(0)
            self.assertEqual(openai_client._openai_waiters, 1)
            with self.assertRaises(openai_client.OpenAIAdmissionTimeout):
                await queued()
            with self.assertRaises(openai_client.OpenAIAdmissionTimeout):
                await waiting
            release.set()
            await task

        try:
            asyncio.run(run_work())
        finally:
            openai_client.OPENAI_REQUEST_CONCURRENCY = previous_limit
            openai_client.OPENAI_MAX_WAITERS = previous_waiters
            openai_client.OPENAI_ACQUIRE_TIMEOUT_SECONDS = previous_timeout

    def test_export_admission_is_bounded_and_releases_on_cancellation(self):
        previous_limit = export_admission.EXPORT_CONCURRENCY
        previous_waiters = export_admission.EXPORT_MAX_WAITERS
        previous_timeout = export_admission.EXPORT_ACQUIRE_TIMEOUT_SECONDS
        export_admission.EXPORT_CONCURRENCY = 1
        export_admission.EXPORT_MAX_WAITERS = 1
        export_admission.EXPORT_ACQUIRE_TIMEOUT_SECONDS = 0.01

        async def run_work():
            entered = asyncio.Event()
            release = asyncio.Event()

            async def holder():
                async with export_admission.export_request_slot():
                    entered.set()
                    await release.wait()

            task = asyncio.create_task(holder())
            await entered.wait()

            async def queued():
                async with export_admission.export_request_slot():
                    return True

            waiting = asyncio.create_task(queued())
            for _ in range(10):
                if export_admission._export_waiters >= 1:
                    break
                await asyncio.sleep(0)
            self.assertEqual(export_admission._export_waiters, 1)
            with self.assertRaises(export_admission.ExportAdmissionTimeout):
                await queued()
            with self.assertRaises(export_admission.ExportAdmissionTimeout):
                await waiting

            release.set()
            await task

            cancelled_entered = asyncio.Event()

            async def cancelled_worker():
                async with export_admission.export_request_slot():
                    cancelled_entered.set()
                    await asyncio.Future()

            cancelled = asyncio.create_task(cancelled_worker())
            await cancelled_entered.wait()
            cancelled.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await cancelled

            async with export_admission.export_request_slot():
                return True

        try:
            released = asyncio.run(run_work())
        finally:
            export_admission.EXPORT_CONCURRENCY = previous_limit
            export_admission.EXPORT_MAX_WAITERS = previous_waiters
            export_admission.EXPORT_ACQUIRE_TIMEOUT_SECONDS = previous_timeout

        self.assertTrue(released)

    def test_cancelled_export_cleans_file_created_by_late_thread(self):
        with TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "late-export.bin"
            worker_started = Event()
            worker_completed = Event()
            cleanup_called = Event()
            release_worker = Event()

            def blocking_export(_itinerary, _payload):
                worker_started.set()
                release_worker.wait(2)
                output_path.write_text("export", encoding="utf-8")
                worker_completed.set()
                return str(output_path)

            original_cleanup = main._cleanup_completed_export

            def cleanup_and_mark(task):
                original_cleanup(task)
                cleanup_called.set()

            async def run_export():
                background_tasks = BackgroundTasks()
                task = asyncio.create_task(
                    _export_to_file(blocking_export, [], {}, background_tasks)
                )
                self.assertTrue(await asyncio.to_thread(worker_started.wait, 1))
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task
                release_worker.set()
                worker_finished = await asyncio.to_thread(worker_completed.wait, 1)
                cleanup_finished = await asyncio.to_thread(cleanup_called.wait, 1)
                return worker_finished, cleanup_finished, output_path.exists()

            with patch("main._cleanup_completed_export", new=cleanup_and_mark):
                worker_finished, cleanup_finished, exists_after_cancellation = asyncio.run(
                    run_export()
                )

        self.assertTrue(worker_finished)
        self.assertTrue(cleanup_finished)
        self.assertFalse(exists_after_cancellation)

    def test_cancelled_export_keeps_slot_until_worker_finishes(self):
        previous_limit = export_admission.EXPORT_CONCURRENCY
        previous_waiters = export_admission.EXPORT_MAX_WAITERS
        previous_timeout = export_admission.EXPORT_ACQUIRE_TIMEOUT_SECONDS
        export_admission.EXPORT_CONCURRENCY = 1
        export_admission.EXPORT_MAX_WAITERS = 1
        export_admission.EXPORT_ACQUIRE_TIMEOUT_SECONDS = 1

        with TemporaryDirectory() as temp_dir:
            first_path = Path(temp_dir) / "first-export.bin"
            second_path = Path(temp_dir) / "second-export.bin"
            first_started = Event()
            first_completed = Event()
            release_first = Event()
            second_started_early = Event()

            def first_export(_itinerary, _payload):
                first_started.set()
                release_first.wait(2)
                first_path.write_text("first", encoding="utf-8")
                first_completed.set()
                return str(first_path)

            def second_export(_itinerary, _payload):
                if not first_completed.is_set():
                    second_started_early.set()
                    raise AssertionError("second export started before first completed")
                second_path.write_text("second", encoding="utf-8")
                return str(second_path)

            async def run_exports():
                second_acquire_attempted = asyncio.Event()
                second_acquire_returned = asyncio.Event()

                class TrackingSemaphore(asyncio.Semaphore):
                    acquire_calls = 0

                    async def acquire(self):
                        self.acquire_calls += 1
                        is_second_call = self.acquire_calls == 2
                        if is_second_call:
                            second_acquire_attempted.set()
                        acquired = await super().acquire()
                        if is_second_call:
                            second_acquire_returned.set()
                        return acquired

                semaphore = TrackingSemaphore(1)
                first_background = BackgroundTasks()
                with patch.object(
                    export_admission,
                    "_get_export_semaphore",
                    return_value=semaphore,
                ):
                    first_task = asyncio.create_task(
                        _export_to_file(first_export, [], {}, first_background)
                    )
                    self.assertTrue(await asyncio.to_thread(first_started.wait, 1))
                    first_task.cancel()
                    with self.assertRaises(asyncio.CancelledError):
                        await first_task

                    second_background = BackgroundTasks()
                    second_task = asyncio.create_task(
                        _export_to_file(second_export, [], {}, second_background)
                    )
                    self.assertTrue(
                        await asyncio.wait_for(second_acquire_attempted.wait(), 1)
                    )
                    self.assertFalse(second_acquire_returned.is_set())
                    self.assertFalse(second_started_early.is_set())

                    release_first.set()
                    self.assertTrue(await asyncio.to_thread(first_completed.wait, 1))
                    second_result = await second_task
                    await second_background()
                    return second_result, second_started_early.is_set()

            try:
                second_result, started_early = asyncio.run(run_exports())
            finally:
                export_admission.EXPORT_CONCURRENCY = previous_limit
                export_admission.EXPORT_MAX_WAITERS = previous_waiters
                export_admission.EXPORT_ACQUIRE_TIMEOUT_SECONDS = previous_timeout

        self.assertFalse(started_early)
        self.assertEqual(second_result, str(second_path))
        self.assertFalse(second_path.exists())

    def test_successful_export_registers_background_cleanup(self):
        with TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "export.bin"

            def quick_export(_itinerary, _payload):
                output_path.write_text("export", encoding="utf-8")
                return str(output_path)

            async def run_export():
                background_tasks = BackgroundTasks()
                result = await _export_to_file(
                    quick_export,
                    [],
                    {},
                    background_tasks,
                )
                exists_before_background = Path(result).exists()
                await background_tasks()
                return exists_before_background, output_path.exists()

            exists_before_background, exists_after_background = asyncio.run(run_export())

        self.assertTrue(exists_before_background)
        self.assertFalse(exists_after_background)


if __name__ == "__main__":
    unittest.main()
