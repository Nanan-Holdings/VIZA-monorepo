import json
import os
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("❌ OPENAI_API_KEY 未配置")

client = OpenAI(api_key=api_key)


def _extract_json_array(raw: str) -> str:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1).strip()
        if candidate:
            return candidate

    bracket = re.search(r"\[[\s\S]*\]", raw)
    if bracket:
        return bracket.group(0).strip()

    return raw.strip()


def _parse_itinerary_json(raw: str):
    candidate = _extract_json_array(raw)
    if not candidate:
        return []

    try:
        parsed = json.loads(candidate)
    except Exception:
        return []

    return parsed if isinstance(parsed, list) else []


def _format_selected_flights(state):
    flights = state.get("selected_flights") or []
    if not isinstance(flights, list) or not flights:
        return "无"

    lines = []
    for flight in flights:
        if not isinstance(flight, dict):
            continue

        leg_index = flight.get("leg_index", "?")
        from_city = flight.get("from", "")
        to_city = flight.get("to", "")
        departure_date = flight.get("departure_date", "")
        skip = bool(flight.get("skip"))

        if skip:
            lines.append(
                f"- 航段{leg_index}: {from_city} -> {to_city} ({departure_date})，用户选择其他交通方式"
            )
            continue

        option = flight.get("option") if isinstance(flight.get("option"), dict) else {}
        airline = option.get("airline", "未知航司")
        price = option.get("price", "-")
        currency = option.get("currency", "CNY")
        departure_time = option.get("departure", departure_date)
        lines.append(
            f"- 航段{leg_index}: {from_city} -> {to_city} | {airline} | {price} {currency} | 出发 {departure_time}"
        )

    return "\n".join(lines) if lines else "无"


def _format_selected_hotels(state):
    hotels = state.get("selected_hotels") or []
    if not isinstance(hotels, list) or not hotels:
        return "无"

    lines = []
    for hotel in hotels:
        if not isinstance(hotel, dict):
            continue

        stay_index = hotel.get("stay_index", "?")
        city = hotel.get("city", "")
        check_in = hotel.get("check_in", "")
        check_out = hotel.get("check_out", "")
        nights = hotel.get("nights", 1)
        option = hotel.get("option") if isinstance(hotel.get("option"), dict) else {}
        name = option.get("name", "未知酒店")
        price = option.get("price_per_night", "-")
        currency = option.get("currency", "CNY")
        rating = option.get("rating", "暂无")

        lines.append(
            f"- 城市{stay_index}: {city} ({check_in} 到 {check_out}, {nights}晚) | {name} | {price} {currency}/晚 | 评分 {rating}"
        )

    return "\n".join(lines) if lines else "无"


def _format_attached_files(state):
    files = state.get("attached_files") or []
    if not isinstance(files, list) or not files:
        return "无"

    lines = []
    for file_item in files:
        if not isinstance(file_item, str):
            continue
        normalized = file_item.strip()
        if not normalized:
            continue
        lines.append(f"- {normalized}")

    return "\n".join(lines) if lines else "无"


def generate_itinerary(state):
    selected_flights = _format_selected_flights(state)
    selected_hotels = _format_selected_hotels(state)
    attached_files = _format_attached_files(state)
    final_note = (state.get("final_note") or "").strip() or "无"

    prompt = f"""
你是一位专业旅行规划师，请根据用户需求生成详细行程。

要求：
- 使用中文
- 使用人民币（¥）
- 严格只使用给定城市
- 不要生成其他国家或城市
- 控制在预算范围内
- 行程合理
- 必须优先参考用户已选择的航班和酒店
- 如果航段被标记为“其他交通方式”，请按该城市顺序安排，不要强行添加航班
- 每天活动安排要与所选城市和停留天数匹配

用户信息：
国家：{state.get("country")}
城市：{state.get("cities")}
天数：{state.get("city_days")}
人数：{state.get("travelers")}
预算：{state.get("budget")}
游玩顺序：{state.get("travel_order")}
已选航班：
{selected_flights}
已选酒店：
{selected_hotels}
用户备注：
{final_note}
附件信息（仅文件名/说明）：
{attached_files}

返回 JSON（不要 ```json）：

[
  {{
    "day": 1,
    "city": "东京",
    "activities": ["参观浅草寺", "游览秋叶原"],
    "food": ["寿司", "拉面"],
    "cost": "¥800"
  }}
]
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.choices[0].message.content

    if not text:
        return []

    text = text.strip()

    parsed = _parse_itinerary_json(text)
    if parsed:
        return parsed

    print("JSON解析失败:", text)
    return []
