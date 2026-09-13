import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any, Literal, Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from rag import TravelKnowledgeMatch, retrieve_travel_knowledge
from travel_locale import is_english_locale, normalize_travel_locale
from tools.openai_client import openai_request_slot

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
try:
    OPENAI_TIMEOUT_SECONDS = float(os.getenv("OPENAI_TIMEOUT_SECONDS", "45"))
except (TypeError, ValueError):
    OPENAI_TIMEOUT_SECONDS = 45.0
if OPENAI_TIMEOUT_SECONDS <= 0:
    OPENAI_TIMEOUT_SECONDS = 45.0
client = (
    AsyncOpenAI(
        api_key=api_key,
        timeout=OPENAI_TIMEOUT_SECONDS,
        max_retries=0,
    )
    if api_key
    else None
)
OPENAI_TRAVEL_CHAT_MODEL = os.getenv("OPENAI_TRAVEL_CHAT_MODEL", "gpt-4o-mini")


ChatMode = Literal[
    "welcome",
    "inspiration",
    "destination_detail",
    "collect_slots",
    "flights",
    "hotels",
    "itinerary",
    "revision",
]

VALID_CHAT_MODES = {
    "welcome",
    "inspiration",
    "destination_detail",
    "collect_slots",
    "flights",
    "hotels",
    "itinerary",
    "revision",
}


class TravelChatMessage(BaseModel):
    role: Literal["user", "assistant"] = "user"
    content: str = ""


class TravelChatRequest(BaseModel):
    messages: list[TravelChatMessage] = Field(default_factory=list)
    state: dict[str, Any] = Field(default_factory=dict)
    locale: str = "zh-CN"


class TravelQuickReply(BaseModel):
    label: str
    value: str


class TravelDestinationCard(BaseModel):
    type: Literal["destination"] = "destination"
    title: str
    subtitle: str
    country: str
    city: Optional[str] = None
    image_key: Optional[str] = None
    highlights: list[str] = Field(default_factory=list)
    suggested_days: Optional[str] = None
    action_label: str = "加入计划"
    payload: dict[str, Any] = Field(default_factory=dict)


class TravelChatResponse(BaseModel):
    reply: str
    mode: ChatMode
    quick_replies: list[TravelQuickReply] = Field(default_factory=list)
    cards: list[TravelDestinationCard] = Field(default_factory=list)
    candidate_payload: dict[str, Any] = Field(default_factory=dict)
    sources: list[dict[str, str]] = Field(default_factory=list)


PLACE_LABELS = {
    "Japan": "日本",
    "Tokyo": "东京",
    "South Korea": "韩国",
    "Seoul": "首尔",
    "France": "法国",
    "Paris": "巴黎",
    "Italy": "意大利",
    "Thailand": "泰国",
    "Phuket": "普吉",
    "Indonesia": "印度尼西亚",
    "Singapore": "新加坡",
    "Australia": "澳大利亚",
    "Sydney": "悉尼",
    "United States": "美国",
    "San Francisco": "旧金山",
}

CARD_EN_COPY = {
    "dest_japan_first_timer": {
        "title": "First-time Japan trip",
        "summary": "A flexible first Japan trip combining Tokyo city experiences with Kyoto and Osaka culture and food.",
        "highlights": [
            "Tokyo neighbourhoods",
            "Kyoto temples",
            "Osaka food",
            "Multi-city rail route",
        ],
    },
    "dest_korea_city_food": {
        "title": "Seoul city and food getaway",
        "summary": "A relaxed short break with Seoul shopping, cafés, markets, and Korean experiences close together.",
        "highlights": [
            "Hongdae and Seongsu",
            "Gyeongbokgung hanbok experience",
            "Myeongdong street food",
            "Seoul night views",
        ],
    },
    "dest_europe_classic": {
        "title": "Classic multi-city Europe",
        "summary": "A route for architecture, museums, and city scenery, combining Paris with Rome, London, or Switzerland.",
        "highlights": [
            "Paris art museums",
            "Rome historic sites",
            "London theatre",
            "Swiss lakes",
        ],
    },
    "dest_southeast_asia_islands": {
        "title": "Relaxing Southeast Asian islands",
        "summary": "A flexible beach break with resort stays and light activities in Phuket, Bali, or Koh Samui.",
        "highlights": [
            "Beach resorts",
            "Snorkelling and island hopping",
            "Massage and spa time",
            "Flexible low-cost options",
        ],
    },
    "dest_singapore_easy_city": {
        "title": "Easy Singapore city break",
        "summary": "A simple first short trip with easy transport, concentrated food options, and activities for families or friends.",
        "highlights": [
            "Marina Bay",
            "Chinatown food",
            "Sentosa",
            "Easy airport transfers",
        ],
    },
    "dest_us_san_francisco": {
        "title": "San Francisco Bay getaway",
        "summary": "A coastal city break with the Golden Gate Bridge, neighbourhood cafés, and light outdoor activities.",
        "highlights": [
            "Golden Gate Bridge",
            "Fisherman’s Wharf",
            "Lombard Street",
            "Bay sunsets",
        ],
    },
    "dest_australia_sydney": {
        "title": "A slower-paced Sydney trip",
        "summary": "A coastal itinerary combining city landmarks and light outdoor activities around Sydney, Bondi, and the Blue Mountains.",
        "highlights": [
            "Opera House",
            "Bondi Beach",
            "Blue Mountains day trip",
            "Coastal walks",
        ],
    },
}

COUNTRY_CANONICAL = {
    "日本": "Japan",
    "japan": "Japan",
    "韩国": "South Korea",
    "south korea": "South Korea",
    "korea": "South Korea",
    "法国": "France",
    "france": "France",
    "意大利": "Italy",
    "italy": "Italy",
    "泰国": "Thailand",
    "thailand": "Thailand",
    "印度尼西亚": "Indonesia",
    "indonesia": "Indonesia",
    "新加坡": "Singapore",
    "singapore": "Singapore",
    "澳大利亚": "Australia",
    "澳洲": "Australia",
    "australia": "Australia",
    "美国": "United States",
    "united states": "United States",
    "usa": "United States",
    "us": "United States",
}

CITY_CANONICAL = {
    "东京": "Tokyo",
    "tokyo": "Tokyo",
    "首尔": "Seoul",
    "seoul": "Seoul",
    "巴黎": "Paris",
    "paris": "Paris",
    "普吉": "Phuket",
    "phuket": "Phuket",
    "新加坡": "Singapore",
    "singapore": "Singapore",
    "悉尼": "Sydney",
    "sydney": "Sydney",
    "旧金山": "San Francisco",
    "san francisco": "San Francisco",
    "sanfrancisco": "San Francisco",
    "sf": "San Francisco",
}

CITY_COUNTRY = {
    "Tokyo": "Japan",
    "Seoul": "South Korea",
    "Paris": "France",
    "Phuket": "Thailand",
    "Singapore": "Singapore",
    "Sydney": "Australia",
    "San Francisco": "United States",
}

IMAGE_KEY_BY_CITY = {
    "Tokyo": "tokyo",
    "Seoul": "seoul",
    "Paris": "paris",
    "Phuket": "bangkok",
    "Singapore": "singapore",
    "Sydney": "sydney",
    "San Francisco": "sf",
}


def _localize_place(value: str | None, locale: str = "zh") -> str:
    if not value:
        return ""
    if is_english_locale(locale):
        return value
    return PLACE_LABELS.get(value, value)


def _localize_days(value: str | None, locale: str = "zh") -> str:
    if not value:
        return "3-5 days" if is_english_locale(locale) else "3-5 天"
    if is_english_locale(locale):
        return value.replace("天", " days").replace("日", " days")
    return value.replace("days", "天").replace("day", "天")


def _to_destination_card(
    match: TravelKnowledgeMatch, locale: str = "zh"
) -> TravelDestinationCard:
    chunk = match.chunk
    language = normalize_travel_locale(locale)
    english_copy = CARD_EN_COPY.get(chunk.id, {})
    title = (
        english_copy.get("title", chunk.city or chunk.country)
        if language == "en"
        else chunk.title
    )
    summary = (
        english_copy.get("summary", chunk.summary)
        if language == "en"
        else chunk.summary
    )
    highlights = (
        english_copy.get("highlights", chunk.highlights)
        if language == "en"
        else chunk.highlights
    )
    return TravelDestinationCard(
        title=title,
        subtitle=summary,
        country=chunk.country,
        city=chunk.city,
        image_key=chunk.image_key,
        highlights=list(highlights),
        suggested_days=_localize_days(chunk.suggested_days, language),
        action_label="Add to plan" if language == "en" else "加入计划",
        payload=chunk.payload,
    )


def _to_source(match: TravelKnowledgeMatch, locale: str = "zh") -> dict[str, str]:
    chunk = match.chunk
    return {
        "id": chunk.id,
        "title": (
            CARD_EN_COPY.get(chunk.id, {}).get("title", chunk.title)
            if normalize_travel_locale(locale) == "en"
            else chunk.title
        ),
        "type": "local_travel_rag",
    }


def _latest_user_text(messages: list[TravelChatMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user" and message.content.strip():
            return message.content.strip()
    return ""


def _is_greeting(text: str) -> bool:
    normalized = text.strip().lower()
    return normalized in {
        "hi",
        "hello",
        "hey",
        "good morning",
        "good afternoon",
        "你好",
        "嗨",
    }


def _is_inspiration_request(text: str) -> bool:
    normalized = text.strip().lower()
    if not normalized:
        return False
    return (
        "不知道" in normalized
        or "没想好" in normalized
        or "灵感" in normalized
        or "don't know" in normalized
        or "do not know" in normalized
        or "inspiration" in normalized
        or "recommend" in normalized
        or "where should i go" in normalized
        or normalized in {"推荐目的地", "推荐几个目的地", "去哪玩", "去哪里玩"}
    )


def _should_include_default_rag(text: str) -> bool:
    return not text.strip() or _is_greeting(text) or _is_inspiration_request(text)


def _plain_text(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"```[\s\S]*?```", "", text).strip()
    text = re.sub(r"!\[([^\]]*)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    cleaned_lines = []
    for line in text.splitlines():
        line = re.sub(r"^\s{0,3}#{1,6}\s*", "", line)
        line = re.sub(r"^\s*[-*+]\s+", "", line)
        line = re.sub(r"^\s*\d+[.)]\s+", "", line)
        if line.strip():
            cleaned_lines.append(line.strip())
    return "\n".join(cleaned_lines).strip()


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        text = fenced.group(1).strip()

    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                parsed = json.loads(text[start : end + 1])
                return parsed if isinstance(parsed, dict) else None
            except json.JSONDecodeError:
                return None
    return None


def _string_list(value: Any, limit: int = 5) -> list[str]:
    if isinstance(value, list):
        items = [_plain_text(item) for item in value]
    elif isinstance(value, str):
        items = [_plain_text(item) for item in re.split(r"[，,、]", value)]
    else:
        items = []
    return [item for item in items if item][:limit]


def _canonical_country(value: Any) -> str:
    raw = _plain_text(value)
    if not raw:
        return ""
    normalized = raw.lower().strip()
    return COUNTRY_CANONICAL.get(raw) or COUNTRY_CANONICAL.get(normalized) or raw


def _canonical_city(value: Any) -> str:
    raw = _plain_text(value)
    if not raw:
        return ""
    normalized = re.sub(r"\s+", " ", raw.lower()).strip()
    compact = normalized.replace(" ", "")
    for key, canonical in CITY_CANONICAL.items():
        if key in raw or key in normalized or key in compact:
            return canonical
    return raw


def _image_key_for_destination(raw_key: Any, city: str, title: str) -> str | None:
    key = _plain_text(raw_key).lower().strip()
    if key:
        if key in {"san francisco", "sanfrancisco", "sf", "旧金山"}:
            return "sf"
        return key.replace(" ", "")

    if city in IMAGE_KEY_BY_CITY:
        return IMAGE_KEY_BY_CITY[city]

    title_key = title.lower()
    if "旧金山" in title or "san francisco" in title_key or "sf" == title_key:
        return "sf"
    return None


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _coerce_mode(value: Any, has_cards: bool) -> ChatMode:
    mode = _plain_text(value)
    if mode in VALID_CHAT_MODES:
        return mode  # type: ignore[return-value]
    return "destination_detail" if has_cards else "collect_slots"


def _has_cjk(value: str) -> bool:
    return bool(re.search(r"[\u3400-\u4dbf\u4e00-\u9fff]", value))


def _text_matches_locale(value: str, locale: str) -> bool:
    return _has_cjk(value) if normalize_travel_locale(locale) == "zh" else not _has_cjk(value)


def _coerce_quick_replies(
    value: Any, locale: str = "zh"
) -> list[TravelQuickReply]:
    replies: list[TravelQuickReply] = []
    if not isinstance(value, list):
        return replies

    for item in value[:5]:
        if isinstance(item, dict):
            label = _plain_text(item.get("label"))
            reply_value = _plain_text(item.get("value")) or label
        else:
            label = _plain_text(item)
            reply_value = label
        if label and _text_matches_locale(label, locale) and _text_matches_locale(
            reply_value, locale
        ):
            replies.append(TravelQuickReply(label=label, value=reply_value))
    return replies


def _coerce_destination_cards(
    value: Any, locale: str = "zh"
) -> list[TravelDestinationCard]:
    if not isinstance(value, list):
        return []

    language = normalize_travel_locale(locale)
    cards: list[TravelDestinationCard] = []
    for raw_card in value[:4]:
        if not isinstance(raw_card, dict):
            continue

        payload = dict(_as_dict(raw_card.get("payload")))
        city = _canonical_city(raw_card.get("city") or payload.get("seed_city") or raw_card.get("title"))
        country = _canonical_country(
            raw_card.get("country") or payload.get("seed_country") or CITY_COUNTRY.get(city, "")
        )
        if not country and city in CITY_COUNTRY:
            country = CITY_COUNTRY[city]

        title = _plain_text(raw_card.get("title"))
        if not title or not _text_matches_locale(title, language):
            title = _localize_place(city or country, language)
        if not title or not _text_matches_locale(title, language):
            title = "Destination" if language == "en" else "目的地"
        if not title:
            continue

        subtitle = (
            _plain_text(raw_card.get("subtitle"))
            or _plain_text(raw_card.get("summary"))
            or (
                f"Plan a flexible trip around {_localize_place(city or country, language)}, with landmarks and local food."
                if language == "en"
                else f"适合围绕{_localize_place(city or country, language)}安排城市体验、地标和本地美食。"
            )
        )
        if not _text_matches_locale(subtitle, language):
            subtitle = (
                f"Plan a flexible trip around {_localize_place(city or country, language)}, with landmarks and local food."
                if language == "en"
                else f"适合围绕{_localize_place(city or country, language)}安排城市体验、地标和本地美食。"
            )
        highlights = _string_list(raw_card.get("highlights"))
        if not highlights or any(
            not _text_matches_locale(highlight, language) for highlight in highlights
        ):
            if city == "San Francisco":
                highlights = (
                    ["Golden Gate Bridge", "Fisherman’s Wharf", "Lombard Street"]
                    if language == "en"
                    else ["金门大桥", "渔人码头", "九曲花街"]
                )
            else:
                highlights = (
                    [
                        f"{_localize_place(city or country, language)} landmarks",
                        "Local food",
                    ]
                    if language == "en"
                    else [f"{_localize_place(city or country, language)}地标", "本地美食"]
                )

        if country:
            payload["seed_country"] = country
            payload["countries"] = [country]
        if city:
            payload["seed_city"] = city

        action_label = _plain_text(raw_card.get("action_label"))
        if not action_label or not _text_matches_locale(action_label, language):
            action_label = "Add to plan" if language == "en" else "加入计划"
        cards.append(
            TravelDestinationCard(
                title=title,
                subtitle=subtitle,
                country=country or title,
                city=city or None,
                image_key=_image_key_for_destination(raw_card.get("image_key"), city, title),
                highlights=highlights,
                suggested_days=_localize_days(
                    _plain_text(raw_card.get("suggested_days")) or None, language
                ),
                action_label=action_label,
                payload=payload,
            )
        )
    return cards


def _format_rag_context(
    matches: list[TravelKnowledgeMatch], locale: str = "zh"
) -> str:
    language = normalize_travel_locale(locale)
    context = [
        {
            "title": (
                CARD_EN_COPY.get(match.chunk.id, {}).get("title", match.chunk.title)
                if language == "en"
                else match.chunk.title
            ),
            "country": match.chunk.country,
            "city": match.chunk.city,
            "suggested_days": match.chunk.suggested_days,
            "summary": (
                CARD_EN_COPY.get(match.chunk.id, {}).get("summary", match.chunk.summary)
                if language == "en"
                else match.chunk.summary
            ),
            "highlights": (
                CARD_EN_COPY.get(match.chunk.id, {}).get("highlights", match.chunk.highlights)
                if language == "en"
                else match.chunk.highlights
            ),
        }
        for match in matches
    ]
    return json.dumps(context, ensure_ascii=False)


def _recent_openai_messages(messages: list[TravelChatMessage]) -> list[dict[str, str]]:
    recent = messages[-8:]
    return [
        {
            "role": message.role,
            "content": _plain_text(message.content),
        }
        for message in recent
        if message.content.strip()
    ]


async def _generate_openai_chat_response(
    request: TravelChatRequest,
    user_text: str,
    matches: list[TravelKnowledgeMatch],
) -> TravelChatResponse | None:
    if client is None:
        print("OPENAI_API_KEY 未配置，travel natural language chat 使用 fallback。")
        return None

    language = normalize_travel_locale(request.locale)
    if language == "en":
        system_prompt = (
            "You are VIZA Travel Buddy, a travel conversation agent. Interpret every natural-language request yourself; "
            "local RAG suggestions must never override a destination the user explicitly names. "
            "If the user names a destination such as San Francisco, SF, or 旧金山, keep the response focused on that destination, "
            "even when local RAG has no matching city. Do not answer an explicit San Francisco request with unrelated Tokyo, Japan, or Paris suggestions. "
            "All user-facing text must be plain English: no Markdown, bullets, or code blocks. Output one JSON object only. "
            "JSON schema: {"
            "\"mode\":\"welcome|inspiration|destination_detail|collect_slots\","
            "\"reply\":\"plain English\","
            "\"quick_replies\":[{\"label\":\"English button\",\"value\":\"natural English value\"}],"
            "\"cards\":[{\"title\":\"English title\",\"subtitle\":\"English summary\",\"country\":\"English country\","
            "\"city\":\"English city\",\"image_key\":\"known key such as sf/tokyo/paris\","
            "\"highlights\":[\"English highlight\"],\"suggested_days\":\"4-6 days\","
            "\"payload\":{\"seed_country\":\"English country\",\"seed_city\":\"English city\","
            "\"countries\":[\"English country\"]}}],"
            "\"candidate_payload\":{}"
            "}"
        )
    else:
        system_prompt = (
            "你是 VIZA Travel Buddy 的旅行对话 agent。所有用户自然语言输入必须先由你解释，"
            "不能让本地 RAG 的默认目的地覆盖用户明确表达的目的地。"
            "如果用户明确提到目的地，例如“旧金山”“San Francisco”“SF”，必须围绕该目的地回复，"
            "即使本地 RAG 没有该城市，也要生成合理候选目的地卡片。"
            "不要在用户明确说旧金山时回复东京、日本、巴黎等无关默认目的地。"
            "回复给用户的所有文字必须是中文纯文本，不要 Markdown，不要项目符号，不要代码块。"
            "只输出一个 JSON object，不要额外解释。"
            "JSON schema: {"
            "\"mode\":\"welcome|inspiration|destination_detail|collect_slots\","
            "\"reply\":\"中文纯文本\","
            "\"quick_replies\":[{\"label\":\"中文按钮\",\"value\":\"自然语言中文值\"}],"
            "\"cards\":[{\"title\":\"中文标题\",\"subtitle\":\"中文简介\",\"country\":\"English country\","
            "\"city\":\"English city\",\"image_key\":\"known key such as sf/tokyo/paris\","
            "\"highlights\":[\"中文亮点\"],\"suggested_days\":\"4-6 days\","
            "\"payload\":{\"seed_country\":\"English country\",\"seed_city\":\"English city\","
            "\"countries\":[\"English country\"]}}],"
            "\"candidate_payload\":{}"
            "}。"
        )
    user_payload = {
        "latest_user_text": user_text,
        "locale": language,
        "state": request.state,
        "recent_messages": _recent_openai_messages(request.messages),
        "local_rag_context": _format_rag_context(matches, language),
    }

    try:
        async with openai_request_slot():
            completion = await asyncio.wait_for(
                client.chat.completions.create(
                    model=OPENAI_TRAVEL_CHAT_MODEL,
                    temperature=0.2,
                    response_format={"type": "json_object"},
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": json.dumps(user_payload, ensure_ascii=False),
                        },
                    ],
                ),
                timeout=OPENAI_TIMEOUT_SECONDS,
            )
        content = completion.choices[0].message.content or ""
        parsed = _extract_json_object(content)
    except Exception as exc:
        print("OpenAI travel chat failed, using fallback:", exc)
        return None

    if not parsed:
        return None

    cards = _coerce_destination_cards(parsed.get("cards"), language)
    candidate_payload = dict(_as_dict(parsed.get("candidate_payload")))
    if not candidate_payload and cards:
        candidate_payload = cards[0].payload

    reply = _plain_text(parsed.get("reply"))
    if not reply or not _text_matches_locale(reply, language):
        return None

    sources = [
        {
            "id": "openai_travel_chat",
            "title": (
                "OpenAI travel chat interpretation"
                if language == "en"
                else "OpenAI 旅行对话解析"
            ),
            "type": "openai_chat",
        },
        *[_to_source(match, language) for match in matches],
    ]

    return TravelChatResponse(
        reply=reply,
        mode=_coerce_mode(parsed.get("mode"), bool(cards)),
        quick_replies=_coerce_quick_replies(parsed.get("quick_replies"), language),
        cards=cards,
        candidate_payload=candidate_payload,
        sources=sources,
    )


async def generate_chat_response(request: TravelChatRequest) -> TravelChatResponse:
    locale = normalize_travel_locale(request.locale)
    user_text = _latest_user_text(request.messages)
    include_defaults = _should_include_default_rag(user_text)
    matches = retrieve_travel_knowledge(user_text, limit=3, include_defaults=include_defaults)
    cards = [_to_destination_card(match, locale) for match in matches]
    sources = [_to_source(match, locale) for match in matches]

    if user_text:
        openai_response = await _generate_openai_chat_response(request, user_text, matches)
        if openai_response:
            return openai_response

    if not user_text or _is_greeting(user_text):
        if locale == "en":
            return TravelChatResponse(
                reply=(
                    "Hi, I’m VIZA Travel Buddy. Tell me your destination, trip length, budget, and preferences, "
                    "or ask me for a few destination ideas."
                ),
                mode="welcome",
                quick_replies=[
                    TravelQuickReply(label="I’m not sure where to go", value="I don't know where to go"),
                    TravelQuickReply(label="I want to visit Japan", value="I want to visit Japan"),
                    TravelQuickReply(label="I want to visit Europe", value="I want to visit Europe"),
                ],
                sources=sources,
            )
        return TravelChatResponse(
            reply=(
                "嗨，我是 VIZA Travel Buddy。你可以直接告诉我想去的国家、旅行天数、预算和偏好，"
                "也可以先让我给你一些目的地灵感。"
            ),
            mode="welcome",
            quick_replies=[
                TravelQuickReply(label="我不知道去哪", value="我不知道去哪"),
                TravelQuickReply(label="想去日本", value="我想去日本"),
                TravelQuickReply(label="想去欧洲", value="我想去欧洲"),
            ],
            sources=sources,
        )

    if _is_inspiration_request(user_text):
        if locale == "en":
            return TravelChatResponse(
                reply=(
                    "That’s a fun place to start. I picked a few directions using popular routes, ease of travel, "
                    "and different travel styles. Add one to your plan, or tell me whether you prefer a relaxing break, "
                    "city food, nature, or a multi-city trip."
                ),
                mode="inspiration",
                quick_replies=[
                    TravelQuickReply(label="A relaxing break", value="I want a relaxing trip"),
                    TravelQuickReply(label="City food", value="I like cities and food"),
                    TravelQuickReply(label="Nature", value="I want to see nature"),
                ],
                cards=cards,
                sources=sources,
            )
        return TravelChatResponse(
            reply=(
                "没关系，不知道去哪儿反而是最有趣的开始。我先按热门路线、短途便利度和旅行风格"
                "挑了几个方向，你可以点一个加入计划，或者继续告诉我你想放松躺平、城市美食、"
                "自然风景，还是多城市打卡。"
            ),
            mode="inspiration",
            quick_replies=[
                TravelQuickReply(label="放松躺平", value="我想放松躺平"),
                TravelQuickReply(label="城市美食", value="我喜欢城市和美食"),
                TravelQuickReply(label="自然风景", value="我想看自然风景"),
            ],
            cards=cards,
            sources=sources,
        )

    if cards:
        top = cards[0]
        country_label = _localize_place(top.country, locale)
        city_label = _localize_place(top.city or top.country, locale)
        highlights = ", ".join(top.highlights[:3]) if locale == "en" else "、".join(top.highlights[:3])
        if locale == "en":
            return TravelChatResponse(
                reply=(
                    f"You may enjoy {city_label} / {country_label}. It works well for {_localize_days(top.suggested_days, locale)}, "
                    f"with highlights such as {highlights}. I’ll keep it as a destination suggestion and won’t change your form until you confirm."
                ),
                mode="destination_detail",
                quick_replies=[
                    TravelQuickReply(label=f"Add {city_label} to my plan", value=f"Add {city_label} to my plan"),
                    TravelQuickReply(label="Show more ideas", value="Recommend a few more destinations"),
                    TravelQuickReply(label="Try another style", value="I want a different travel style"),
                ],
                cards=cards,
                candidate_payload=top.payload,
                sources=sources,
            )
        return TravelChatResponse(
            reply=(
                f"我理解你可能会喜欢 {city_label} / {country_label} 这个方向。"
                f"它适合安排 {_localize_days(top.suggested_days, locale)}，亮点可以放在：{highlights}。"
                "先把它作为候选目的地，不会直接改表单；你确认后我再帮你带入规划流程。"
            ),
            mode="destination_detail",
            quick_replies=[
                TravelQuickReply(label=f"加入计划：{city_label}", value=f"加入计划：{city_label}"),
                TravelQuickReply(label="再推荐几个", value="再推荐几个目的地"),
                TravelQuickReply(label="换个风格", value="我想换个旅行风格"),
            ],
            cards=cards,
            candidate_payload=top.payload,
            sources=sources,
        )

    if locale == "en":
        return TravelChatResponse(
            reply=(
                "Got it. I’ll treat that as a travel preference and won’t change your form automatically. "
                "I can recommend cities from the destination knowledge base next, and you can confirm one before it is added."
            ),
            mode="collect_slots",
            quick_replies=[
                TravelQuickReply(label="Recommend destinations", value="Recommend destinations based on my preferences"),
                TravelQuickReply(label="Start planning", value="I want to plan a specific itinerary"),
            ],
        )
    return TravelChatResponse(
        reply=(
            "收到。我会先把它当作旅行偏好来理解，而不会直接替你改旅行表单。"
            "下一步我可以基于目的地知识库给你推荐城市，再由你确认加入计划。"
        ),
        mode="collect_slots",
        quick_replies=[
            TravelQuickReply(label="推荐目的地", value="请根据我的偏好推荐目的地"),
            TravelQuickReply(label="开始填表", value="我想开始规划具体行程"),
        ],
    )
