from datetime import date, timedelta
from typing import Optional

from fastapi import BackgroundTasks
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pathlib import Path

from itinerary import generate_itinerary
from agent import TravelChatRequest, generate_chat_response
from export_doc import export_to_word
from export_pdf import export_to_pdf
from tools.flights import search_flights
from tools.hotels import search_hotels

app = FastAPI()

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
    travel_order: list[str] = Field(default_factory=list)
    origin_country: Optional[str] = None
    origin_city: Optional[str] = None
    return_country: Optional[str] = None
    return_city: Optional[str] = None
    departure_date: Optional[str] = None
    selected_flights: list[dict] = Field(default_factory=list)
    selected_hotels: list[dict] = Field(default_factory=list)
    final_note: Optional[str] = None
    attached_files: list[str] = Field(default_factory=list)


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
    result = {}
    for city in cities:
        raw_days = data.city_days.get(city, 1)
        try:
            day_count = int(raw_days)
        except (TypeError, ValueError):
            day_count = 1
        result[city] = max(1, day_count)
    return result


def _travel_start_date(raw_date: Optional[str]) -> date:
    if raw_date:
        try:
            return date.fromisoformat(raw_date)
        except ValueError:
            pass

    return date.today() + timedelta(days=14)


def _departure_date_for_leg(start_date: date, city_days: dict[str, int], legs_before: list[str]) -> str:
    offset = sum(city_days.get(city, 1) for city in legs_before)
    return (start_date + timedelta(days=offset)).isoformat()


def _travel_payload(data: TravelRequest):
    cities = _normalized_cities(data)
    city_days = _normalized_city_days(data, cities)
    normalized_country = _normalized_country(data)

    return {
        **_payload(data),
        "country": normalized_country,
        "cities": cities,
        "city_days": city_days,
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

        departure_day = _departure_date_for_leg(start_date, city_days, prior_cities)

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

    for city in cities:
        nights = city_days.get(city, 1)
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
        elapsed_days += nights

    return stays


def _cleanup_file(file_path: str):
    Path(file_path).unlink(missing_ok=True)


@app.post("/generate")
def generate(data: TravelRequest):
    itinerary = generate_itinerary(_travel_payload(data))
    return {"reply": itinerary}


@app.post("/chat")
def chat(data: TravelChatRequest):
    return generate_chat_response(data)


@app.post("/download-word")
def download_word(data: TravelRequest, background_tasks: BackgroundTasks):
    itinerary = generate_itinerary(_travel_payload(data))
    file_path = export_to_word(itinerary)
    background_tasks.add_task(_cleanup_file, file_path)

    return FileResponse(
        path=file_path,
        filename="travel_plan.docx",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


@app.post("/download-pdf")
def download_pdf(data: TravelRequest, background_tasks: BackgroundTasks):
    itinerary = generate_itinerary(_travel_payload(data))
    file_path = export_to_pdf(itinerary)
    background_tasks.add_task(_cleanup_file, file_path)

    return FileResponse(
        path=file_path,
        filename="travel_plan.pdf",
        media_type="application/pdf",
    )


@app.post("/flight-options")
def flight_options(data: TravelRequest):
    legs = _build_flight_legs(data)
    results = []

    for leg in legs:
        options = search_flights(
            origin_city=leg["from"],
            destination_city=leg["to"],
            departure_date=leg["departure_date"],
            adults=leg["adults"],
        )

        results.append(
            {
                "from": leg["from"],
                "to": leg["to"],
                "departure_date": leg["departure_date"],
                "options": options,
            }
        )

    return {"legs": results}


@app.post("/hotel-options")
def hotel_options(data: TravelRequest):
    stays = _build_hotel_stays(data)
    results = []

    for stay in stays:
        options = search_hotels(
            destination=stay["city"],
            check_in_date=stay["check_in"],
            check_out_date=stay["check_out"],
            adults=stay["adults"],
        )
        results.append({**stay, "options": options})

    return {"stays": results}
