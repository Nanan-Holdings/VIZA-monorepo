"""Regression tests for complete long-itinerary normalization."""

from __future__ import annotations

import unittest

from itinerary import _sanitize_itinerary


class ItinerarySanitizationTests(unittest.TestCase):
    def test_partial_model_output_is_completed_from_structured_city_days(self):
        state = {
            "cities": ["Tokyo", "Seoul", "Bangkok"],
            "travel_order": ["Tokyo", "Seoul", "Bangkok"],
            "city_days": {"Tokyo": 2, "Seoul": 2, "Bangkok": 2},
            "travel_days": 6,
            "budget": 6000,
            "locale": "en",
        }
        partial = [
            {
                "day": 1,
                "city": "Tokyo",
                "activities": ["Senso-ji Temple", "Meiji Shrine"],
                "food": ["Tsukiji Outer Market sushi"],
                "cost": "¥900",
            },
            {
                "day": 2,
                "city": "Tokyo",
                "activities": ["Tokyo Tower", "Ueno Park"],
                "food": ["Shinjuku ramen"],
                "cost": "¥900",
            },
        ]

        result = _sanitize_itinerary(partial, state)

        self.assertEqual(len(result), 6)
        self.assertEqual(
            [day["city"] for day in result],
            ["Tokyo", "Tokyo", "Seoul", "Seoul", "Bangkok", "Bangkok"],
        )
        self.assertNotIn("city to confirm", {day["city"].lower() for day in result})


if __name__ == "__main__":
    unittest.main()
