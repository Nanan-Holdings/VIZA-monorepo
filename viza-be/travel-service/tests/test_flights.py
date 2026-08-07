"""Regression tests for provider-backed flight search.

The tests intentionally stub the provider calls: live RapidAPI availability is
an external deployment concern, while the important contract here is that an
unavailable provider is never represented as a real airline quote.
"""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

from tools.flights import (
    _destination_id_cache,
    _fallback_flights,
    _resolve_destination_id,
    search_flights,
)


class FlightProviderContractTests(unittest.TestCase):
    def tearDown(self):
        _destination_id_cache.clear()

    def test_fallback_is_explicitly_estimated_and_has_no_carrier(self):
        options = _fallback_flights("广州", "东京", "2026-10-05")

        self.assertEqual(len(options), 2)
        for option in options:
            self.assertTrue(option["estimated"])
            self.assertEqual(option["provider_status"], "unavailable")
            self.assertEqual(option["provider"], "unavailable-estimate")
            self.assertEqual(option["airline"], "待确认航司")
            self.assertIsNone(option["flight_number"])
            self.assertIn("不可预订", option["provider_message"])

    def test_destination_failure_returns_marked_estimates(self):
        async def no_destination(_query):
            return None

        with patch("tools.flights._resolve_destination_id", new=no_destination):
            options = asyncio.run(
                search_flights("广州", "东京", "2026-10-05", adults=1)
            )

        self.assertTrue(options)
        self.assertTrue(all(option["estimated"] for option in options))
        self.assertTrue(
            all(option["provider_reason"] == "destination_unresolved" for option in options)
        )

    def test_provider_offer_is_not_marked_as_estimate(self):
        async def destination_id(query):
            return {"广州": "CITY_GZ", "东京": "CITY_TYO"}[query]

        async def provider_payload(_path, _params):
            return {
                "status": True,
                "data": {
                    "flightOffers": [
                        {
                            "token": "offer-token",
                            "priceBreakdown": {
                                "total": {
                                    "units": 1200,
                                    "nanos": 0,
                                    "currencyCode": "CNY",
                                }
                            },
                            "segments": [
                                {
                                    "departureTime": "2026-10-05T08:00:00",
                                    "arrivalTime": "2026-10-05T12:00:00",
                                    "totalTime": 14400,
                                    "departureAirport": {"name": "广州白云", "code": "CAN"},
                                    "arrivalAirport": {"name": "东京成田", "code": "NRT"},
                                    "legs": [
                                        {
                                            "carriersData": [{"name": "测试航空", "code": "TA"}],
                                            "cabinClass": "ECONOMY",
                                            "flightInfo": {"flightNumber": "TA123"},
                                        }
                                    ],
                                }
                            ],
                        }
                    ]
                },
            }

        with (
            patch("tools.flights._resolve_destination_id", new=destination_id),
            patch("tools.flights._request_json", new=provider_payload),
        ):
            options = asyncio.run(
                search_flights("广州", "东京", "2026-10-05", adults=1)
            )

        self.assertEqual(len(options), 1)
        self.assertFalse(options[0].get("estimated", False))
        self.assertEqual(options[0]["provider"], "rapidapi-booking-com")
        self.assertEqual(options[0]["airline"], "测试航空")
        self.assertEqual(options[0]["flight_number"], "TA123")

    def test_destination_ids_are_cached_after_a_successful_lookup(self):
        calls = 0

        async def provider_payload(_path, _params):
            nonlocal calls
            calls += 1
            return {
                "status": True,
                "data": [{"id": "CITY_DPS", "cityName": "Bali"}],
            }

        with patch("tools.flights._request_json", new=provider_payload):
            first = asyncio.run(_resolve_destination_id("Bali"))
            second = asyncio.run(_resolve_destination_id("Bali"))

        self.assertEqual(first, "CITY_DPS")
        self.assertEqual(second, "CITY_DPS")
        self.assertEqual(calls, 1)


if __name__ == "__main__":
    unittest.main()
