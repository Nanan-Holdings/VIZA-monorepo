import os
from datetime import date

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
        print(f"RapidAPI flight request failed ({path}):", exc)
        return None


def _resolve_destination_id(query: str):
    if not query:
        return None

    payload = _request_json("/api/v1/flights/searchDestination", {"query": query})
    if not payload or payload.get("status") is not True:
        return None

    data = payload.get("data")
    if not isinstance(data, list):
        return None

    query_key = query.strip().lower()
    best_id = None
    best_score = -1

    for item in data:
        if not isinstance(item, dict):
            continue
        destination_id = item.get("id")
        if not isinstance(destination_id, str) or not destination_id:
            continue

        score = 0
        city_name = str(item.get("cityName") or "").strip().lower()
        region_name = str(item.get("regionName") or "").strip().lower()
        location_name = str(item.get("name") or "").strip().lower()
        code = str(item.get("code") or "").strip().lower()
        country_name = str(item.get("countryName") or "").strip().lower()

        for value, weight in (
            (city_name, 100),
            (region_name, 80),
            (location_name, 70),
            (code, 60),
            (country_name, 40),
        ):
            if not value:
                continue
            if value == query_key:
                score = max(score, weight + 100)
            elif value.startswith(query_key):
                score = max(score, weight + 70)
            elif query_key in value:
                score = max(score, weight + 40)

        if score > best_score:
            best_score = score
            best_id = destination_id

    if best_id:
        return best_id

    for item in data:
        if not isinstance(item, dict):
            continue
        destination_id = item.get("id")
        if isinstance(destination_id, str) and destination_id:
            return destination_id

    return None


def _price_to_string(price_obj):
    if not isinstance(price_obj, dict):
        return "-"
    units = price_obj.get("units", 0)
    nanos = price_obj.get("nanos", 0)
    try:
        value = float(units) + float(nanos) / 1_000_000_000
    except (TypeError, ValueError):
        return "-"
    return f"{value:.2f}"


def _currency_from_price(price_obj, fallback="CNY"):
    if isinstance(price_obj, dict):
        code = price_obj.get("currencyCode")
        if isinstance(code, str) and code:
            return code
    return fallback


def _fallback_flights(origin_city, destination_city, departure_date):
    return [
        {
            "provider": "mock",
            "airline": "Singapore Airlines",
            "price": "500.00",
            "currency": "USD",
            "departure": departure_date,
            "from": origin_city,
            "to": destination_city,
            "duration": "-",
            "stops": 0,
            "flight_number": "SQ318",
            "departure_airport": origin_city,
            "arrival_airport": destination_city,
            "cabin_class": "ECONOMY",
        },
        {
            "provider": "mock",
            "airline": "Scoot",
            "price": "200.00",
            "currency": "USD",
            "departure": departure_date,
            "from": origin_city,
            "to": destination_city,
            "duration": "-",
            "stops": 0,
            "flight_number": "TR808",
            "departure_airport": origin_city,
            "arrival_airport": destination_city,
            "cabin_class": "ECONOMY",
        },
    ]


def _format_duration(seconds):
    if not isinstance(seconds, (int, float)):
        return None

    total_minutes = int(seconds // 60)
    if total_minutes <= 0:
        return None

    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours and minutes:
        return f"{hours}h {minutes}m"
    if hours:
        return f"{hours}h"
    return f"{minutes}m"


def _airport_label(airport_obj):
    if not isinstance(airport_obj, dict):
        return None
    name = airport_obj.get("name")
    code = airport_obj.get("code")
    if isinstance(name, str) and isinstance(code, str) and name and code:
        return f"{name} ({code})"
    if isinstance(name, str) and name:
        return name
    if isinstance(code, str) and code:
        return code
    return None


def search_flights(
    origin_city,
    destination_city,
    departure_date=None,
    adults=1,
    currency_code="CNY",
    max_results=5,
):
    if not origin_city or not destination_city:
        return []

    departure_date = departure_date or date.today().isoformat()
    adults = max(int(adults or 1), 1)

    from_id = _resolve_destination_id(origin_city)
    to_id = _resolve_destination_id(destination_city)
    if not from_id or not to_id:
        return _fallback_flights(origin_city, destination_city, departure_date)

    payload = _request_json(
        "/api/v1/flights/searchFlights",
        {
            "fromId": from_id,
            "toId": to_id,
            "departDate": departure_date,
            "adults": adults,
            "currency_code": currency_code,
            "sort": "BEST",
            "cabinClass": "ECONOMY",
        },
    )
    if not payload or payload.get("status") is not True:
        return _fallback_flights(origin_city, destination_city, departure_date)

    data = payload.get("data")
    if not isinstance(data, dict):
        return _fallback_flights(origin_city, destination_city, departure_date)

    offers = data.get("flightOffers")
    if not isinstance(offers, list) or not offers:
        return _fallback_flights(origin_city, destination_city, departure_date)

    normalized = []
    for offer in offers[: max(max_results, 1)]:
        if not isinstance(offer, dict):
            continue

        segments = offer.get("segments")
        first_segment = segments[0] if isinstance(segments, list) and segments else {}
        if not isinstance(first_segment, dict):
            first_segment = {}

        departure_time = first_segment.get("departureTime") or departure_date
        arrival_time = first_segment.get("arrivalTime")
        carrier_name = "Unknown Airline"
        departure_airport = _airport_label(first_segment.get("departureAirport"))
        arrival_airport = _airport_label(first_segment.get("arrivalAirport"))
        duration = _format_duration(first_segment.get("totalTime"))
        offer_token = offer.get("token")
        stops = None
        cabin_class = None
        flight_number = None
        aircraft = None

        legs = first_segment.get("legs")
        if isinstance(legs, list) and legs:
            stops = max(len(legs) - 1, 0)
            first_leg = legs[0]
            if isinstance(first_leg, dict):
                carriers_data = first_leg.get("carriersData")
                if isinstance(carriers_data, list) and carriers_data:
                    first_carrier = carriers_data[0]
                    if isinstance(first_carrier, dict):
                        carrier_name = (
                            first_carrier.get("name")
                            or first_carrier.get("code")
                            or carrier_name
                        )
                cabin_class = first_leg.get("cabinClass")

                flight_info = first_leg.get("flightInfo")
                if isinstance(flight_info, dict):
                    raw_flight_number = flight_info.get("flightNumber")
                    if raw_flight_number is not None:
                        flight_number = str(raw_flight_number)
                    raw_plane_type = flight_info.get("planeType")
                    if raw_plane_type is not None:
                        aircraft = str(raw_plane_type)
        else:
            stops = 0

        total_price = _price_to_string((offer.get("priceBreakdown") or {}).get("total"))
        currency = _currency_from_price(
            (offer.get("priceBreakdown") or {}).get("total"),
            fallback=currency_code,
        )

        normalized.append(
            {
                "provider": "rapidapi-booking-com",
                "airline": carrier_name,
                "price": total_price,
                "currency": currency,
                "departure": departure_time,
                "arrival": arrival_time,
                "from": origin_city,
                "to": destination_city,
                "from_id": from_id,
                "to_id": to_id,
                "offer_token": offer_token if isinstance(offer_token, str) else None,
                "departure_airport": departure_airport,
                "arrival_airport": arrival_airport,
                "duration": duration,
                "stops": stops,
                "cabin_class": cabin_class if isinstance(cabin_class, str) else None,
                "flight_number": flight_number,
                "aircraft": aircraft,
            }
        )

    return normalized or _fallback_flights(origin_city, destination_city, departure_date)
