from datetime import date, timedelta
import re


TABLE_KEYS = ["time", "type", "date", "route", "name", "details", "contact"]
ZH_TABLE_HEADERS = [
    "时间",
    "类型",
    "日期/天数",
    "城市/路线",
    "名称",
    "详情",
    "联系电话/航班号",
]
EN_TABLE_HEADERS = [
    "Time",
    "Type",
    "Date/Day",
    "City/Route",
    "Name",
    "Details",
    "Phone/Flight No.",
]

TYPE_TRANSLATIONS = {
    "景点": "Attraction",
    "酒店": "Hotel",
    "航班": "Flight",
    "餐饮": "Dining",
}

TEXT_TRANSLATIONS = (
    ("上午", "Morning"),
    ("下午", "Afternoon"),
    ("晚上", "Evening"),
    ("午餐", "Lunch"),
    ("晚餐", "Dinner"),
    ("出发", "Departure"),
    ("到达", "Arrival"),
    ("入住", "Check-in"),
    ("退房", "Check-out"),
    ("地址", "Address"),
    ("价格", "Price"),
    ("机场", "Airport"),
    ("时长", "Duration"),
    ("经停", "Stops"),
    ("直飞", "Direct"),
    ("次中转", " stop(s)"),
    ("舱位", "Cabin"),
    ("航司", "Airline"),
    ("航班号", "Flight No."),
    ("餐饮", "Dining"),
    ("建议停留", "Suggested stay"),
    ("小时", "hour(s)"),
    ("继续游览", "Continue visiting"),
    ("游览", "Visit"),
    ("抵达并", "Arrive and "),
    ("可安排拍照、步行和周边街区体验", "photo stops, walking and nearby neighborhood exploration"),
    ("安排拍照、步行和周边体验", "photo stops, walking and nearby exploration"),
    ("请通过预订平台确认", "Confirm via booking platform"),
    ("待酒店 API 确认", "To be confirmed by hotel API"),
    ("默认航班（可编辑）", "Default flight (editable)"),
    ("默认酒店（可编辑）", "Default hotel (editable)"),
    ("市中心区域", "city center area"),
    ("晚", "night(s)"),
    ("天", "Day"),
)


def _as_text(value, fallback="-"):
    if value is None:
        return fallback
    text = str(value).strip()
    return text or fallback


def _join_items(items):
    if not isinstance(items, list):
        return "-"
    values = [_as_text(item, "") for item in items]
    values = [value for value in values if value]
    return "、".join(values) if values else "-"


def _format_money(option):
    if not isinstance(option, dict):
        return "-"
    raw_price = (
        option.get("total_price")
        or option.get("average_price_per_night")
        or option.get("price_per_night")
        or option.get("price")
    )
    if raw_price in (None, ""):
        return "-"
    currency = _as_text(option.get("currency"), "")
    label = "AU$" if currency.upper() == "AUD" else currency
    return f"{label}{raw_price}" if label and label not in str(raw_price) else str(raw_price)


def _safe_positive_int(value, default=1):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _parse_date(value):
    try:
        return date.fromisoformat(_as_text(value, "").split("T")[0])
    except ValueError:
        return date.today()


def _format_month_day(value):
    parsed = _parse_date(value)
    return f"{parsed.month}月{parsed.day}日"


def _extract_clock_time(value, fallback):
    text = _as_text(value, "")
    match = re.search(r"(?:T|\s)(\d{1,2}):(\d{2})", text)
    if not match:
        match = re.search(r"\b(\d{1,2}):(\d{2})\b", text)
    if not match:
        return fallback
    return f"{int(match.group(1)):02d}:{match.group(2)}"


def _time_to_minutes(value):
    match = re.search(r"(\d{1,2}):(\d{2})", _as_text(value, ""))
    if not match:
        return 0
    return int(match.group(1)) * 60 + int(match.group(2))


def _day_number_from_value(value):
    if isinstance(value, (int, float)):
        return max(1, int(value))
    match = re.search(r"\d+", _as_text(value, ""))
    return max(1, int(match.group(0))) if match else 1


def _day_number_from_date(value, state):
    start = _parse_date(state.get("departure_date"))
    target = _parse_date(value)
    return max(1, (target - start).days + 1)


def _sort_key(day_number, time):
    return day_number * 1440 + _time_to_minutes(time)


def _timeline_row(day_number, time, row):
    next_row = {
        "time": time,
        "type": _as_text(row.get("type")),
        "date": _as_text(row.get("date")),
        "route": _as_text(row.get("route")),
        "name": _as_text(row.get("name")),
        "details": _as_text(row.get("details")),
        "contact": _as_text(row.get("contact")),
        "_sort": _sort_key(day_number, time),
    }
    return next_row


def _cities_from_state(state):
    cities = state.get("travel_order") or state.get("cities") or []
    if not isinstance(cities, list):
        return []
    return [_as_text(city, "") for city in cities if _as_text(city, "")]


def _normalized_itinery_rows(rows):
    if not isinstance(rows, list):
        return []

    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized.append(
            {
                "time": _as_text(row.get("time")),
                "type": _as_text(row.get("type")),
                "date": _as_text(row.get("date")),
                "route": _as_text(row.get("route")),
                "name": _as_text(row.get("name")),
                "details": _as_text(row.get("details")),
                "contact": _as_text(row.get("contact")),
            }
        )

    return normalized


def _default_flight_number(route):
    seed = abs(hash(route)) % 900 + 100
    return f"VZ{seed}"


def _build_activity_rows(itinerary):
    rows = []
    for day in itinerary or []:
        if not isinstance(day, dict):
            continue
        day_number = _day_number_from_value(day.get("day"))
        day_label = f"天 {day_number}"
        city = _as_text(day.get("city"))
        activities = day.get("activities") if isinstance(day.get("activities"), list) else []
        food_items = day.get("food") if isinstance(day.get("food"), list) else []
        first_activity = _as_text(activities[0] if activities else f"{city}城市地标")
        second_activity = _as_text(
            activities[1] if len(activities) > 1 else activities[0] if activities else f"{city}街区体验"
        )

        rows.append(
            _timeline_row(
                day_number,
                "09:00 上午",
                {
                    "type": "景点",
                    "date": day_label,
                    "route": city,
                    "name": first_activity,
                    "details": f"上午：游览 {first_activity}，建议停留 2-3 小时。",
                    "contact": "-",
                },
            )
        )
        if food_items:
            rows.append(
                _timeline_row(
                    day_number,
                    "12:30 午餐",
                    {
                        "type": "餐饮",
                        "date": day_label,
                        "route": city,
                        "name": _as_text(food_items[0]),
                        "details": f"午餐：{_as_text(food_items[0])}。",
                        "contact": "-",
                    },
                )
            )
        rows.append(
            _timeline_row(
                day_number,
                "14:30 下午",
                {
                    "type": "景点",
                    "date": day_label,
                    "route": city,
                    "name": second_activity,
                    "details": f"下午：继续游览 {second_activity}，安排拍照、步行和周边体验。",
                    "contact": "-",
                },
            )
        )
        if len(food_items) > 1:
            rows.append(
                _timeline_row(
                    day_number,
                    "18:30 晚餐",
                    {
                        "type": "餐饮",
                        "date": day_label,
                        "route": city,
                        "name": _as_text(food_items[1]),
                        "details": f"晚餐：{_as_text(food_items[1])}。",
                        "contact": "-",
                    },
                )
            )

    return rows


def _build_default_hotel_rows(state):
    cities = _cities_from_state(state)
    if not cities:
        return []

    city_days = state.get("city_days") if isinstance(state.get("city_days"), dict) else {}
    start_date = _parse_date(state.get("departure_date"))
    rows = []
    elapsed_days = 0

    for city in cities:
        day_count = _safe_positive_int(city_days.get(city), default=1)
        nights = max(1, day_count - 1)
        check_in = start_date + timedelta(days=elapsed_days)
        check_out = check_in + timedelta(days=nights)
        rows.append(
            _timeline_row(
                elapsed_days + 1,
                "15:00 入住",
                {
                    "type": "酒店",
                    "date": f"{_format_month_day(check_in.isoformat())} - {_format_month_day(check_out.isoformat())}",
                    "route": city,
                    "name": f"{city}默认酒店（可编辑）",
                    "details": f"{nights}晚；地址：{city}市中心区域；价格：待酒店 API 确认；入住 15:00，退房 11:00。",
                    "contact": "请通过预订平台确认",
                },
            )
        )
        elapsed_days += day_count

    return rows


def _build_selected_hotel_rows(state):
    rows = []
    selected_hotels = state.get("selected_hotels") or []
    for hotel in selected_hotels:
        if not isinstance(hotel, dict):
            continue
        option = hotel.get("option") if isinstance(hotel.get("option"), dict) else {}
        city = _as_text(hotel.get("city"))
        check_in = _as_text(hotel.get("check_in"))
        check_out = _as_text(hotel.get("check_out"))
        check_in_time = _extract_clock_time(option.get("check_in_time"), "15:00")
        check_out_time = _as_text(option.get("check_out_time"), "11:00")
        address = _as_text(option.get("address"), f"{city}市中心区域")
        price = _format_money(option)
        contact = (
            _as_text(option.get("contact_phone"), "")
            or _as_text(option.get("website"), "")
            or _as_text(option.get("contact_email"), "")
            or "请通过预订平台确认"
        )

        rows.append(
            _timeline_row(
                _day_number_from_date(check_in, state),
                f"{check_in_time} 入住",
                {
                    "type": "酒店",
                    "date": f"{_format_month_day(check_in)} - {_format_month_day(check_out)}",
                    "route": city,
                    "name": _as_text(option.get("name"), f"{city}酒店"),
                    "details": f"{_as_text(hotel.get('nights'))}晚；地址：{address}；价格：{price}；入住 {check_in_time}，退房 {check_out_time}。",
                    "contact": contact,
                },
            )
        )

    return rows


def _build_default_flight_rows(state):
    cities = _cities_from_state(state)
    if not cities:
        return []

    origin = _as_text(state.get("origin_city"), cities[0])
    return_city = _as_text(state.get("return_city"), origin)
    first_city = cities[0]
    last_city = cities[-1]
    start_date = _parse_date(state.get("departure_date"))
    total_days = _safe_positive_int(state.get("travel_days"), default=len(cities))
    rows = []

    if origin != first_city:
        route = f"{origin} → {first_city}"
        rows.append(
            _timeline_row(
                1,
                "08:00 出发",
                {
                    "type": "航班",
                    "date": _format_month_day(start_date.isoformat()),
                    "route": route,
                    "name": "默认航班（可编辑）",
                    "details": "出发 08:00；预计经济舱；用户可修改时间、价格和航司。",
                    "contact": _default_flight_number(route),
                },
            )
        )

    if last_city != return_city:
        return_date = start_date + timedelta(days=max(0, total_days - 1))
        route = f"{last_city} → {return_city}"
        rows.append(
            _timeline_row(
                max(1, total_days),
                "18:00 出发",
                {
                    "type": "航班",
                    "date": _format_month_day(return_date.isoformat()),
                    "route": route,
                    "name": "默认航班（可编辑）",
                    "details": "出发 18:00；预计经济舱；用户可修改时间、价格和航司。",
                    "contact": _default_flight_number(route),
                },
            )
        )

    if not rows:
        route = f"{origin} → {first_city}"
        rows.append(
            _timeline_row(
                1,
                "08:00 出发",
                {
                    "type": "航班",
                    "date": _format_month_day(start_date.isoformat()),
                    "route": route,
                    "name": "默认航班（可编辑）",
                    "details": "出发 08:00；预计经济舱；用户可修改出发/到达城市和航班号。",
                    "contact": _default_flight_number(route),
                },
            )
        )

    return rows


def _build_selected_flight_rows(state):
    rows = []
    selected_flights = state.get("selected_flights") or []
    for flight in selected_flights:
        if not isinstance(flight, dict) or flight.get("skip"):
            continue
        option = flight.get("option") if isinstance(flight.get("option"), dict) else {}
        route = f"{_as_text(flight.get('from'))} → {_as_text(flight.get('to'))}"
        departure_time = _extract_clock_time(option.get("departure"), "08:00")
        airline = option.get("airline") or option.get("provider") or "已选航班"
        flight_number = _as_text(option.get("flight_number"), _default_flight_number(route))
        airport_parts = [
            _as_text(option.get("from_id") or option.get("from"), ""),
            _as_text(option.get("to_id") or option.get("to"), ""),
        ]
        airports = " → ".join(part for part in airport_parts if part)
        stops = option.get("stops")
        stops_text = "直飞" if stops == 0 else f"{_as_text(stops)}次中转"
        detail_items = [
            f"出发：{_as_text(option.get('departure'), departure_time)}",
            f"到达：{_as_text(option.get('arrival'), '-')}",
            f"机场：{airports}" if airports else "",
            f"时长：{_as_text(option.get('duration'))}",
            f"经停：{stops_text}",
            f"舱位：{_as_text(option.get('cabin_class'))}",
            f"价格：{_format_money(option)}",
        ]

        rows.append(
            _timeline_row(
                _day_number_from_date(flight.get("departure_date"), state),
                f"{departure_time} 出发",
                {
                    "type": "航班",
                    "date": _format_month_day(flight.get("departure_date")),
                    "route": route,
                    "name": f"{_as_text(airline)} {flight_number}",
                    "details": "；".join(
                        item for item in detail_items if item and not item.endswith("：-")
                    ),
                    "contact": flight_number,
                },
            )
        )

    return rows


def build_itinery_rows(itinerary, state):
    provided_rows = _normalized_itinery_rows(state.get("itinery_rows"))
    if provided_rows:
        return provided_rows

    rows = []
    rows.extend(_build_selected_flight_rows(state))
    if not rows:
        rows.extend(_build_default_flight_rows(state))

    hotel_rows = _build_selected_hotel_rows(state)
    rows.extend(hotel_rows if hotel_rows else _build_default_hotel_rows(state))
    rows.extend(_build_activity_rows(itinerary))

    rows.sort(key=lambda item: item.get("_sort", 0))
    return [{key: _as_text(row.get(key)) for key in TABLE_KEYS} for row in rows]


def normalize_export_language(value):
    text = _as_text(value, "zh").lower()
    if text in {"en", "english"}:
        return "en"
    if text in {"bilingual", "both", "zh-en", "zh_en"}:
        return "bilingual"
    return "zh"


def get_table_headers(language):
    normalized = normalize_export_language(language)
    if normalized == "en":
        return EN_TABLE_HEADERS
    if normalized == "bilingual":
        return [f"{zh} / {en}" for zh, en in zip(ZH_TABLE_HEADERS, EN_TABLE_HEADERS)]
    return ZH_TABLE_HEADERS


def _translate_text(value):
    text = _as_text(value)
    text = re.sub(r"天\s*(\d+)", r"Day \1", text)
    text = re.sub(r"(\d+)月(\d+)日", r"\1/\2", text)
    for source, target in TEXT_TRANSLATIONS:
        text = text.replace(source, target)
    return text


def _translate_cell(key, value):
    if key == "type":
        return TYPE_TRANSLATIONS.get(_as_text(value), _translate_text(value))
    return _translate_text(value)


def localize_itinery_row(row, language):
    normalized = normalize_export_language(language)
    localized = {}
    for key in TABLE_KEYS:
        zh_value = _as_text(row.get(key))
        en_value = _translate_cell(key, zh_value)
        if normalized == "en":
            localized[key] = en_value
        elif normalized == "bilingual":
            localized[key] = zh_value if zh_value == en_value else f"{zh_value}\n{en_value}"
        else:
            localized[key] = zh_value
    return localized


def localize_itinery_rows(rows, language):
    return [localize_itinery_row(row, language) for row in rows]
