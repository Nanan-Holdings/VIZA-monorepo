from datetime import date, timedelta


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
        return date.fromisoformat(_as_text(value, ""))
    except ValueError:
        return date.today()


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
                "type": _as_text(row.get("type")),
                "date": _as_text(row.get("date")),
                "route": _as_text(row.get("route")),
                "name": _as_text(row.get("name")),
                "details": _as_text(row.get("details")),
                "contact": _as_text(row.get("contact")),
            }
        )

    return normalized


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
            {
                "type": "酒店",
                "date": f"{check_in.isoformat()} - {check_out.isoformat()}",
                "route": city,
                "name": "自行安排",
                "details": f"{nights}晚；待选择酒店；USD0",
                "contact": "待补充",
            }
        )
        elapsed_days += day_count

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
        rows.append(
            {
                "type": "航班",
                "date": start_date.isoformat(),
                "route": f"{origin} → {first_city}",
                "name": "默认航班（待选择）",
                "details": "经济舱；用户可修改时间、价格和航司",
                "contact": "TBD",
            }
        )

    if last_city != return_city:
        rows.append(
            {
                "type": "航班",
                "date": (start_date + timedelta(days=max(0, total_days - 1))).isoformat(),
                "route": f"{last_city} → {return_city}",
                "name": "默认航班（待选择）",
                "details": "经济舱；用户可修改时间、价格和航司",
                "contact": "TBD",
            }
        )

    if not rows:
        rows.append(
            {
                "type": "航班",
                "date": start_date.isoformat(),
                "route": f"{origin} → {first_city}",
                "name": "默认航班（待选择）",
                "details": "经济舱；用户可修改出发/到达城市和航班号",
                "contact": "TBD",
            }
        )

    return rows


def build_itinery_rows(itinerary, state):
    provided_rows = _normalized_itinery_rows(state.get("itinery_rows"))
    if provided_rows:
        return provided_rows

    rows = []

    for day in itinerary or []:
        if not isinstance(day, dict):
            continue
        day_label = _as_text(day.get("day"))
        city = _as_text(day.get("city"))
        activities = day.get("activities") if isinstance(day.get("activities"), list) else []
        food = _join_items(day.get("food"))

        for activity in activities:
            rows.append(
                {
                    "type": "景点",
                    "date": f"Day {day_label}",
                    "route": city,
                    "name": _as_text(activity),
                    "details": f"餐饮建议：{food}" if food != "-" else "-",
                    "contact": "-",
                }
            )

    selected_hotels = state.get("selected_hotels") or []
    for hotel in selected_hotels:
        if not isinstance(hotel, dict):
            continue
        option = hotel.get("option") if isinstance(hotel.get("option"), dict) else {}
        address = _as_text(option.get("address"))
        price = _format_money(option)
        nights = _as_text(hotel.get("nights"))
        check_in = _as_text(hotel.get("check_in"))
        check_out = _as_text(hotel.get("check_out"))

        rows.append(
            {
                "type": "酒店",
                "date": f"{check_in} - {check_out}",
                "route": _as_text(hotel.get("city")),
                "name": _as_text(option.get("name"), "Selected hotel"),
                "details": f"{nights}晚；地址：{address}；价格：{price}",
                "contact": _as_text(option.get("contact_phone")),
            }
        )

    if not selected_hotels:
        rows.extend(_build_default_hotel_rows(state))

    selected_flights = state.get("selected_flights") or []
    selected_flight_count = 0
    for flight in selected_flights:
        if not isinstance(flight, dict) or flight.get("skip"):
            continue
        selected_flight_count += 1
        option = flight.get("option") if isinstance(flight.get("option"), dict) else {}
        airline = option.get("airline") or option.get("provider") or "Selected flight"
        route = f"{_as_text(flight.get('from'))} → {_as_text(flight.get('to'))}"
        airports = f"{_as_text(option.get('from_id') or option.get('from'))} → {_as_text(option.get('to_id') or option.get('to'))}"
        duration = _as_text(option.get("duration"))
        stops = option.get("stops")
        stops_text = "直飞" if stops == 0 else f"{_as_text(stops)}次中转"

        rows.append(
            {
                "type": "航班",
                "date": _as_text(flight.get("departure_date")),
                "route": route,
                "name": _as_text(airline),
                "details": f"{airports}；{duration}；{stops_text}",
                "contact": _as_text(option.get("flight_number")),
            }
        )

    if selected_flight_count == 0:
        rows.extend(_build_default_flight_rows(state))

    return rows
