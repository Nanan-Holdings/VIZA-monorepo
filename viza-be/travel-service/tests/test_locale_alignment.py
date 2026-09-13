import asyncio
import unittest
from unittest.mock import patch

import agent
from agent import TravelChatMessage, TravelChatRequest, generate_chat_response
from itinerary import _fallback_itinerary, _fallback_revision
from export_summary import normalize_export_language
from tools.flights import _fallback_flights
from tools.hotels import _fallback_hotels


class LocaleAlignmentTests(unittest.TestCase):
    def setUp(self):
        self.state = {
            "locale": "en-US",
            "country": "Japan",
            "cities": ["东京", "巴黎"],
            "travel_order": ["东京", "巴黎"],
            "city_days": {"东京": 1, "巴黎": 1},
            "travel_days": 2,
            "budget": 2000,
        }

    def test_itinerary_fallback_uses_requested_english_locale(self):
        itinerary = _fallback_itinerary(self.state)

        self.assertEqual([day["city"] for day in itinerary], ["Tokyo", "Paris"])
        self.assertTrue(all("天" not in item for day in itinerary for item in day["activities"]))
        self.assertTrue(all("天" not in item for day in itinerary for item in day["food"]))

    def test_revision_fallback_localizes_reply_and_quick_replies(self):
        current = _fallback_itinerary(self.state)
        result = _fallback_revision(
            {
                "locale": "en-US",
                "state": self.state,
                "current_itinerary": current,
                "user_prompt": "Make this trip cheaper",
            }
        )

        self.assertTrue(result["reply"])
        self.assertNotRegex(result["reply"], r"[\u3400-\u4dbf\u4e00-\u9fff]")
        self.assertTrue(result["quick_replies"])
        self.assertTrue(
            all(
                not any("\u3400" <= char <= "\u9fff" for char in f"{item['label']}{item['value']}")
                for item in result["quick_replies"]
            )
        )

    def test_chat_fallback_uses_requested_language(self):
        request = TravelChatRequest(
            locale="en-US",
            messages=[TravelChatMessage(role="user", content="hello")],
        )
        with patch.object(agent, "client", None):
            response = asyncio.run(generate_chat_response(request))

        self.assertNotRegex(response.reply, r"[\u3400-\u4dbf\u4e00-\u9fff]")
        self.assertTrue(response.quick_replies)
        self.assertTrue(all(not any("\u3400" <= char <= "\u9fff" for char in reply.label) for reply in response.quick_replies))

    def test_export_language_accepts_region_tag(self):
        self.assertEqual(normalize_export_language("en-US"), "en")
        self.assertEqual(normalize_export_language("zh-CN"), "zh")

    def test_provider_fallbacks_match_requested_locale(self):
        flights = _fallback_flights("Guangzhou", "Tokyo", "2026-10-05", locale="en-US")
        hotels = _fallback_hotels("Tokyo", locale="en-US")

        self.assertTrue(all("待确认" not in option["airline"] for option in flights))
        self.assertTrue(all("酒店" not in option["name"] for option in hotels))
        self.assertTrue(all("市中心" not in option["address"] for option in hotels))

        chinese_flights = _fallback_flights("广州", "东京", "2026-10-05")
        chinese_hotels = _fallback_hotels("东京")
        self.assertTrue(all("待确认航司" == option["airline"] for option in chinese_flights))
        self.assertTrue(all("酒店" in option["name"] for option in chinese_hotels))


if __name__ == "__main__":
    unittest.main()
