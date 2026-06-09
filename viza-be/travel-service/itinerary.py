import json
import os
import re
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

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
    "里昂": "lyon",
    "lyon": "lyon",
    "马赛": "marseille",
    "marseille": "marseille",
    "尼斯": "nice",
    "nice": "nice",
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
    "长沙": "changsha",
    "长沙市": "changsha",
    "changsha": "changsha",
    "hunanchangsha": "changsha",
    "广州": "guangzhou",
    "guangzhou": "guangzhou",
    "杭州": "hangzhou",
    "hangzhou": "hangzhou",
    "张家界": "zhangjiajie",
    "zhangjiajie": "zhangjiajie",
    "旧金山": "sanfrancisco",
    "sanfrancisco": "sanfrancisco",
    "sf": "sanfrancisco",
    "比萨": "pisa",
    "pisa": "pisa",
    "巴厘岛": "bali",
    "bali": "bali",
    "登巴萨": "denpasar",
    "denpasar": "denpasar",
    "那不勒斯": "naples",
    "naples": "naples",
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
    "lyon": [
        "富维耶圣母圣殿",
        "里昂老城与圣让街区",
        "白莱果广场",
        "金头公园",
        "里昂美术馆",
        "特拉布勒隐秘通道",
        "红十字山街区",
        "里昂半岛 Presqu'ile",
    ],
    "marseille": [
        "马赛老港",
        "守护圣母圣殿",
        "卡朗格国家公园",
        "欧洲及地中海文明博物馆 Mucem",
        "伊夫堡",
        "勒帕尼耶老城区",
        "隆尚宫",
        "拉坎比耶尔大街",
    ],
    "nice": [
        "英国人漫步大道",
        "城堡山公园",
        "尼斯老城",
        "马塞纳广场",
        "萨雷雅市场",
        "马蒂斯美术馆",
        "俄罗斯东正教圣尼古拉主教座堂",
        "西米耶修道院花园",
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
    "changsha": [
        "岳麓山与岳麓书院",
        "橘子洲头",
        "湖南博物院",
        "太平老街",
        "坡子街与黄兴路步行街",
        "杜甫江阁",
        "开福寺",
        "梅溪湖国际文化艺术中心",
    ],
    "guangzhou": [
        "广州塔",
        "沙面岛",
        "陈家祠",
        "越秀公园与五羊石像",
        "北京路步行街",
        "珠江夜游",
        "广东省博物馆",
        "永庆坊",
    ],
    "hangzhou": [
        "西湖苏堤与白堤",
        "灵隐寺",
        "雷峰塔",
        "河坊街",
        "西溪国家湿地公园",
        "中国茶叶博物馆",
        "京杭大运河杭州段",
        "龙井村",
    ],
    "zhangjiajie": [
        "张家界国家森林公园",
        "天门山国家森林公园",
        "袁家界",
        "金鞭溪",
        "黄石寨",
        "大峡谷玻璃桥",
        "宝峰湖",
        "溪布街",
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
    "lyon": ["里昂老城 Bouchon 传统餐馆", "白莱果广场周边咖啡"],
    "marseille": ["马赛老港海鲜餐厅", "勒帕尼耶老城区咖啡馆"],
    "nice": ["萨雷雅市场尼斯沙拉", "尼斯老城小酒馆晚餐"],
    "singapore": ["老巴刹沙爹", "麦士威熟食中心海南鸡饭"],
    "sydney": ["岩石区早午餐", "邦迪海滩海鲜"],
    "london": ["博罗市场小吃", "Covent Garden 餐酒馆"],
    "rome": ["特拉斯提弗列意面", "Campo de' Fiori 披萨"],
    "seoul": ["广藏市场绿豆煎饼", "明洞韩式烤肉"],
    "bangkok": ["耀华力路街头小吃", "ICONSIAM 水上市场美食"],
    "hongkong": ["中环茶餐厅", "庙街煲仔饭"],
    "beijing": ["什刹海京味小吃", "前门烤鸭"],
    "changsha": ["坡子街臭豆腐", "文和友小龙虾"],
    "guangzhou": ["泮溪酒家早茶", "北京路糖水铺"],
    "hangzhou": ["湖滨杭帮菜", "龙井村茶点"],
    "zhangjiajie": ["三下锅", "土家腊肉"],
    "sanfrancisco": ["渡轮大厦市场", "渔人码头酸面包海鲜汤"],
    "pisa": ["骑士广场意式小馆", "阿诺河岸 Gelato"],
}


SPECIFIC_ATTRACTIONS_EN_BY_KEY = {
    "tokyo": [
        "Senso-ji Temple and Nakamise Street",
        "Tokyo Tower and Shiba Park",
        "Meiji Shrine",
        "Shibuya Crossing and Hachiko Statue",
        "Tsukiji Outer Market",
        "Ueno Park and Tokyo National Museum",
        "Shinjuku Gyoen National Garden",
        "teamLab Planets TOKYO Toyosu",
        "Akihabara Electric Town",
        "Harajuku Takeshita Street",
    ],
    "kyoto": [
        "Kiyomizu-dera and Ninenzaka Sannenzaka",
        "Fushimi Inari Taisha Thousand Torii Gates",
        "Kinkaku-ji",
        "Arashiyama Bamboo Grove and Togetsukyo Bridge",
        "Gion Hanamikoji Street",
        "Nijo Castle",
        "Philosopher's Path",
        "Nishiki Market",
    ],
    "osaka": [
        "Osaka Castle Park",
        "Dotonbori Glico Sign",
        "Kuromon Market",
        "Umeda Sky Building Floating Garden",
        "Tsutenkaku and Shinsekai",
        "Shinsaibashi-suji Shopping Street",
    ],
    "paris": [
        "Eiffel Tower and Champ de Mars",
        "Louvre Museum and Glass Pyramid",
        "Musee d'Orsay",
        "Notre-Dame and Ile de la Cite",
        "Sainte-Chapelle",
        "Montmartre and Sacre-Coeur",
        "Arc de Triomphe and Champs-Elysees",
        "Le Marais and Place des Vosges",
    ],
    "london": [
        "British Museum",
        "Tower Bridge and Tower of London",
        "Palace of Westminster and Big Ben",
        "Buckingham Palace",
        "Covent Garden",
        "Borough Market",
        "National Gallery",
        "Camden Market",
    ],
    "rome": [
        "Colosseum",
        "Roman Forum",
        "Pantheon",
        "Trevi Fountain",
        "Spanish Steps",
        "Vatican Museums and Sistine Chapel",
        "St. Peter's Basilica",
        "Trastevere",
    ],
    "singapore": [
        "Marina Bay Sands SkyPark",
        "Gardens by the Bay Cloud Forest and Supertree Grove",
        "Merlion Park",
        "Buddha Tooth Relic Temple in Chinatown",
        "Little India Serangoon Road",
        "Sentosa Siloso Beach",
    ],
    "sydney": [
        "Sydney Opera House",
        "Sydney Harbour Bridge lookout",
        "The Rocks",
        "Bondi Beach and Bondi to Coogee Coastal Walk",
        "Darling Harbour",
        "Royal Botanic Garden and Mrs Macquarie's Chair",
    ],
    "changsha": [
        "Yuelu Mountain and Yuelu Academy",
        "Orange Isle",
        "Hunan Museum",
        "Taiping Old Street",
        "Pozi Street and Huangxing Road Pedestrian Street",
        "Du Fu River Pavilion",
        "Kaifu Temple",
        "Meixihu International Culture and Arts Centre",
    ],
    "guangzhou": [
        "Canton Tower",
        "Shamian Island",
        "Chen Clan Ancestral Hall",
        "Yuexiu Park and Five Rams Statue",
        "Beijing Road Pedestrian Street",
        "Pearl River night cruise",
        "Guangdong Museum",
        "Yongqing Fang",
    ],
    "hangzhou": [
        "West Lake Su Causeway and Bai Causeway",
        "Lingyin Temple",
        "Leifeng Pagoda",
        "Hefang Street",
        "Xixi National Wetland Park",
        "National Tea Museum",
        "Hangzhou section of the Grand Canal",
        "Longjing Village",
    ],
    "zhangjiajie": [
        "Zhangjiajie National Forest Park",
        "Tianmen Mountain National Forest Park",
        "Yuanjiajie Scenic Area",
        "Golden Whip Stream",
        "Huangshi Village",
        "Grand Canyon Glass Bridge",
        "Baofeng Lake",
        "Xibu Street",
    ],
    "bali": [
        "Uluwatu Temple",
        "Tegallalang Rice Terrace",
        "Kuta Beach",
        "Ubud Monkey Forest",
        "Tanah Lot Temple",
        "Seminyak Beach",
    ],
    "denpasar": [
        "Bajra Sandhi Monument",
        "Badung Market",
        "Sanur Beach",
        "Bali Museum",
        "Puputan Square",
    ],
    "naples": [
        "Naples Historic Center",
        "Spaccanapoli",
        "National Archaeological Museum of Naples",
        "Castel dell'Ovo",
        "Piazza del Plebiscito",
        "Via Toledo",
    ],
    "pisa": [
        "Leaning Tower of Pisa",
        "Piazza dei Miracoli",
        "Pisa Cathedral",
        "Baptistery of San Giovanni",
        "Piazza dei Cavalieri",
        "Lungarni riverside walk",
    ],
}


SPECIFIC_FOOD_EN_BY_KEY = {
    "tokyo": ["Tsukiji Outer Market sushi", "Shinjuku Omoide Yokocho ramen"],
    "kyoto": ["Nishiki Market snacks", "Gion kaiseki dinner"],
    "osaka": ["Dotonbori takoyaki", "Kuromon Market seafood"],
    "paris": ["Saint-Germain croissant cafe", "Le Marais bistro dinner"],
    "london": ["Borough Market bites", "Covent Garden gastropub"],
    "rome": ["Trastevere pasta", "Campo de' Fiori pizza"],
    "singapore": ["Lau Pa Sat satay", "Maxwell Food Centre chicken rice"],
    "sydney": ["The Rocks brunch", "Bondi Beach seafood"],
    "changsha": ["Pozi Street stinky tofu", "Wenheyou crayfish"],
    "guangzhou": ["Panxi Restaurant dim sum", "Beijing Road dessert shop"],
    "hangzhou": ["Hubin Hangzhou cuisine", "Longjing Village tea snacks"],
    "zhangjiajie": ["Sanxiaguo hot pot", "Tujia cured pork"],
    "bali": ["Jimbaran seafood dinner", "Ubud cafe lunch"],
    "denpasar": ["Badung Market local lunch", "Sanur seafood dinner"],
    "naples": ["Spaccanapoli pizza", "Via Toledo espresso and pastry"],
    "pisa": ["Piazza dei Cavalieri trattoria", "Lungarni gelato"],
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


def _allowed_city_keys(state):
    cities = (state or {}).get("travel_order") or (state or {}).get("cities") or []
    if not isinstance(cities, list):
        return set()
    return {_canonical_city_key(str(city)) for city in cities if str(city).strip()}


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


def _is_english_state(state):
    locale = str((state or {}).get("locale") or (state or {}).get("export_language") or "").lower()
    return locale.startswith("en")


def _specific_attractions_for_city(city, day_index=0, count=2, language="zh"):
    is_english = str(language).lower().startswith("en")
    city_text = str(city).strip() or ("destination" if is_english else "目的地")
    key = _canonical_city_key(city_text)
    attractions = (
        SPECIFIC_ATTRACTIONS_EN_BY_KEY.get(key)
        if is_english
        else SPECIFIC_ATTRACTIONS_BY_KEY.get(key)
    )
    if not attractions:
        attractions = (
            [
                f"{city_text} central station area",
                f"{city_text} civic square",
                f"{city_text} central market",
                f"{city_text} history museum",
                f"{city_text} riverside walk",
            ]
            if is_english
            else [
                f"{city_text} 中央车站周边",
                f"{city_text} 市政厅广场",
                f"{city_text} 中央市场",
                f"{city_text} 历史博物馆",
                f"{city_text} 河岸步道",
            ]
        )
    return _rotated_values(attractions, day_index * count, count)


def _specific_food_for_city(city, day_index=0, language="zh"):
    is_english = str(language).lower().startswith("en")
    city_text = str(city).strip() or ("destination" if is_english else "目的地")
    key = _canonical_city_key(city_text)
    food = SPECIFIC_FOOD_EN_BY_KEY.get(key) if is_english else SPECIFIC_FOOD_BY_KEY.get(key)
    if not food:
        food = (
            [f"{city_text} central market restaurant", f"{city_text} old town cafe"]
            if is_english
            else [f"{city_text} 中央市场餐厅", f"{city_text} 老城区咖啡馆"]
        )
    return _rotated_values(food, day_index, 2)


def _reordered_activities_for_day(day, day_index):
    city = day.get("city") or "目的地"
    activities = [
        item
        for item in _clean_string_list(day.get("activities"))
        if not _is_vague_activity(item)
    ]
    for fallback_activity in _specific_attractions_for_city(city, day_index + 1, 4):
        if fallback_activity not in activities:
            activities.append(fallback_activity)
        if len(activities) >= 3:
            break

    if len(activities) <= 1:
        return activities

    return [activities[1], activities[0], *activities[2:]][:4]


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

    language = "en" if _is_english_state(state) else "zh"
    fallback = _fallback_itinerary(state)
    fallback_by_day = {
        item.get("day"): item for item in fallback if isinstance(item, dict)
    }
    allowed_city_keys = _allowed_city_keys(state)
    sanitized = []

    for index, item in enumerate(parsed):
        if not isinstance(item, dict):
            continue

        fallback_day = fallback_by_day.get(item.get("day")) or (
            fallback[index] if index < len(fallback) else {}
        )
        day = item.get("day") or fallback_day.get("day") or index + 1
        fallback_city = str(fallback_day.get("city") or "目的地").strip()
        city = str(item.get("city") or fallback_city).strip()
        city_was_replaced = False
        if allowed_city_keys and _canonical_city_key(city) not in allowed_city_keys:
            city = fallback_city
            city_was_replaced = True

        activities = [
            activity
            for activity in (
                [] if city_was_replaced else _clean_string_list(item.get("activities"))
            )
            if not _is_vague_activity(activity)
        ]
        if len(activities) < 2:
            for fallback_activity in _specific_attractions_for_city(
                city, index, 3, language
            ):
                if fallback_activity not in activities:
                    activities.append(fallback_activity)
                if len(activities) >= 2:
                    break

        food = [] if city_was_replaced else _clean_string_list(item.get("food"))
        if not food or any(_is_vague_activity(food_item) for food_item in food):
            food = _specific_food_for_city(city, index, language)

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
    language = "en" if _is_english_state(state) else "zh"
    cities = state.get("travel_order") or state.get("cities") or []
    if not isinstance(cities, list):
        cities = []
    cities = [str(city).strip() for city in cities if str(city).strip()]
    if not cities:
        cities = ["destination" if language == "en" else "目的地"]

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
                "activities": _specific_attractions_for_city(
                    city, city_day_index, 2, language
                ),
                "food": _specific_food_for_city(city, city_day_index, language),
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


REVISION_QUICK_REPLIES = [
    {"label": "便宜一点", "value": "把这次旅行便宜一点"},
    {"label": "减少航班", "value": "把航班去掉，尽量用其他交通方式"},
    {"label": "换4星酒店", "value": "把酒店换成4星酒店"},
    {"label": "加本地美食", "value": "每天加更多本地美食"},
    {"label": "重排行程", "value": "重新安排每天的顺序"},
]


def _extract_json_object(raw: str) -> str:
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw, re.IGNORECASE)
    if fenced:
        candidate = fenced.group(1).strip()
        if candidate:
            return candidate

    brace = re.search(r"\{[\s\S]*\}", raw)
    if brace:
        return brace.group(0).strip()

    return raw.strip()


def _parse_revision_json(raw: str):
    candidate = _extract_json_object(raw)
    if not candidate:
        return {}

    try:
        parsed = json.loads(candidate)
    except Exception:
        return {}

    return parsed if isinstance(parsed, dict) else {}


def _plain_text_reply(value):
    text = str(value or "").strip()

    def replace_code_block(match):
        body = (match.group(1) or "").strip()
        if body.startswith("{") or body.startswith("["):
            return ""
        return body

    text = re.sub(r"```(?:[A-Za-z0-9_-]+)?\s*([\s\S]*?)```", replace_code_block, text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = re.sub(r"^\s{0,3}#{1,6}\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(
        r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$",
        "",
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(
        r"^\s*\|(.+)\|\s*$",
        lambda match: "，".join(
            cell.strip() for cell in match.group(1).split("|") if cell.strip()
        ),
        text,
        flags=re.MULTILINE,
    )
    text = re.sub(r"\*\*([^*\n]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_\n]+)__", r"\1", text)
    text = re.sub(r"\*([^*\n]+)\*", r"\1", text)
    text = re.sub(r"_([^_\n]+)_", r"\1", text)
    text = re.sub(r"`([^`\n]+)`", r"\1", text)
    text = re.sub(r"\s+\|\s+", "，", text)
    text = re.sub(r"\s+->\s+", " 到 ", text)
    text = re.sub(r"^\s*---+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _clean_revision_quick_replies(value, action):
    source = value if isinstance(value, list) and value else REVISION_QUICK_REPLIES
    replies = []
    for item in source:
        if not isinstance(item, dict):
            continue
        label = _plain_text_reply(item.get("label") or "")
        reply_value = _plain_text_reply(item.get("value") or label)
        if label and reply_value:
            replies.append({"label": label, "value": reply_value})
        if len(replies) >= 5:
            break

    if action == "restart":
        return [
            {"label": "想去日本", "value": "想去日本"},
            {"label": "想去欧洲", "value": "想去欧洲"},
            {"label": "我不知道去哪", "value": "我不知道去哪"},
        ]

    return replies or REVISION_QUICK_REPLIES


def _revision_response(
    action,
    reply,
    itinerary,
    state_patch=None,
    module_patch=None,
    edit_summary="",
    quick_replies=None,
):
    return {
        "action": action,
        "reply": _plain_text_reply(reply),
        "itinerary": itinerary if isinstance(itinerary, list) else [],
        "state_patch": state_patch if isinstance(state_patch, dict) else {},
        "module_patch": module_patch if isinstance(module_patch, dict) else {},
        "edit_summary": _plain_text_reply(edit_summary),
        "quick_replies": _clean_revision_quick_replies(quick_replies, action),
    }


def _itinerary_signature(itinerary):
    if not isinstance(itinerary, list):
        return ""

    normalized = []
    for day in itinerary:
        if not isinstance(day, dict):
            continue
        normalized.append(
            {
                "day": str(day.get("day") or ""),
                "city": str(day.get("city") or "").strip(),
                "activities": [
                    str(item).strip()
                    for item in (day.get("activities") or [])
                    if str(item).strip()
                ]
                if isinstance(day.get("activities"), list)
                else [],
                "food": [
                    str(item).strip()
                    for item in (day.get("food") or [])
                    if str(item).strip()
                ]
                if isinstance(day.get("food"), list)
                else [],
                "cost": str(day.get("cost") or "").strip(),
            }
        )

    return json.dumps(normalized, ensure_ascii=False, sort_keys=True)


def _has_revision_patch(value):
    return isinstance(value, dict) and bool(value)


def _coerce_revision_response(parsed, state, current_itinerary):
    current = _sanitize_itinerary(current_itinerary, state)
    if not isinstance(parsed, dict):
        return _revision_response(
            "clarify",
            "我还没完全理解要怎么改这份行程。你可以告诉我是要改哪一天、预算、酒店、航班，还是想整份重来。",
            current,
            edit_summary="需要用户补充修改方向",
        )

    action = str(parsed.get("action") or "").strip().lower()
    if action not in {"revise", "restart", "clarify"}:
        action = "clarify"

    reply = str(parsed.get("reply") or "").strip()
    edit_summary = str(parsed.get("edit_summary") or "").strip()
    state_patch = parsed.get("state_patch") if isinstance(parsed.get("state_patch"), dict) else {}
    module_patch = parsed.get("module_patch") if isinstance(parsed.get("module_patch"), dict) else {}
    quick_replies = parsed.get("quick_replies")

    if action == "restart":
        return _revision_response(
            "restart",
            reply
            or "可以，我们保留旧版本，先回到地图重新规划。你可以重新选国家、城市、天数、预算和偏好。",
            current,
            state_patch={"reset": True},
            module_patch=module_patch,
            edit_summary=edit_summary or "用户要求重新规划",
            quick_replies=quick_replies,
        )

    if action == "clarify":
        return _revision_response(
            "clarify",
            reply
            or "我可以继续改这份行程。你想改哪一天、哪个城市、预算、酒店，还是交通方式？",
            current,
            state_patch=state_patch,
            module_patch=module_patch,
            edit_summary=edit_summary or "需要用户确认修改范围",
            quick_replies=quick_replies,
        )

    raw_itinerary = parsed.get("itinerary")
    revised = _sanitize_itinerary(raw_itinerary, state) if isinstance(raw_itinerary, list) else []
    if not revised:
        return _revision_response(
            "clarify",
            "我尝试修改了，但返回的行程格式不稳定。请再说一次要修改的点，我会保留当前版本不变。",
            current,
            edit_summary="revision schema invalid",
        )

    if (
        _itinerary_signature(revised) == _itinerary_signature(current)
        and not _has_revision_patch(state_patch)
        and not _has_revision_patch(module_patch)
    ):
        return _revision_response(
            "clarify",
            "可以，我能帮你增加一天。你想把这一天加在哪个城市？也可以告诉我想加入的景点，比如长城、迪士尼或某个街区；如果你不确定，我可以按当前路线帮你放到最顺的一站。",
            current,
            edit_summary="OpenAI returned unchanged itinerary",
        )

    return _revision_response(
        "revise",
        reply or "已更新行程，并尽量保留没有被你提到的城市、酒店和交通安排。",
        revised,
        state_patch=state_patch,
        module_patch=module_patch,
        edit_summary=edit_summary or "已按用户要求更新行程",
        quick_replies=quick_replies,
    )


def _prompt_requests_restart(prompt):
    return bool(
        re.search(
            r"(重来|重做|从头|回到地图|退回地图|重新选|重新规划|重新生成|重新开始|"
            r"不要这个|不要这份|换一个方案|换一个行程|start over|from scratch|restart|redo|replan)",
            prompt,
            re.IGNORECASE,
        )
    )


def _prompt_requests_remove_flights(prompt):
    return bool(
        re.search(
            r"((去掉|不要|移除|删除|删掉|减少|少).*(航班|机票|flight))|((航班|机票|flight).*(去掉|不要|移除|删除|删掉|减少|少))",
            prompt,
            re.IGNORECASE,
        )
    )


def _prompt_requests_cheaper(prompt):
    return bool(re.search(r"(便宜|省钱|降低预算|预算低|cheaper|budget|save)", prompt, re.IGNORECASE))


def _prompt_requests_shopping(prompt):
    return bool(re.search(r"(购物|买东西|商场|shopping|outlet)", prompt, re.IGNORECASE))


def _prompt_requests_food(prompt):
    return bool(re.search(r"(美食|吃|餐厅|小吃|food|restaurant)", prompt, re.IGNORECASE))


def _prompt_requests_four_star_hotels(prompt):
    return bool(re.search(r"(4星|四星|four.?star|4.?star)", prompt, re.IGNORECASE))


def _prompt_requests_reorder(prompt):
    return bool(
        re.search(
            r"(重排|重新安排|顺序|动线|路线更顺|少走路|少折返|优化.*行程|优化.*路线|reorder|optimi[sz]e)",
            prompt,
            re.IGNORECASE,
        )
    )


def _parse_day_targets(prompt):
    targets = set()
    chinese_numbers = {
        "一": 1,
        "二": 2,
        "两": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "十": 10,
    }

    for match in re.finditer(r"第\s*(\d+)\s*天", prompt):
        targets.add(int(match.group(1)))

    for match in re.finditer(r"第\s*([一二两三四五六七八九十])\s*天", prompt):
        targets.add(chinese_numbers.get(match.group(1), 0))

    for match in re.finditer(r"day\s*(\d+)", prompt, re.IGNORECASE):
        targets.add(int(match.group(1)))

    return {target for target in targets if target > 0}


def _with_cheaper_cost(cost):
    text = str(cost or "").strip()
    match = re.search(r"(\d+)", text)
    if not match:
        return "¥500"
    amount = int(match.group(1))
    cheaper = max(120, int(amount * 0.75))
    return f"¥{cheaper}"


def _fallback_revision(request):
    state = request.get("state") if isinstance(request.get("state"), dict) else {}
    prompt = str(request.get("user_prompt") or "").strip()
    current_itinerary = request.get("current_itinerary")
    current = _sanitize_itinerary(current_itinerary, state)

    if not prompt:
        return _revision_response(
            "clarify",
            "你想怎么修改这份行程？可以说要改哪一天、降低预算、去掉航班，或重新规划。",
            current,
            edit_summary="等待用户说明修改方向",
        )

    if _prompt_requests_restart(prompt):
        return _revision_response(
            "restart",
            "可以，我们保留当前版本，先回到地图重新规划。你可以重新选择目的地或告诉我新的旅行偏好。",
            current,
            state_patch={"reset": True},
            edit_summary="用户要求重新规划",
        )

    revised = [dict(day) for day in current]
    day_targets = _parse_day_targets(prompt)
    target_indexes = [
        index
        for index, day in enumerate(revised)
        if not day_targets or _safe_positive_int(day.get("day"), default=index + 1) in day_targets
    ]

    if _prompt_requests_reorder(prompt):
        for index in target_indexes[: max(1, len(target_indexes))]:
            revised[index]["activities"] = _reordered_activities_for_day(revised[index], index)

    if _prompt_requests_shopping(prompt):
        for index in target_indexes[: max(1, len(target_indexes))]:
            city = revised[index].get("city") or "目的地"
            revised[index]["activities"] = [
                f"{city} 核心商圈与百货购物",
                f"{city} 本地设计店与生活方式街区",
                f"{city} 伴手礼市场",
            ]

    if _prompt_requests_food(prompt):
        for index in target_indexes[: max(1, len(target_indexes))]:
            city = revised[index].get("city") or "目的地"
            revised[index]["food"] = _specific_food_for_city(city, index)

    if _prompt_requests_cheaper(prompt):
        for day in revised:
            day["cost"] = _with_cheaper_cost(day.get("cost"))

    module_patch = {}
    if _prompt_requests_remove_flights(prompt):
        module_patch["remove_flights"] = True
        module_patch["flight_policy"] = "skip_all"

    if _prompt_requests_four_star_hotels(prompt):
        module_patch["hotel_note"] = "用户要求酒店调整为4星级。"

    summary_parts = []
    if _prompt_requests_reorder(prompt):
        summary_parts.append("已重排每天景点顺序，让路线更顺")
    if _prompt_requests_shopping(prompt):
        summary_parts.append("已把相关日期调整为购物和街区探索")
    if _prompt_requests_food(prompt):
        summary_parts.append("已增加本地美食安排")
    if _prompt_requests_cheaper(prompt):
        summary_parts.append("已降低每日预算文案")
    if module_patch.get("remove_flights"):
        summary_parts.append("已标记航班可移除或跳过")
    if module_patch.get("hotel_note"):
        summary_parts.append("已记录4星酒店偏好")

    if not summary_parts:
        summary_parts.append("已按你的要求保留原路线并轻量调整行程说明")

    return _revision_response(
        "revise",
        "已更新行程：" + "；".join(summary_parts) + "。没有提到的城市、天数和酒店我会尽量保留。",
        revised,
        module_patch=module_patch,
        edit_summary="；".join(summary_parts),
    )


def _openai_revision_unavailable(reason, current):
    return _revision_response(
        "clarify",
        f"这次行程修改需要 OpenAI API 来理解并重写 itinerary，但{reason}。我没有改动当前行程，请配置或恢复 OpenAI 后再试一次。",
        current,
        edit_summary="OpenAI revision unavailable",
    )


def revise_itinerary(request):
    state = request.get("state") if isinstance(request.get("state"), dict) else {}
    current_itinerary = request.get("current_itinerary")
    prompt_text = str(request.get("user_prompt") or "").strip()
    current = _sanitize_itinerary(current_itinerary, state)

    if client is None:
        print("OPENAI_API_KEY 未配置，无法执行 OpenAI itinerary revision。")
        return _openai_revision_unavailable("OPENAI_API_KEY 未配置", current)

    active_modules = request.get("active_modules") if isinstance(request.get("active_modules"), dict) else {}
    prompt = f"""
你是 VIZA Travel AI 的行程修订引擎。你需要判断用户是在局部修改当前行程、要求整份重来，还是需要澄清。

必须只输出 JSON object，不要 Markdown，不要额外解释。
reply 字段必须是自然中文纯文本，不能包含 Markdown 标题、列表符号、粗体、斜体、表格、代码块、JSON、XML 或 HTML。
如果需要分点说明，请写成普通短句或中文自然段，不要使用 #、-、*、`、| 等 Markdown 语法符号。

动作规则：
- action = "revise"：用户提出可执行的小改或中等修改。必须返回完整更新后的 itinerary。
- action = "restart"：用户明确说不喜欢这份、重来、重新规划、从头开始、回到地图等。不要删除旧版本。
- action = "clarify"：用户意图不足以安全修改，或是在问一个需要先确认的问题。

修订要求：
- 局部修改必须尽量保留未被用户提到的城市、天数、酒店、航班和已有安排。
- 每一条自然语言修改都必须实际反映到 itinerary 或 state_patch；不要只改 reply 或 edit_summary。
- 如果用户要求增加一天、减少一天、延长/缩短行程，必须调整 itinerary 天数，并在 state_patch.travel_days 与 state_patch.city_days 中同步。
- 如果用户说“还想去/加/加入”某个城市或景点，必须把它加入合适日期；如果他说“最后一天”，就放到 itinerary 最后一天。
- 景点和城市要按常识归属处理，例如“长城”归入北京/中国；如果用户要求加一天去长城，就新增或调整最后一天为北京长城相关安排。
- 如果新增城市不在当前 state.cities 中，必须在 state_patch.cities、state_patch.countries、state_patch.travel_order 和 state_patch.city_days 中补齐。
- itinerary 必须是完整 JSON 数组，每天包含 day、city、activities、food、cost。
- activities 必须是真实、具体、可定位的景点/街区/市场/博物馆/餐饮区域，不能泛泛写“本地文化体验”。
- 如果用户要移除航班，在 module_patch 里输出 {{"remove_flights": true, "flight_policy": "skip_all"}}。
- 如果用户要求酒店变化但没有真实可查的新酒店，只在 module_patch.hotel_note 写明偏好，不要编造供应商结果。
- 如果 action 是 restart 或 clarify，itinerary 原样返回当前行程。

输出 schema：
{{
  "action": "revise | restart | clarify",
  "reply": "给用户看的中文回复",
  "itinerary": [],
  "state_patch": {{}},
  "module_patch": {{}},
  "edit_summary": "一句话说明改了什么",
  "quick_replies": [{{"label": "便宜一点", "value": "把这次旅行便宜一点"}}]
}}

当前 travel state:
{json.dumps(state, ensure_ascii=False)}

当前模块快照:
{json.dumps(active_modules, ensure_ascii=False)}

当前 itinerary:
{json.dumps(current, ensure_ascii=False)}

用户修改 prompt:
{prompt_text}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是严格的 JSON schema 输出器。只能输出一个 JSON object。"
                        "reply 字段必须是给用户看的中文纯文本，不能包含 Markdown、代码块或 JSON。"
                        "不要把局部修改扩散到未被用户提到的城市、酒店、航班或天数。"
                    ),
                },
                {"role": "user", "content": prompt},
            ],
        )
        text = response.choices[0].message.content
    except Exception as exc:
        print("OpenAI itinerary revision failed:", exc)
        return _openai_revision_unavailable("OpenAI 调用失败", current)

    parsed = _parse_revision_json(text or "")
    if not parsed:
        print("Revision JSON解析失败:", text)
        return _revision_response(
            "clarify",
            "我尝试理解这次修改，但返回格式不稳定。请再发一次修改要求，我会保留当前版本不变。",
            current,
            edit_summary="revision schema invalid",
        )

    return _coerce_revision_response(parsed, state, current)


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
                f"航段{leg_index}：{from_city} 到 {to_city}（{departure_date}），用户选择其他交通方式"
            )
            continue

        option = flight.get("option") if isinstance(flight.get("option"), dict) else {}
        airline = option.get("airline", "未知航司")
        price = option.get("price", "-")
        currency = option.get("currency", "CNY")
        departure_time = option.get("departure", departure_date)
        lines.append(
            f"航段{leg_index}：{from_city} 到 {to_city}，{airline}，{price} {currency}，出发 {departure_time}"
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
            f"城市{stay_index}：{city}，{check_in} 到 {check_out}，{nights}晚，{name}，{price} {currency}/晚，评分 {rating}"
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
        lines.append(normalized)

    return "\n".join(lines) if lines else "无"


def generate_itinerary(state):
    if client is None:
        print("OPENAI_API_KEY 未配置，使用 fallback itinerary。")
        return _fallback_itinerary(state)

    locale = str(state.get("locale") or state.get("export_language") or "zh-CN").lower()
    is_english = locale.startswith("en")
    language_requirement = (
        "- Use English for every user-facing itinerary field, including city names, activities, food, and cost notes"
        if is_english
        else "- 使用中文"
    )
    date_mode_label = (
        "flexible dates" if is_english and state.get("date_flexibility") == "flexible"
        else "fixed date" if is_english
        else "灵活出行" if state.get("date_flexibility") == "flexible"
        else "指定日期"
    )
    output_example = (
        """
[
  {
    "day": 1,
    "city": "Tokyo",
    "activities": ["Senso-ji Temple and Nakamise Street", "Akihabara Electric Town"],
    "food": ["Tsukiji Outer Market sushi", "Shinjuku Omoide Yokocho ramen"],
    "cost": "¥800"
  }
]
"""
        if is_english
        else """
[
  {
    "day": 1,
    "city": "东京",
    "activities": ["参观浅草寺", "游览秋叶原"],
    "food": ["寿司", "拉面"],
    "cost": "¥800"
  }
]
"""
    )
    selected_flights = _format_selected_flights(state)
    selected_hotels = _format_selected_hotels(state)
    attached_files = _format_attached_files(state)
    final_note = (state.get("final_note") or "").strip() or "无"
    departure_date = (state.get("departure_date") or "").strip() or "未指定"
    date_flexibility = state.get("date_flexibility") or "flexible"
    travel_days = _safe_positive_int(state.get("travel_days"), default=0)

    prompt = f"""
你是一位专业旅行规划师，请根据用户需求生成详细行程。

要求：
{language_requirement}
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
- 如果语言要求是 English，不要把城市、景点、酒店、航司或说明混入中文；酒店和航班名称优先保留官方/API 原名

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

返回 JSON（不要 ```json，不要 Markdown，不要额外解释）：

{output_example}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.4,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你只输出 JSON 数组，不要 Markdown 或代码块。所有景点必须是具体地名，"
                        "不能使用泛泛的旅行活动描述。"
                        + (
                            " All user-facing itinerary text must be English."
                            if is_english
                            else ""
                        )
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
