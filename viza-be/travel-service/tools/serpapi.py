"""Truthful SerpApi adapters for Google Flights and Google Hotels."""

from __future__ import annotations

import asyncio
import os
import time
from typing import Any

import httpx

from tools.http_client import get_http_client


SERPAPI_SEARCH_URL = "https://serpapi.com/search.json"
SERPAPI_LOCATION_CACHE_TTL_SECONDS = 24 * 60 * 60
_location_cache: dict[str, tuple[float, str]] = {}


def is_serpapi_configured() -> bool:
    return bool(os.getenv("SERPAPI_API_KEY", "").strip())


async def _request(params: dict[str, Any]) -> dict[str, Any] | None:
    """Request SerpApi without logging the query-string API key."""

    api_key = os.getenv("SERPAPI_API_KEY", "").strip()
    if not api_key:
        return None
    client = await get_http_client()
    try:
        response = await client.get(
            SERPAPI_SEARCH_URL,
            params={**params, "api_key": api_key},
        )
        response.raise_for_status()
        payload = response.json()
    except asyncio.CancelledError:
        raise
    except httpx.HTTPStatusError as exc:
        print(
            "SerpApi request failed:",
            {"engine": params.get("engine"), "status": exc.response.status_code},
        )
        return None
    except Exception as exc:
        print(
            "SerpApi request failed:",
            {"engine": params.get("engine"), "error": type(exc).__name__},
        )
        return None
    if not isinstance(payload, dict) or payload.get("error"):
        print("SerpApi returned no usable payload:", {"engine": params.get("engine")})
        return None
    return payload


async def _resolve_flight_location(query: str) -> str | None:
    query_key = query.strip().lower()
    if not query_key:
        return None
    if len(query_key) == 3 and query_key.isalpha():
        return query_key.upper()
    cached = _location_cache.get(query_key)
    if cached and time.monotonic() - cached[0] < SERPAPI_LOCATION_CACHE_TTL_SECONDS:
        return cached[1]
    payload = await _request(
        {
            "engine": "google_flights_autocomplete",
            "q": query,
            "exclude_regions": "true",
        }
    )
    suggestions = payload.get("suggestions") if payload else None
    if not isinstance(suggestions, list):
        return None
    for suggestion in suggestions:
        if not isinstance(suggestion, dict):
            continue
        location_id = suggestion.get("id")
        if isinstance(location_id, str) and location_id:
            _location_cache[query_key] = (time.monotonic(), location_id)
            return location_id
        airports = suggestion.get("airports")
        if not isinstance(airports, list):
            continue
        for airport in airports:
            if not isinstance(airport, dict):
                continue
            airport_id = airport.get("id") or airport.get("code")
            if isinstance(airport_id, str) and airport_id:
                _location_cache[query_key] = (time.monotonic(), airport_id)
                return airport_id
    return None


def _duration_text(minutes: Any) -> str | None:
    try:
        total = int(minutes)
    except (TypeError, ValueError):
        return None
    if total <= 0:
        return None
    hours, remaining = divmod(total, 60)
    if hours and remaining:
        return f"{hours}h {remaining}m"
    return f"{hours}h" if hours else f"{remaining}m"


def _airport_label(value: Any) -> str | None:
    if not isinstance(value, dict):
        return None
    name = value.get("name")
    airport_id = value.get("id")
    if isinstance(name, str) and isinstance(airport_id, str):
        return f"{name} ({airport_id})"
    if isinstance(name, str):
        return name
    return airport_id if isinstance(airport_id, str) else None


async def search_serpapi_flights(
    origin_city: str,
    destination_city: str,
    departure_date: str,
    adults: int = 1,
    currency_code: str = "CNY",
    max_results: int = 5,
) -> list[dict[str, Any]]:
    if not is_serpapi_configured():
        return []
    departure_id, arrival_id = await asyncio.gather(
        _resolve_flight_location(origin_city),
        _resolve_flight_location(destination_city),
    )
    if not departure_id or not arrival_id:
        return []
    payload = await _request(
        {
            "engine": "google_flights",
            "departure_id": departure_id,
            "arrival_id": arrival_id,
            "outbound_date": departure_date,
            "type": 2,
            "adults": max(int(adults or 1), 1),
            "travel_class": 1,
            "currency": currency_code,
            "hl": "en",
        }
    )
    if not payload:
        return []
    raw_offers = [*(payload.get("best_flights") or []), *(payload.get("other_flights") or [])]
    normalized: list[dict[str, Any]] = []
    for offer in raw_offers[: max(max_results, 1)]:
        if not isinstance(offer, dict):
            continue
        legs = offer.get("flights")
        if not isinstance(legs, list) or not legs:
            continue
        first = legs[0] if isinstance(legs[0], dict) else {}
        last = legs[-1] if isinstance(legs[-1], dict) else {}
        departure = first.get("departure_airport")
        arrival = last.get("arrival_airport")
        if not isinstance(departure, dict) or not isinstance(arrival, dict):
            continue
        normalized.append(
            {
                "provider": "serpapi-google-flights",
                "airline": first.get("airline") or "待确认航司",
                "price": str(offer.get("price")) if offer.get("price") is not None else "-",
                "currency": currency_code,
                "departure": departure.get("time") or departure_date,
                "arrival": arrival.get("time"),
                "from": origin_city,
                "to": destination_city,
                "from_id": departure_id,
                "to_id": arrival_id,
                "offer_token": offer.get("booking_token"),
                "departure_airport": _airport_label(departure),
                "arrival_airport": _airport_label(arrival),
                "duration": _duration_text(offer.get("total_duration")),
                "stops": max(len(legs) - 1, 0),
                "cabin_class": first.get("travel_class"),
                "flight_number": first.get("flight_number"),
                "aircraft": first.get("airplane"),
                "arrival_airline": last.get("airline"),
                "arrival_flight_number": last.get("flight_number"),
                "arrival_aircraft": last.get("airplane"),
            }
        )
    return normalized


async def search_serpapi_hotels(
    destination: str,
    check_in_date: str,
    check_out_date: str,
    adults: int = 1,
    currency_code: str = "CNY",
    max_results: int = 5,
) -> list[dict[str, Any]]:
    if not is_serpapi_configured():
        return []
    payload = await _request(
        {
            "engine": "google_hotels",
            "q": f"Hotels in {destination}",
            "check_in_date": check_in_date,
            "check_out_date": check_out_date,
            "adults": max(int(adults or 1), 1),
            "currency": currency_code,
            "hl": "en",
        }
    )
    properties = payload.get("properties") if payload else None
    if not isinstance(properties, list):
        return []
    selected_properties = properties[: max(max_results, 1)]
    details = await asyncio.gather(
        *(
            _request(
                {
                    "engine": "google_hotels",
                    "q": f"Hotels in {destination}",
                    "property_token": hotel.get("property_token"),
                    "check_in_date": check_in_date,
                    "check_out_date": check_out_date,
                    "adults": max(int(adults or 1), 1),
                    "currency": currency_code,
                    "hl": "en",
                }
            )
            if isinstance(hotel, dict) and hotel.get("property_token")
            else asyncio.sleep(0, result=None)
            for hotel in selected_properties
        )
    )
    normalized: list[dict[str, Any]] = []
    for hotel, property_details in zip(selected_properties, details):
        if not isinstance(hotel, dict) or not isinstance(hotel.get("name"), str):
            continue
        detail = property_details if isinstance(property_details, dict) else {}
        rate = hotel.get("rate_per_night") if isinstance(hotel.get("rate_per_night"), dict) else {}
        total_rate = hotel.get("total_rate") if isinstance(hotel.get("total_rate"), dict) else {}
        gps_source = detail.get("gps_coordinates") or hotel.get("gps_coordinates")
        gps = gps_source if isinstance(gps_source, dict) else {}
        normalized.append(
            {
                "provider": "serpapi-google-hotels",
                "city": destination,
                "name": hotel["name"],
                "hotel_id": hotel.get("property_token"),
                "price_per_night": str(rate.get("extracted_lowest")) if rate.get("extracted_lowest") is not None else "-",
                "taxes_and_fees": None,
                "currency": currency_code,
                "check_in": check_in_date,
                "check_out": check_out_date,
                "adults": max(int(adults or 1), 1),
                "rating": hotel.get("overall_rating"),
                "average_price_per_night": rate.get("lowest"),
                "total_price": total_rate.get("extracted_lowest") or total_rate.get("lowest"),
                "address": detail.get("address") or hotel.get("address"),
                "contact_phone": detail.get("phone") or hotel.get("phone"),
                "latitude": gps.get("latitude"),
                "longitude": gps.get("longitude"),
                "website": detail.get("website") or hotel.get("link"),
                "check_in_time": hotel.get("check_in_time"),
                "check_out_time": hotel.get("check_out_time"),
                "distance_to_center": None,
                "review_text": hotel.get("description"),
                "free_cancellation": hotel.get("free_cancellation"),
            }
        )
    return normalized
