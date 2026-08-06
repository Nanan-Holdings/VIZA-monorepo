import asyncio
import calendar
import inspect
import os
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any, Optional

from fastapi import BackgroundTasks
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pathlib import Path

from itinerary import (
    _fallback_itinerary,
    _openai_revision_unavailable,
    _sanitize_itinerary,
    generate_itinerary,
    revise_itinerary,
)
from agent import TravelChatRequest, TravelChatResponse, generate_chat_response
from export_doc import export_to_word
from export_pdf import export_to_pdf
from tools.flights import _fallback_flights, search_flights
from tools.hotels import _fallback_hotels, search_hotels
from tools.http_client import close_http_client, get_http_client


def _positive_env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


def _positive_env_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


EXTERNAL_SEARCH_CONCURRENCY = _positive_env_int("TRAVEL_SEARCH_CONCURRENCY", 4)
EXTERNAL_SEARCH_DEADLINE_SECONDS = _positive_env_float(
    "TRAVEL_SEARCH_DEADLINE_SECONDS", 30.0
)
OPENAI_ENDPOINT_DEADLINE_SECONDS = _positive_env_float(
    "TRAVEL_OPENAI_ENDPOINT_DEADLINE_SECONDS", 50.0
)
_search_semaphore: asyncio.Semaphore | None = None
_search_semaphore_loop: asyncio.AbstractEventLoop | None = None


def _get_search_semaphore() -> asyncio.Semaphore:
    global _search_semaphore, _search_semaphore_loop
    running_loop = asyncio.get_running_loop()
    if _search_semaphore is None or _search_semaphore_loop is not running_loop:
        _search_semaphore = asyncio.Semaphore(EXTERNAL_SEARCH_CONCURRENCY)
        _search_semaphore_loop = running_loop
    return _search_semaphore


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await get_http_client()
    try:
        yield
    finally:
        await close_http_client()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TravelRequest(BaseModel):
    country: str = ""
    countries: list[str] = Field(default_factory=list)
    cities: list[str] = Field(default_factory=list)
    city_days: dict[str, int] = Field(default_factory=dict)
    travelers: int = Field(default=1, ge=1)
    budget: int = Field(default=1000, ge=1)
    travel_days: Optional[int] = None
    travel_order: list[str] = Field(default_factory=list)
    origin_country: Optional[str] = None
    origin_city: Optional[str] = None
    return_country: Optional[str] = None
    return_city: Optional[str] = None
    departure_date: Optional[str] = None
    date_flexibility: Optional[str] = None
    selected_flights: list[dict] = Field(default_factory=list)
    selected_hotels: list[dict] = Field(default_factory=list)
    final_note: Optional[str] = None
    attached_files: list[str] = Field(default_factory=list)
    itinerary: list[dict] = Field(default_factory=list)
    itinery_rows: list[dict] = Field(default_factory=list)
    export_language: Optional[str] = "zh"
    locale: str = "zh-CN"


class TravelRevisionRequest(BaseModel):
    current_version_id: Optional[str] = None
    user_prompt: str = ""
    state: dict[str, Any] = Field(default_factory=dict)
    current_itinerary: list[dict] = Field(default_factory=list)
    active_modules: dict[str, Any] = Field(default_factory=dict)
    locale: str = "zh-CN"


def _payload(data: TravelRequest):
    if hasattr(data, "model_dump"):
        return data.model_dump()
    return data.dict()


def _normalized_country(data: TravelRequest) -> str:
    if data.countries:
        countries = [country.strip() for country in data.countries if country.strip()]
        if countries:
            return "、".join(countries)
    return data.country.strip()


def _normalized_cities(data: TravelRequest) -> list[str]:
    chosen = [city.strip() for city in data.cities if city.strip()]
    if not data.travel_order:
        return chosen

    ordered = []
    seen = set()

    for city in data.travel_order:
        normalized = city.strip()
        if normalized and normalized not in seen:
            ordered.append(normalized)
            seen.add(normalized)

    for city in chosen:
        if city not in seen:
            ordered.append(city)
            seen.add(city)

    return ordered


def _normalized_city_days(data: TravelRequest, cities: list[str]) -> dict[str, int]:
    if cities and not data.city_days and data.travel_days:
        total_days = max(len(cities), int(data.travel_days))
        base_days = total_days // len(cities)
        extra_days = total_days % len(cities)
        return {
            city: base_days + (1 if index < extra_days else 0)
            for index, city in enumerate(cities)
        }

    result = {}
    for city in cities:
        raw_days = data.city_days.get(city, 1)
        try:
            day_count = int(raw_days)
        except (TypeError, ValueError):
            day_count = 1
        result[city] = max(1, day_count)
    return result


def _add_months(raw_date: date, months: int) -> date:
    month_index = raw_date.month - 1 + months
    year = raw_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(raw_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _travel_start_date(raw_date: Optional[str]) -> date:
    if raw_date:
        try:
            return date.fromisoformat(raw_date)
        except ValueError:
            pass

    return _add_months(date.today(), 2)


def _departure_date_for_leg(start_date: date, city_days: dict[str, int], legs_before: list[str]) -> str:
    offset = sum(city_days.get(city, 1) for city in legs_before)
    return (start_date + timedelta(days=offset)).isoformat()


def _travel_payload(data: TravelRequest):
    cities = _normalized_cities(data)
    city_days = _normalized_city_days(data, cities)
    normalized_country = _normalized_country(data)
    start_date = _travel_start_date(data.departure_date)

    return {
        **_payload(data),
        "country": normalized_country,
        "cities": cities,
        "city_days": city_days,
        "travel_days": data.travel_days or sum(city_days.values()),
        "departure_date": start_date.isoformat(),
        "date_flexibility": data.date_flexibility or "flexible",
    }


def _build_flight_legs(data: TravelRequest):
    cities = _normalized_cities(data)
    if not cities:
        return []

    origin_city = (data.origin_city or "").strip()
    return_city = (data.return_city or "").strip()
    if not origin_city:
        origin_city = cities[0]
    if not return_city:
        return_city = origin_city

    route = [origin_city, *cities, return_city]
    if len(route) < 2:
        return []

    city_days = _normalized_city_days(data, cities)
    start_date = _travel_start_date(data.departure_date)
    legs = []

    for index in range(len(route) - 1):
        depart_city = route[index]
        arrive_city = route[index + 1]
        if depart_city == arrive_city:
            continue

        if index == 0:
            prior_cities = []
        else:
            prior_cities = cities[:index]

        if index == len(route) - 2:
            # A four-day trip starting on Oct 4 returns on Oct 7, not Oct 8.
            # City-day totals are inclusive of the departure day.
            total_trip_days = data.travel_days or sum(city_days.values())
            departure_day = (
                start_date + timedelta(days=max(total_trip_days - 1, 0))
            ).isoformat()
        else:
            departure_day = _departure_date_for_leg(
                start_date, city_days, prior_cities
            )

        legs.append(
            {
                "from": depart_city,
                "to": arrive_city,
                "departure_date": departure_day,
                "adults": data.travelers,
            }
        )

    return legs


def _build_hotel_stays(data: TravelRequest):
    cities = _normalized_cities(data)
    if not cities:
        return []

    city_days = _normalized_city_days(data, cities)
    start_date = _travel_start_date(data.departure_date)
    stays = []
    elapsed_days = 0

    for index, city in enumerate(cities):
        city_day_count = city_days.get(city, 1)
        # The final itinerary day is the departure/return day, so it must not
        # create an extra hotel night. Earlier city segments still keep their
        # full night count because the traveller moves on the following day.
        nights = city_day_count - 1 if index == len(cities) - 1 else city_day_count
        if nights <= 0:
            elapsed_days += city_day_count
            continue
        check_in = (start_date + timedelta(days=elapsed_days)).isoformat()
        check_out = (start_date + timedelta(days=elapsed_days + nights)).isoformat()
        stays.append(
            {
                "city": city,
                "check_in": check_in,
                "check_out": check_out,
                "nights": nights,
                "adults": data.travelers,
            }
        )
        elapsed_days += city_day_count

    return stays


def _cleanup_file(file_path: str):
    Path(file_path).unlink(missing_ok=True)


async def _run_external_search(search_fn, kwargs: dict[str, Any], fallback):
    """Run one provider search with bounded concurrency and a hard deadline."""

    try:
        async with _get_search_semaphore():
            result = search_fn(**kwargs)
            if inspect.isawaitable(result):
                result = await asyncio.wait_for(
                    result,
                    timeout=EXTERNAL_SEARCH_DEADLINE_SECONDS,
                )
            return result if result is not None else fallback()
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        print("Travel provider search failed, using fallback:", exc)
        return fallback()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "travel-service"}


@app.get("/ready")
async def ready():
    try:
        await get_http_client()
    except Exception as exc:
        return {"status": "not_ready", "service": "travel-service", "error": str(exc)}
    return {"status": "ready", "service": "travel-service"}


@app.post("/generate")
async def generate(data: TravelRequest):
    payload = _travel_payload(data)
    try:
        itinerary = await asyncio.wait_for(
            generate_itinerary(payload),
            timeout=OPENAI_ENDPOINT_DEADLINE_SECONDS,
        )
    except asyncio.TimeoutError:
        print("Travel itinerary generation exceeded the endpoint deadline; using fallback.")
        itinerary = _fallback_itinerary(payload)
    return {"reply": itinerary}


@app.post("/revise-itinerary")
async def revise(data: TravelRevisionRequest):
    if hasattr(data, "model_dump"):
        payload = data.model_dump()
    else:
        payload = data.dict()
    try:
        return await asyncio.wait_for(
            revise_itinerary(payload),
            timeout=OPENAI_ENDPOINT_DEADLINE_SECONDS,
        )
    except asyncio.TimeoutError:
        print("Travel itinerary revision exceeded the endpoint deadline; preserving current version.")
        current = _sanitize_itinerary(payload.get("current_itinerary"), payload.get("state"))
        timeout_label = "OpenAI request timed out" if data.locale.lower().startswith("en") else "OpenAI 请求超时"
        return _openai_revision_unavailable(timeout_label, current)


@app.post("/chat")
async def chat(data: TravelChatRequest):
    try:
        return await asyncio.wait_for(
            generate_chat_response(data),
            timeout=OPENAI_ENDPOINT_DEADLINE_SECONDS,
        )
    except asyncio.TimeoutError:
        print("Travel chat exceeded the endpoint deadline; returning a safe fallback.")
        is_english = data.locale.lower().startswith("en")
        return TravelChatResponse(
            reply=(
                "Travel chat timed out. Please try again, or tell me your destination and trip length."
                if is_english
                else "旅行对话暂时超时了。你可以稍后重试，或直接告诉我目的地和旅行天数。"
            ),
            mode="collect_slots",
        )


@app.post("/download-word")
async def download_word(data: TravelRequest, background_tasks: BackgroundTasks):
    payload = _travel_payload(data)
    if data.itinerary:
        itinerary = data.itinerary
    else:
        try:
            itinerary = await asyncio.wait_for(
                generate_itinerary(payload),
                timeout=OPENAI_ENDPOINT_DEADLINE_SECONDS,
            )
        except asyncio.TimeoutError:
            print("Travel itinerary generation exceeded the endpoint deadline; using fallback.")
            itinerary = _fallback_itinerary(payload)
    file_path = await asyncio.to_thread(export_to_word, itinerary, payload)
    background_tasks.add_task(_cleanup_file, file_path)

    return FileResponse(
        path=file_path,
        filename=f"travel_plan_{data.export_language or 'zh'}.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@app.post("/download-pdf")
async def download_pdf(data: TravelRequest, background_tasks: BackgroundTasks):
    payload = _travel_payload(data)
    if data.itinerary:
        itinerary = data.itinerary
    else:
        try:
            itinerary = await asyncio.wait_for(
                generate_itinerary(payload),
                timeout=OPENAI_ENDPOINT_DEADLINE_SECONDS,
            )
        except asyncio.TimeoutError:
            print("Travel itinerary generation exceeded the endpoint deadline; using fallback.")
            itinerary = _fallback_itinerary(payload)
    file_path = await asyncio.to_thread(export_to_pdf, itinerary, payload)
    background_tasks.add_task(_cleanup_file, file_path)

    return FileResponse(
        path=file_path,
        filename=f"travel_plan_{data.export_language or 'zh'}.pdf",
        media_type="application/pdf",
    )


@app.post("/flight-options")
async def flight_options(data: TravelRequest):
    legs = _build_flight_legs(data)
    result_tasks = [
        _run_external_search(
            search_flights,
            {
                "origin_city": leg["from"],
                "destination_city": leg["to"],
                "departure_date": leg["departure_date"],
                "adults": leg["adults"],
            },
            lambda leg=leg: _fallback_flights(
                leg["from"],
                leg["to"],
                leg["departure_date"],
            ),
        )
        for leg in legs
    ]
    options_by_leg = await asyncio.gather(*result_tasks)
    results = [
        {
            "from": leg["from"],
            "to": leg["to"],
            "departure_date": leg["departure_date"],
            "options": options,
            # Provider failures are returned explicitly. The frontend can keep
            # rendering an estimate for layout continuity, but must not treat it
            # as a live, bookable offer.
            "provider_unavailable": any(
                bool(option.get("provider_status") == "unavailable")
                for option in options
                if isinstance(option, dict)
            ),
            "estimated": any(
                bool(option.get("estimated"))
                for option in options
                if isinstance(option, dict)
            ),
            "provider_message": next(
                (
                    option.get("provider_message")
                    for option in options
                    if isinstance(option, dict) and option.get("provider_message")
                ),
                None,
            ),
        }
        for leg, options in zip(legs, options_by_leg)
    ]

    return {"legs": results}


@app.post("/hotel-options")
async def hotel_options(data: TravelRequest):
    stays = _build_hotel_stays(data)
    result_tasks = [
        _run_external_search(
            search_hotels,
            {
                "destination": stay["city"],
                "check_in_date": stay["check_in"],
                "check_out_date": stay["check_out"],
                "adults": stay["adults"],
            },
            lambda stay=stay: _fallback_hotels(stay["city"], adults=stay["adults"]),
        )
        for stay in stays
    ]
    options_by_stay = await asyncio.gather(*result_tasks)
    results = [
        {**stay, "options": options}
        for stay, options in zip(stays, options_by_stay)
    ]

    return {"stays": results}
