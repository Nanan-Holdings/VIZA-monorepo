"""Contract tests for truthful SerpApi travel result normalization."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

from tools.serpapi import _location_cache, search_serpapi_flights, search_serpapi_hotels


class SerpApiProviderTests(unittest.TestCase):
    def tearDown(self):
        _location_cache.clear()

    def test_flight_offer_is_normalized_without_invented_fields(self):
        responses = {
            "google_flights_autocomplete": [
                {"suggestions": [{"id": "/m/origin"}]},
                {"suggestions": [{"id": "/m/destination"}]},
            ],
            "google_flights": [{"best_flights": [{
                "price": 888,
                "total_duration": 420,
                "booking_token": "token",
                "flights": [{
                    "departure_airport": {"name": "Changi", "id": "SIN", "time": "2026-10-05 08:00"},
                    "arrival_airport": {"name": "Haneda", "id": "HND", "time": "2026-10-05 15:00"},
                    "airline": "Test Air",
                    "flight_number": "TA 123",
                    "travel_class": "Economy",
                }],
            }]}],
        }

        async def fake_request(params):
            return responses[params["engine"]].pop(0)

        with patch.dict("os.environ", {"SERPAPI_API_KEY": "secret"}), patch("tools.serpapi._request", new=fake_request):
            options = asyncio.run(search_serpapi_flights("Singapore", "Tokyo", "2026-10-05"))

        self.assertEqual(options[0]["provider"], "serpapi-google-flights")
        self.assertEqual(options[0]["flight_number"], "TA 123")
        self.assertEqual(options[0]["departure_airport"], "Changi (SIN)")
        self.assertNotIn("estimated", options[0])

    def test_hotel_uses_property_details_for_verified_contact_data(self):
        async def fake_request(params):
            if params.get("property_token"):
                return {
                    "address": "1 Verified Street, Tokyo",
                    "phone": "+81 3 0000 0000",
                }
            return {"properties": [{
                    "name": "Verified Hotel Name",
                    "property_token": "hotel-token",
                    "rate_per_night": {"extracted_lowest": 320},
                    "overall_rating": 4.5,
                    "gps_coordinates": {"latitude": 35.1, "longitude": 139.1},
                }]}

        with patch.dict("os.environ", {"SERPAPI_API_KEY": "secret"}), patch("tools.serpapi._request", new=fake_request):
            options = asyncio.run(search_serpapi_hotels("Tokyo", "2026-10-05", "2026-10-07"))

        self.assertEqual(options[0]["provider"], "serpapi-google-hotels")
        self.assertEqual(options[0]["name"], "Verified Hotel Name")
        self.assertEqual(options[0]["address"], "1 Verified Street, Tokyo")
        self.assertEqual(options[0]["contact_phone"], "+81 3 0000 0000")

    def test_iata_codes_skip_autocomplete_queries(self):
        seen_engines = []

        async def fake_request(params):
            seen_engines.append(params["engine"])
            return {"best_flights": [{
                "flights": [{
                    "departure_airport": {"name": "Changi", "id": "SIN"},
                    "arrival_airport": {"name": "Narita", "id": "NRT"},
                    "flight_number": "TR 874",
                }],
            }]}

        with patch.dict("os.environ", {"SERPAPI_API_KEY": "secret"}), patch("tools.serpapi._request", new=fake_request):
            options = asyncio.run(search_serpapi_flights("SIN", "NRT", "2026-10-10", max_results=1))

        self.assertEqual(options[0]["flight_number"], "TR 874")
        self.assertEqual(options[0]["arrival_flight_number"], "TR 874")
        self.assertEqual(seen_engines, ["google_flights"])

    def test_connecting_offer_exposes_destination_arrival_leg(self):
        async def fake_request(_params):
            return {"best_flights": [{
                "flights": [
                    {
                        "departure_airport": {"name": "Changi", "id": "SIN"},
                        "arrival_airport": {"name": "Doha", "id": "DOH"},
                        "airline": "Qatar Airways",
                        "flight_number": "QR 945",
                    },
                    {
                        "departure_airport": {"name": "Doha", "id": "DOH"},
                        "arrival_airport": {"name": "Buenos Aires", "id": "EZE"},
                        "airline": "Qatar Airways",
                        "flight_number": "QR 773",
                    },
                ],
            }]}

        with patch.dict("os.environ", {"SERPAPI_API_KEY": "secret"}), patch("tools.serpapi._request", new=fake_request):
            options = asyncio.run(search_serpapi_flights("SIN", "EZE", "2026-10-10", max_results=1))

        self.assertEqual(options[0]["flight_number"], "QR 945")
        self.assertEqual(options[0]["arrival_flight_number"], "QR 773")
        self.assertEqual(options[0]["arrival_airport"], "Buenos Aires (EZE)")


if __name__ == "__main__":
    unittest.main()
