import json
import os
import re
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
client = OpenAI(api_key=api_key) if api_key else None


CITY_ALIASES = {
    "东京": "tokyo",
    "tokyo": "tokyo",
    "京都": "kyoto",
    "kyoto": "kyoto",
    "大阪": "osaka",
    "osaka": "osaka",
    "巴黎": "paris",
    "paris": "paris",
    "新加坡": "singapore",
    "singapore": "singapore",
    "悉尼": "sydney",
    "sydney": "sydney",
    "伦敦": "london",
    "london": "london",
    "罗马": "rome",
    "rome": "rome",
    "首尔": "seoul",
    "seoul": "seoul",
    "曼谷": "bangkok",
    "bangkok": "bangkok",
    "香港": "hongkong",
    "hongkong": "hongkong",
    "北京": "beijing",
    "beijing": "beijing",
    "旧金山": "sanfrancisco",
    "sanfrancisco": "sanfrancisco",
    "sf": "sanfrancisco",
    "比萨": "pisa",
    "pisa": "pisa",
}


SPECIFIC_ATTRACTIONS_BY_KEY = {
    "tokyo": [
        "浅草寺与仲见世商店街",
        "东京塔与芝公园",
        "明治神宫",
        "涩谷十字路口与忠犬八公像",
        "筑地场外市场",
        "上野公园与东京国立博物馆",
        "新宿御苑",
        "teamLab Planets TOKYO 丰洲",
        "秋叶原电器街",
        "原宿竹下通",
    ],
    "kyoto": [
        "清水寺与二年坂三年坂",
        "伏见稻荷大社千本鸟居",
        "金阁寺",
        "岚山竹林小径与渡月桥",
        "祇园花见小路",
        "二条城",
        "哲学之道",
        "锦市场",
        "三十三间堂",
        "平安神宫",
    ],
    "osaka": [
        "大阪城公园与天守阁",
        "道顿堀格力高跑者看板",
        "黑门市场",
        "梅田蓝天大厦空中庭园",
        "通天阁与新世界",
        "四天王寺",
        "海游馆",
        "心斋桥筋商店街",
        "中之岛公园",
        "难波八阪神社",
    ],
    "paris": [
        "埃菲尔铁塔与战神广场",
        "卢浮宫与玻璃金字塔",
        "奥赛博物馆",
        "巴黎圣母院与西岱岛",
        "圣礼拜堂",
        "蒙马特高地与圣心大教堂",
        "凯旋门与香榭丽舍大街",
        "凡尔赛宫",
        "玛黑区与孚日广场",
        "塞纳河游船",
    ],
    "singapore": [
        "滨海湾金沙空中花园",
        "滨海湾花园云雾林与擎天树",
        "鱼尾狮公园",
        "牛车水佛牙寺",
        "小印度实龙岗路",
        "圣淘沙西乐索海滩",
        "新加坡国家美术馆",
        "赞美广场 CHIJMES",
    ],
    "sydney": [
        "悉尼歌剧院",
        "海港大桥攀桥观景点",
        "岩石区 The Rocks",
        "邦迪海滩与 Bondi to Coogee 海岸步道",
        "达令港",
        "皇家植物园麦考利夫人椅",
        "塔龙加动物园",
        "新南威尔士州美术馆",
    ],
    "london": [
        "大英博物馆",
        "塔桥与伦敦塔",
        "威斯敏斯特宫与大本钟",
        "白金汉宫",
        "科文特花园",
        "博罗市场",
        "国家美术馆",
        "卡姆登市场",
    ],
    "rome": [
        "罗马斗兽场",
        "古罗马广场",
        "万神殿",
        "特莱维喷泉",
        "西班牙阶梯",
        "梵蒂冈博物馆与西斯廷礼拜堂",
        "圣彼得大教堂",
        "特拉斯提弗列街区",
    ],
    "seoul": [
        "景福宫与光化门",
        "北村韩屋村",
        "明洞购物街",
        "南山首尔塔",
        "广藏市场",
        "弘大街区",
        "东大门设计广场 DDP",
        "汉江盘浦大桥月光彩虹喷泉",
    ],
    "bangkok": [
        "大皇宫与玉佛寺",
        "卧佛寺",
        "郑王庙",
        "乍都乍周末市场",
        "暹罗商圈 Siam Paragon",
        "唐人街耀华力路",
        "ICONSIAM",
        "金山寺",
    ],
    "hongkong": [
        "太平山顶凌霄阁",
        "中环半山扶梯",
        "尖沙咀星光大道",
        "天星小轮",
        "香港故宫文化博物馆",
        "庙街夜市",
        "大馆",
        "昂坪 360 与天坛大佛",
    ],
    "beijing": [
        "故宫博物院",
        "天安门广场",
        "天坛公园",
        "颐和园",
        "八达岭长城",
        "什刹海与烟袋斜街",
        "雍和宫",
        "国家博物馆",
    ],
    "sanfrancisco": [
        "金门大桥游客中心",
        "渔人码头 39 号码头",
        "恶魔岛",
        "九曲花街",
        "渡轮大厦市场",
        "联合广场",
        "金门公园日本茶园",
        "双子峰",
    ],
    "pisa": [
        "比萨斜塔",
        "奇迹广场",
        "比萨主教座堂",
        "圣若望洗礼堂",
        "骑士广场",
        "圣玛利亚德拉斯皮纳教堂",
        "阿诺河岸 Lungarni",
        "博尔戈斯特雷托街",
    ],
}


SPECIFIC_FOOD_BY_KEY = {
    "tokyo": ["筑地场外市场寿司", "新宿思出横丁拉面"],
    "kyoto": ["锦市场小吃", "祇园怀石料理"],
    "osaka": ["道顿堀章鱼烧", "黑门市场海鲜"],
    "paris": ["圣日耳曼可颂咖啡", "玛黑区小酒馆晚餐"],
    "singapore": ["老巴刹沙爹", "麦士威熟食中心海南鸡饭"],
    "sydney": ["岩石区早午餐", "邦迪海滩海鲜"],
    "london": ["博罗市场小吃", "Covent Garden 餐酒馆"],
    "rome": ["特拉斯提弗列意面", "Campo de' Fiori 披萨"],
    "seoul": ["广藏市场绿豆煎饼", "明洞韩式烤肉"],
    "bangkok": ["耀华力路街头小吃", "ICONSIAM 水上市场美食"],
    "hongkong": ["中环茶餐厅", "庙街煲仔饭"],
    "beijing": ["什刹海京味小吃", "前门烤鸭"],
    "sanfrancisco": ["渡轮大厦市场", "渔人码头酸面包海鲜汤"],
    "pisa": ["骑士广场意式小馆", "阿诺河岸 Gelato"],
}


VAGUE_ACTIVITY_RE = re.compile(
    r"(城市地标|地标打卡|本地文化|当地文化|当地特色|本地特色|文化体验|"
    r"自由活动|市区游览|城市漫步|local culture|city landmark|"
    r"landmark tour|local experience|must-see|经典体验)",
    re.IGNORECASE,
)


def _lookup_key(value: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]", "", str(value).lower())


def _canonical_city_key(city: str) -> str:
    key = _lookup_key(city)
    return CITY_ALIASES.get(key, key)


def _safe_positive_int(value, default=1):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _rotated_values(values, start_index, count):
    if not values:
        return []
    return [values[(start_index + offset) % len(values)] for offset in range(count)]


def _specific_attractions_for_city(city, day_index=0, count=2):
    city_text = str(city).strip() or "目的地"
    key = _canonical_city_key(city_text)
    attractions = SPECIFIC_ATTRACTIONS_BY_KEY.get(key)
    if not attractions:
        attractions = [
            f"{city_text} 中央车站周边",
            f"{city_text} 市政厅广场",
            f"{city_text} 中央市场",
            f"{city_text} 历史博物馆",
            f"{city_text} 河岸步道",
        ]
    return _rotated_values(attractions, day_index * count, count)


def _specific_food_for_city(city, day_index=0):
    city_text = str(city).strip() or "目的地"
    key = _canonical_city_key(city_text)
    food = SPECIFIC_FOOD_BY_KEY.get(key)
    if not food:
        food = [f"{city_text} 中央市场餐厅", f"{city_text} 老城区咖啡馆"]
    return _rotated_values(food, day_index, 2)


def _clean_string_list(value):
    if not isinstance(value, list):
        return []
    result = []
    for item in value:
        text = str(item).strip()
        if text:
            result.append(text)
    return result


def _is_vague_activity(value):
    text = str(value).strip()
    if not text:
        return True
    return bool(VAGUE_ACTIVITY_RE.search(text))


def _sanitize_itinerary(parsed, state):
    if not isinstance(parsed, list):
        return []

    fallback = _fallback_itinerary(state)
    fallback_by_day = {
        item.get("day"): item for item in fallback if isinstance(item, dict)
    }
    sanitized = []

    for index, item in enumerate(parsed):
        if not isinstance(item, dict):
            continue

        fallback_day = fallback_by_day.get(item.get("day")) or (
            fallback[index] if index < len(fallback) else {}
        )
        day = item.get("day") or fallback_day.get("day") or index + 1
        city = str(item.get("city") or fallback_day.get("city") or "目的地").strip()

        activities = [
            activity
            for activity in _clean_string_list(item.get("activities"))
            if not _is_vague_activity(activity)
        ]
        if len(activities) < 2:
            for fallback_activity in _specific_attractions_for_city(city, index, 3):
                if fallback_activity not in activities:
                    activities.append(fallback_activity)
                if len(activities) >= 2:
                    break

        food = _clean_string_list(item.get("food"))
        if not food or any(_is_vague_activity(food_item) for food_item in food):
            food = _specific_food_for_city(city, index)

        cost = str(item.get("cost") or fallback_day.get("cost") or "¥800").strip()

        sanitized.append(
            {
                "day": day,
                "city": city,
                "activities": activities[:4],
                "food": food[:3],
                "cost": cost,
            }
        )

    return sanitized or fallback


def _fallback_itinerary(state):
    cities = state.get("travel_order") or state.get("cities") or []
    if not isinstance(cities, list):
        cities = []
    cities = [str(city).strip() for city in cities if str(city).strip()]
    if not cities:
        cities = ["目的地"]

    city_days = state.get("city_days") if isinstance(state.get("city_days"), dict) else {}
    budget = _safe_positive_int(state.get("budget"), default=0)

    total_days = 0
    daily_plan = []
    for city in cities:
        days_in_city = _safe_positive_int(city_days.get(city), default=1)
        for _ in range(days_in_city):
            daily_plan.append(city)
        total_days += days_in_city

    if not daily_plan:
        daily_plan = [cities[0]]
        total_days = 1

    per_day_budget = max(150, budget // total_days) if budget > 0 else 800

    fallback = []
    for day_index, city in enumerate(daily_plan, start=1):
        city_day_index = sum(1 for previous_city in daily_plan[: day_index - 1] if previous_city == city)
        fallback.append(
            {
                "day": day_index,
                "city": city,
                "activities": _specific_attractions_for_city(city, city_day_index, 2),
                "food": _specific_food_for_city(city, city_day_index),
                "cost": f"¥{per_day_budget}",
            }
        )

    return fallback


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
    if client is None:
        print("OPENAI_API_KEY 未配置，使用 fallback itinerary。")
        return _fallback_itinerary(state)

    selected_flights = _format_selected_flights(state)
    selected_hotels = _format_selected_hotels(state)
    attached_files = _format_attached_files(state)
    final_note = (state.get("final_note") or "").strip() or "无"
    departure_date = (state.get("departure_date") or "").strip() or "未指定"
    date_flexibility = state.get("date_flexibility") or "flexible"
    date_mode_label = "灵活出行" if date_flexibility == "flexible" else "指定日期"
    travel_days = _safe_positive_int(state.get("travel_days"), default=0)

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
- 每天活动安排要与所选城市、出行日期和停留节奏匹配
- 每天 activities 必须给出 2-4 个真实、具体、可定位的景点/街区/博物馆/市场/寺社/餐饮区域名称
- 禁止输出“城市地标打卡”“本地文化体验”“当地特色体验”“城市漫步”“自由活动”等泛泛描述
- 如果城市有当地名称，请尽量使用具体中文名和常见英文/原文名，例如“埃菲尔铁塔与战神广场”“浅草寺与仲见世商店街”
- food 也要具体到餐饮区域或餐厅类型地点，例如“筑地场外市场寿司”“玛黑区小酒馆晚餐”

用户信息：
国家：{state.get("country")}
城市：{state.get("cities")}
出行日期：{departure_date}
日期类型：{date_mode_label}
总出行天数：{travel_days if travel_days > 0 else "未指定"}
城市停留节奏：{state.get("city_days")}
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

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你只输出 JSON 数组。所有景点必须是具体地名，"
                        "不能使用泛泛的旅行活动描述。"
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        text = response.choices[0].message.content
    except Exception as exc:
        print("OpenAI itinerary generation failed, using fallback:", exc)
        return _fallback_itinerary(state)

    if not text:
        return _fallback_itinerary(state)

    text = text.strip()

    parsed = _parse_itinerary_json(text)
    if parsed:
        return _sanitize_itinerary(parsed, state)

    print("JSON解析失败:", text)
    return _fallback_itinerary(state)
