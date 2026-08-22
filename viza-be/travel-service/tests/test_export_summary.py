import unittest

from export_summary import build_itinery_rows, localize_itinery_rows


CURRENT_ROWS = [
    {
        "time": "09:00",
        "type": "景点",
        "date": "第 1 天",
        "route": "巴厘岛",
        "name": "海神庙",
        "details": "上午游览海神庙并欣赏印度洋景色。",
        "contact": "-",
    },
    {
        "time": "14:30",
        "type": "景点",
        "date": "第 2 天",
        "route": "佩妮达岛",
        "name": "精灵海滩",
        "details": "下午沿悬崖观景步道游览。",
        "contact": "-",
    },
]


class ExportSummaryContractTests(unittest.TestCase):
    def test_provided_current_itinerary_rows_win_over_generated_rows(self):
        rows = build_itinery_rows(
            [{"day": 1, "city": "Unknown", "activities": ["Placeholder"]}],
            {"itinery_rows": CURRENT_ROWS},
        )

        self.assertEqual(rows, CURRENT_ROWS)

    def test_english_export_preserves_specific_untranslated_places_without_tbd(self):
        rows = localize_itinery_rows(CURRENT_ROWS, "en")
        serialized = " ".join(str(value) for row in rows for value in row.values())

        self.assertIn("海神庙", serialized)
        self.assertIn("佩妮达岛", serialized)
        self.assertIn("精灵海滩", serialized)
        self.assertNotIn("TBD", serialized)
        self.assertNotIn("Travel item", serialized)
        self.assertNotIn("Route TBD", serialized)


if __name__ == "__main__":
    unittest.main()
