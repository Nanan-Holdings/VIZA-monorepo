"""Locale normalization shared by Travel AI generation, chat, and exports."""

from __future__ import annotations

from typing import Any, Literal

TravelLocale = Literal["zh", "en"]

# Keep provider fallbacks readable when a persisted planner state still carries
# the other interface language's city/country labels. Unknown free text is
# preserved because it may be a user-entered destination without a safe
# translation.
_TRAVEL_PLACE_LABELS: dict[str, tuple[str, str]] = {
    "australia": ("Australia", "澳大利亚"),
    "澳大利亚": ("Australia", "澳大利亚"),
    "澳洲": ("Australia", "澳大利亚"),
    "bangkok": ("Bangkok", "曼谷"),
    "曼谷": ("Bangkok", "曼谷"),
    "bali": ("Bali", "巴厘岛"),
    "巴厘岛": ("Bali", "巴厘岛"),
    "beijing": ("Beijing", "北京"),
    "北京": ("Beijing", "北京"),
    "changsha": ("Changsha", "长沙"),
    "长沙": ("Changsha", "长沙"),
    "china": ("China", "中国"),
    "中国": ("China", "中国"),
    "france": ("France", "法国"),
    "法国": ("France", "法国"),
    "guangzhou": ("Guangzhou", "广州"),
    "广州": ("Guangzhou", "广州"),
    "hangzhou": ("Hangzhou", "杭州"),
    "杭州": ("Hangzhou", "杭州"),
    "hong kong": ("Hong Kong", "香港"),
    "香港": ("Hong Kong", "香港"),
    "indonesia": ("Indonesia", "印度尼西亚"),
    "印度尼西亚": ("Indonesia", "印度尼西亚"),
    "italy": ("Italy", "意大利"),
    "意大利": ("Italy", "意大利"),
    "japan": ("Japan", "日本"),
    "日本": ("Japan", "日本"),
    "kyoto": ("Kyoto", "京都"),
    "京都": ("Kyoto", "京都"),
    "london": ("London", "伦敦"),
    "伦敦": ("London", "伦敦"),
    "lyon": ("Lyon", "里昂"),
    "里昂": ("Lyon", "里昂"),
    "marseille": ("Marseille", "马赛"),
    "马赛": ("Marseille", "马赛"),
    "nice": ("Nice", "尼斯"),
    "尼斯": ("Nice", "尼斯"),
    "osaka": ("Osaka", "大阪"),
    "大阪": ("Osaka", "大阪"),
    "paris": ("Paris", "巴黎"),
    "巴黎": ("Paris", "巴黎"),
    "phuket": ("Phuket", "普吉"),
    "普吉": ("Phuket", "普吉"),
    "rome": ("Rome", "罗马"),
    "罗马": ("Rome", "罗马"),
    "san francisco": ("San Francisco", "旧金山"),
    "旧金山": ("San Francisco", "旧金山"),
    "seoul": ("Seoul", "首尔"),
    "首尔": ("Seoul", "首尔"),
    "singapore": ("Singapore", "新加坡"),
    "新加坡": ("Singapore", "新加坡"),
    "south korea": ("South Korea", "韩国"),
    "韩国": ("South Korea", "韩国"),
    "sydney": ("Sydney", "悉尼"),
    "悉尼": ("Sydney", "悉尼"),
    "switzerland": ("Switzerland", "瑞士"),
    "瑞士": ("Switzerland", "瑞士"),
    "thailand": ("Thailand", "泰国"),
    "泰国": ("Thailand", "泰国"),
    "tokyo": ("Tokyo", "东京"),
    "东京": ("Tokyo", "东京"),
    "united kingdom": ("United Kingdom", "英国"),
    "英国": ("United Kingdom", "英国"),
    "united states": ("United States", "美国"),
    "美国": ("United States", "美国"),
}


def parse_travel_locale(value: Any) -> TravelLocale | None:
    """Return the supported language for a locale tag, or ``None``."""

    if not isinstance(value, str):
        return None
    normalized = value.strip().lower().replace("_", "-")
    if normalized == "en" or normalized.startswith("en-"):
        return "en"
    if normalized == "zh" or normalized.startswith("zh-"):
        return "zh"
    return None


def normalize_travel_locale(value: Any, fallback: TravelLocale = "zh") -> TravelLocale:
    return parse_travel_locale(value) or fallback


def language_tag(locale: Any) -> str:
    """Return the provider language tag used by Google/OpenAI context."""

    return "en" if normalize_travel_locale(locale) == "en" else "zh-CN"


def is_english_locale(locale: Any) -> bool:
    return normalize_travel_locale(locale) == "en"


def localize_travel_place(value: Any, locale: Any = "zh") -> str:
    """Return a known city/country label in the requested interface language."""

    if not isinstance(value, str):
        return ""
    raw = value.strip()
    if not raw:
        return ""
    english, chinese = _TRAVEL_PLACE_LABELS.get(raw.casefold(), (raw, raw))
    return english if is_english_locale(locale) else chinese
