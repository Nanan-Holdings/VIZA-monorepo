from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TravelKnowledgeChunk:
    id: str
    title: str
    country: str
    city: str | None
    image_key: str
    suggested_days: str
    summary: str
    highlights: list[str]
    keywords: list[str]
    payload: dict[str, Any]


@dataclass(frozen=True)
class TravelKnowledgeMatch:
    chunk: TravelKnowledgeChunk
    score: int


TRAVEL_KNOWLEDGE: list[TravelKnowledgeChunk] = [
    TravelKnowledgeChunk(
        id="dest_japan_first_timer",
        title="日本初次自由行",
        country="Japan",
        city="Tokyo",
        image_key="tokyo",
        suggested_days="5-7 days",
        summary="适合第一次去日本：东京城市体验加京都/大阪文化与美食，交通清晰，行程弹性高。",
        highlights=["东京街区漫游", "京都寺社", "大阪美食", "新干线多城路线"],
        keywords=["日本", "japan", "东京", "tokyo", "京都", "大阪", "购物", "美食", "动漫"],
        payload={
            "seed_country": "Japan",
            "seed_city": "Tokyo",
            "countries": ["Japan"],
        },
    ),
    TravelKnowledgeChunk(
        id="dest_korea_city_food",
        title="韩国城市美食短途",
        country="South Korea",
        city="Seoul",
        image_key="seoul",
        suggested_days="3-5 days",
        summary="适合短假期和城市美食：首尔购物、咖啡馆、夜市和韩式体验集中，节奏轻松。",
        highlights=["弘大/圣水洞", "景福宫韩服", "明洞小吃", "首尔夜景"],
        keywords=["韩国", "korea", "首尔", "seoul", "购物", "美食", "短途", "咖啡"],
        payload={
            "seed_country": "South Korea",
            "seed_city": "Seoul",
            "countries": ["South Korea"],
        },
    ),
    TravelKnowledgeChunk(
        id="dest_europe_classic",
        title="欧洲经典多城",
        country="France",
        city="Paris",
        image_key="paris",
        suggested_days="8-12 days",
        summary="适合想看建筑、博物馆和城市风景的人：巴黎、罗马、伦敦或瑞士可组合成多城路线。",
        highlights=["巴黎艺术馆", "罗马古迹", "伦敦剧院", "瑞士湖区"],
        keywords=["欧洲", "europe", "法国", "france", "巴黎", "paris", "意大利", "italy", "英国", "london", "建筑"],
        payload={
            "seed_country": "France",
            "seed_city": "Paris",
            "countries": ["France", "Italy"],
        },
    ),
    TravelKnowledgeChunk(
        id="dest_southeast_asia_islands",
        title="东南亚海岛放松",
        country="Thailand",
        city="Phuket",
        image_key="bangkok",
        suggested_days="4-7 days",
        summary="适合想放松躺平、海边酒店和轻量活动的人：普吉、巴厘岛、苏梅岛都容易安排。",
        highlights=["海边度假", "浮潜/跳岛", "按摩 SPA", "低预算弹性高"],
        keywords=["海岛", "东南亚", "southeast asia", "普吉", "phuket", "巴厘", "bali", "放松", "躺平", "spa"],
        payload={
            "seed_country": "Thailand",
            "seed_city": "Phuket",
            "countries": ["Thailand", "Indonesia"],
        },
    ),
    TravelKnowledgeChunk(
        id="dest_singapore_easy_city",
        title="新加坡轻松城市假期",
        country="Singapore",
        city="Singapore",
        image_key="singapore",
        suggested_days="2-4 days",
        summary="适合从新加坡出发或第一次短途旅行：交通简单，美食密集，亲子和朋友出行都友好。",
        highlights=["滨海湾", "牛车水美食", "圣淘沙", "机场往返方便"],
        keywords=["新加坡", "singapore", "短途", "亲子", "美食", "城市", "周末"],
        payload={
            "seed_country": "Singapore",
            "seed_city": "Singapore",
            "countries": ["Singapore"],
        },
    ),
    TravelKnowledgeChunk(
        id="dest_australia_sydney",
        title="澳洲悉尼慢节奏",
        country="Australia",
        city="Sydney",
        image_key="sydney",
        suggested_days="5-8 days",
        summary="适合想看海岸线、城市地标和轻户外的人：悉尼可以结合蓝山、邦迪和歌剧院。",
        highlights=["歌剧院", "邦迪海滩", "蓝山一日游", "海岸步道"],
        keywords=["澳洲", "澳大利亚", "australia", "悉尼", "sydney", "自然", "海岸", "慢节奏"],
        payload={
            "seed_country": "Australia",
            "seed_city": "Sydney",
            "countries": ["Australia"],
        },
    ),
]


DEFAULT_IDS = [
    "dest_japan_first_timer",
    "dest_europe_classic",
    "dest_southeast_asia_islands",
]


def _normalize(value: str) -> str:
    return value.strip().lower()


def _score_chunk(query: str, chunk: TravelKnowledgeChunk) -> int:
    normalized_query = _normalize(query)
    if not normalized_query:
        return 0

    score = 0
    searchable = " ".join(
        [
            chunk.title,
            chunk.country,
            chunk.city or "",
            chunk.summary,
            " ".join(chunk.highlights),
            " ".join(chunk.keywords),
        ]
    ).lower()

    if normalized_query in searchable:
        score += 5

    for keyword in chunk.keywords:
        normalized_keyword = _normalize(keyword)
        if normalized_keyword and normalized_keyword in normalized_query:
            score += 8
        elif normalized_keyword and normalized_keyword in searchable and normalized_keyword in normalized_query:
            score += 3

    for token in normalized_query.replace("，", " ").replace(",", " ").split():
        if token and token in searchable:
            score += 2

    return score


def retrieve_travel_knowledge(query: str, limit: int = 3) -> list[TravelKnowledgeMatch]:
    ranked = [
        TravelKnowledgeMatch(chunk=chunk, score=_score_chunk(query, chunk))
        for chunk in TRAVEL_KNOWLEDGE
    ]
    matches = [match for match in ranked if match.score > 0]

    if not matches:
        default_lookup = {chunk.id: chunk for chunk in TRAVEL_KNOWLEDGE}
        matches = [
            TravelKnowledgeMatch(chunk=default_lookup[chunk_id], score=1)
            for chunk_id in DEFAULT_IDS
            if chunk_id in default_lookup
        ]

    return sorted(matches, key=lambda match: match.score, reverse=True)[:limit]
