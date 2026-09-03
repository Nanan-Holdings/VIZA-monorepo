"""Regression tests for truthful provider-backed hotel results."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import patch

from tools.hotels import _fallback_hotels, search_hotels


class HotelProviderContractTests(unittest.TestCase):
    def test_fallback_does_not_invent_hotel_identity_or_contact(self):
        options = _fallback_hotels("Tokyo")

        self.assertEqual(len(options), 1)
        option = options[0]
        self.assertTrue(option["estimated"])
        self.assertEqual(option["provider_status"], "unavailable")
        self.assertEqual(option["provider"], "unavailable-estimate")
        self.assertEqual(option["name"], "酒店待确认")
        self.assertIsNone(option["address"])
        self.assertIsNone(option["contact_phone"])
        self.assertIn("不可用于", option["provider_message"])

    def test_destination_failure_returns_marked_placeholder(self):
        async def no_destination(_query):
            return None, None

        async def no_serpapi(**_kwargs):
            return []

        with (
            patch("tools.hotels.search_serpapi_hotels", new=no_serpapi),
            patch("tools.hotels._resolve_destination", new=no_destination),
        ):
            options = asyncio.run(search_hotels("Tokyo", "2026-09-15", "2026-09-17"))

        self.assertEqual(options[0]["provider_reason"], "destination_unresolved")
        self.assertTrue(options[0]["estimated"])


if __name__ == "__main__":
    unittest.main()
