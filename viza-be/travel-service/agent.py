from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from rag import TravelKnowledgeMatch, retrieve_travel_knowledge


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


def _to_destination_card(match: TravelKnowledgeMatch) -> TravelDestinationCard:
    chunk = match.chunk
    return TravelDestinationCard(
        title=chunk.title,
        subtitle=chunk.summary,
        country=chunk.country,
        city=chunk.city,
        image_key=chunk.image_key,
        highlights=chunk.highlights,
        suggested_days=chunk.suggested_days,
        payload=chunk.payload,
    )


def _to_source(match: TravelKnowledgeMatch) -> dict[str, str]:
    chunk = match.chunk
    return {
        "id": chunk.id,
        "title": chunk.title,
        "type": "local_travel_rag",
    }


def _latest_user_text(messages: list[TravelChatMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user" and message.content.strip():
            return message.content.strip()
    return ""


def generate_chat_response(request: TravelChatRequest) -> TravelChatResponse:
    user_text = _latest_user_text(request.messages)
    normalized = user_text.lower()
    matches = retrieve_travel_knowledge(user_text, limit=3)
    cards = [_to_destination_card(match) for match in matches]
    sources = [_to_source(match) for match in matches]

    if not user_text or normalized in {"hi", "hello", "hey", "你好", "嗨"}:
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

    if "不知道" in user_text or "推荐" in user_text or "灵感" in user_text:
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
        country_label = top.country
        city_label = top.city or top.country
        highlights = "、".join(top.highlights[:3])
        return TravelChatResponse(
            reply=(
                f"我理解你可能会喜欢 {city_label} / {country_label} 这个方向。"
                f"它适合安排 {top.suggested_days or '3-5 days'}，亮点可以放在：{highlights}。"
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
