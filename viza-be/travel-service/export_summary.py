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


def build_itinery_rows(itinerary, state):
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

    for hotel in state.get("selected_hotels") or []:
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

    for flight in state.get("selected_flights") or []:
        if not isinstance(flight, dict) or flight.get("skip"):
            continue
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

    return rows

