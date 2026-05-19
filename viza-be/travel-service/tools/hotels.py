import os
from datetime import date, timedelta

import httpx

RAPIDAPI_HOST = os.getenv("RAPIDAPI_BOOKING_HOST", "booking-com15.p.rapidapi.com").strip()
RAPIDAPI_BASE_URL = os.getenv("RAPIDAPI_BOOKING_BASE_URL", f"https://{RAPIDAPI_HOST}").strip().rstrip("/")
RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "").strip()
REQUEST_TIMEOUT = httpx.Timeout(20.0)


def _headers():
    if not RAPIDAPI_KEY:
        return None
    return {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
        "Content-Type": "application/json",
    }


def _request_json(path: str, params: dict):
    headers = _headers()
    if not headers:
        return None

    try:
        response = httpx.get(
            f"{RAPIDAPI_BASE_URL}{path}",
            params=params,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        print(f"RapidAPI hotel request failed ({path}):", exc)
        return None


def _resolve_destination(query: str):
    if not query:
        return None, None

    payload = _request_json("/api/v1/hotels/searchDestination", {"query": query})
    if not payload or payload.get("status") is not True:
        return None, None

    data = payload.get("data")
    if not isinstance(data, list):
        return None, None

    for item in data:
        if not isinstance(item, dict):
            continue
        dest_id = item.get("dest_id")
        search_type = item.get("search_type")
        if isinstance(dest_id, str) and isinstance(search_type, str):
            if dest_id and search_type:
                return dest_id, search_type

    return None, None


def _normalize_dates(check_in_date, check_out_date):
    if check_in_date and check_out_date:
        return check_in_date, check_out_date

    today = date.today()
    normalized_check_in = check_in_date or (today + timedelta(days=14)).isoformat()
    normalized_check_out = check_out_date or (today + timedelta(days=15)).isoformat()
    return normalized_check_in, normalized_check_out


def _fallback_hotels(destination, adults=1):
    city_name = str(destination or "Destination").strip() or "Destination"
    return [
        {
            "provider": "api-default",
            "city": destination,
            "name": f"{city_name} Central Hotel",
            "price_per_night": "120.00",
            "currency": "USD",
            "rating": 4.5,
            "adults": adults,
            "address": f"1 Central Avenue, {city_name}",
            "contact_phone": "+1 555 010 1200",
            "check_in_time": "15:00",
            "check_out_time": "11:00",
        },
        {
            "provider": "api-default",
            "city": destination,
            "name": f"{city_name} Comfort Stay",
            "price_per_night": "60.00",
            "currency": "USD",
            "rating": 3.8,
            "adults": adults,
            "address": f"88 Station Road, {city_name}",
            "contact_phone": "+1 555 010 0600",
            "check_in_time": "15:00",
            "check_out_time": "11:00",
        },
    ]


def _extract_price_value(price_obj):
    if not isinstance(price_obj, dict):
        return None, None
    value = price_obj.get("value")
    currency = price_obj.get("currency")
    if value is None:
        return None, currency
    try:
        normalized_value = f"{float(value):.2f}"
    except (TypeError, ValueError):
        normalized_value = str(value)
    return normalized_value, currency


def _extract_time_range(block):
    if not isinstance(block, dict):
        return None
    from_time = block.get("fromTime")
    until_time = block.get("untilTime")
    if isinstance(from_time, str) and isinstance(until_time, str):
        return f"{from_time} - {until_time}"
    if isinstance(from_time, str):
        return from_time
    if isinstance(until_time, str):
        return until_time
    return None


def _to_float_text(value):
    if value is None:
        return None
    try:
        return f"{float(value):.2f}"
    except (TypeError, ValueError):
        return str(value)


def _repair_mojibake_text(value):
    if not isinstance(value, str) or not value:
        return value

    suspicious_markers = (
        "Ã",
        "â",
        "æ",
        "ã",
        "å",
        "¤",
        "ï",
        "ð",
        "è",
        "é",
        "ç",
        "",
        "",
        "",
    )
    if not any(marker in value for marker in suspicious_markers):
        return value

    try:
        repaired = value.encode("latin1").decode("utf-8")
    except UnicodeError:
        return value

    return repaired or value


def _fetch_hotel_details(
    hotel_id,
    check_in_date,
    check_out_date,
    adults,
    currency_code,
):
    if hotel_id in (None, ""):
        return None

    payload = _request_json(
        "/api/v1/hotels/getHotelDetails",
        {
            "hotel_id": hotel_id,
            "arrival_date": check_in_date,
            "departure_date": check_out_date,
            "adults": adults,
            "room_qty": 1,
            "languagecode": "en-us",
            "currency_code": currency_code,
        },
    )
    if not payload or payload.get("status") is not True:
        return None

    data = payload.get("data")
    return data if isinstance(data, dict) else None


def search_hotels(
    destination,
    check_in_date=None,
    check_out_date=None,
    adults=1,
    currency_code="CNY",
    max_results=5,
):
    if not destination:
        return []

    check_in_date, check_out_date = _normalize_dates(check_in_date, check_out_date)
    adults = max(int(adults or 1), 1)

    dest_id, search_type = _resolve_destination(destination)
    if not dest_id or not search_type:
        return _fallback_hotels(destination, adults=adults)

    payload = _request_json(
        "/api/v1/hotels/searchHotels",
        {
            "dest_id": dest_id,
            "search_type": search_type,
            "arrival_date": check_in_date,
            "departure_date": check_out_date,
            "adults": adults,
            "room_qty": 1,
            "page_number": 1,
            "units": "metric",
            "temperature_unit": "c",
            "languagecode": "en-us",
            "currency_code": currency_code,
        },
    )
    if not payload or payload.get("status") is not True:
        return _fallback_hotels(destination, adults=adults)

    data = payload.get("data")
    if not isinstance(data, dict):
        return _fallback_hotels(destination, adults=adults)

    hotels = data.get("hotels")
    if not isinstance(hotels, list) or not hotels:
        return _fallback_hotels(destination, adults=adults)

    normalized = []
    for entry in hotels[: max(max_results, 1)]:
        if not isinstance(entry, dict):
            continue
        property_data = entry.get("property")
        if not isinstance(property_data, dict):
            property_data = {}

        name = property_data.get("name") or entry.get("accessibilityLabel") or "Unknown hotel"
        review_score = property_data.get("reviewScore")

        gross_price, gross_currency = _extract_price_value(
            (property_data.get("priceBreakdown") or {}).get("grossPrice")
        )
        excluded_price, _ = _extract_price_value(
            (property_data.get("priceBreakdown") or {}).get("excludedPrice")
        )
        hotel_id = entry.get("hotel_id") or property_data.get("id")

        details = _fetch_hotel_details(
            hotel_id=hotel_id,
            check_in_date=check_in_date,
            check_out_date=check_out_date,
            adults=adults,
            currency_code=currency_code,
        )

        average_price_per_night = None
        total_price = None
        address = None
        latitude = property_data.get("latitude")
        longitude = property_data.get("longitude")
        website = None
        check_in_time = None
        check_out_time = None
        distance_to_center = None
        review_text = None

        if details:
            product_price = details.get("product_price_breakdown")
            if isinstance(product_price, dict):
                gross_per_night = product_price.get("gross_amount_per_night")
                if isinstance(gross_per_night, dict):
                    average_price_per_night, _ = _extract_price_value(gross_per_night)

                all_inclusive = product_price.get("all_inclusive_amount")
                if isinstance(all_inclusive, dict):
                    total_price, _ = _extract_price_value(all_inclusive)

            raw_data = details.get("rawData")
            if isinstance(raw_data, dict):
                if latitude is None:
                    latitude = raw_data.get("latitude")
                if longitude is None:
                    longitude = raw_data.get("longitude")
                checkin_block = raw_data.get("checkin")
                checkout_block = raw_data.get("checkout")
                check_in_time = _extract_time_range(checkin_block)
                check_out_time = _extract_time_range(checkout_block)
                raw_review_word = raw_data.get("reviewScoreWord")
                if isinstance(raw_review_word, str) and raw_review_word:
                    review_text = raw_review_word

            details_address = details.get("address_trans") or details.get("address")
            details_city = details.get("city_trans") or details.get("city_name_en")
            if isinstance(details_address, str) and details_address:
                details_address = _repair_mojibake_text(details_address)
                if isinstance(details_city, str) and details_city:
                    details_city = _repair_mojibake_text(details_city)
                if isinstance(details_city, str) and details_city:
                    address = f"{details_address}, {details_city}"
                else:
                    address = details_address

            website_value = details.get("url")
            if isinstance(website_value, str) and website_value:
                website = website_value

            distance_raw = details.get("distance_to_cc")
            distance_text = _to_float_text(distance_raw)
            if distance_text:
                distance_to_center = f"{distance_text} km"

            review_word = details.get("review_score_word")
            if isinstance(review_word, str) and review_word:
                review_text = review_word

        normalized.append(
            {
                "provider": "rapidapi-booking-com",
                "city": destination,
                "name": name,
                "hotel_id": hotel_id,
                "price_per_night": gross_price or "-",
                "taxes_and_fees": excluded_price or "0.00",
                "currency": gross_currency or currency_code,
                "check_in": check_in_date,
                "check_out": check_out_date,
                "adults": adults,
                "rating": review_score,
                "average_price_per_night": average_price_per_night,
                "total_price": total_price,
                "address": address,
                "latitude": latitude,
                "longitude": longitude,
                "website": website,
                "check_in_time": check_in_time,
                "check_out_time": check_out_time,
                "distance_to_center": distance_to_center,
                "review_text": review_text,
            }
        )

    return normalized or _fallback_hotels(destination, adults=adults)
