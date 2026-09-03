"""Generate provider-verified, explicitly unbooked travel facts for local form QA."""

from __future__ import annotations

import argparse
import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from tools.serpapi import search_serpapi_flights, search_serpapi_hotels


DESTINATIONS: dict[str, tuple[str, str, str, str | None]] = {
    "argentina": ("Buenos Aires", "SIN", "EZE", None),
    "australia": ("Sydney", "SIN", "SYD", None),
    "austria": ("Vienna", "SIN", "VIE", None),
    "belgium": ("Brussels", "SIN", "BRU", None),
    "bulgaria": ("Sofia", "SIN", "SOF", None),
    "cambodia": ("Phnom Penh", "SIN", "PNH", None),
    "canada": ("Toronto", "SIN", "YYZ", None),
    "chile": ("Santiago", "SIN", "SCL", None),
    "china": ("Beijing", "SIN", "PEK", None),
    "colombia": ("Bogota", "SIN", "BOG", None),
    "croatia": ("Zagreb", "SIN", "ZAG", None),
    "cuba": ("Havana", "SIN", "HAV", None),
    "czech_republic": ("Prague", "SIN", "PRG", None),
    "denmark": ("Copenhagen", "SIN", "CPH", None),
    "dominican_republic": ("Santo Domingo", "SIN", "SDQ", None),
    "egypt": ("Cairo", "SIN", "CAI", None),
    "estonia": ("Tallinn", "SIN", "TLL", None),
    "finland": ("Helsinki", "SIN", "HEL", None),
    "france": ("Paris", "SIN", "CDG", None),
    "germany": ("Berlin", "SIN", "BER", None),
    "greece": ("Athens", "SIN", "ATH", None),
    "hungary": ("Budapest", "SIN", "BUD", None),
    "iceland": ("Reykjavik", "SIN", "KEF", None),
    "india": ("New Delhi", "SIN", "DEL", None),
    "indonesia": ("Jakarta", "SIN", "CGK", None),
    "ireland": ("Dublin", "SIN", "DUB", None),
    "israel": ("Tel Aviv", "SIN", "TLV", None),
    "italy": ("Rome", "SIN", "FCO", None),
    "japan": ("Tokyo", "SIN", "NRT", None),
    "jordan": ("Amman", "SIN", "AMM", None),
    "kenya": ("Nairobi", "SIN", "NBO", None),
    "laos": ("Vientiane", "SIN", "VTE", None),
    "latvia": ("Riga", "SIN", "RIX", None),
    "liechtenstein": ("Vaduz", "SIN", "ZRH", "Ground transfer from Zurich Airport to Vaduz"),
    "lithuania": ("Vilnius", "SIN", "VNO", None),
    "luxembourg": ("Luxembourg", "SIN", "LUX", None),
    "malaysia": ("Kuala Lumpur", "SIN", "KUL", None),
    "maldives": ("Male", "SIN", "MLE", None),
    "malta": ("Valletta", "SIN", "MLA", None),
    "mexico": ("Mexico City", "SIN", "MEX", None),
    "morocco": ("Casablanca", "SIN", "CMN", None),
    "nepal": ("Kathmandu", "SIN", "KTM", None),
    "netherlands": ("Amsterdam", "SIN", "AMS", None),
    "new_zealand": ("Auckland", "SIN", "AKL", None),
    "norway": ("Oslo", "SIN", "OSL", None),
    "oman": ("Muscat", "SIN", "MCT", None),
    "peru": ("Lima", "SIN", "LIM", None),
    "philippines": ("Manila", "SIN", "MNL", None),
    "poland": ("Warsaw", "SIN", "WAW", None),
    "portugal": ("Lisbon", "SIN", "LIS", None),
    "qatar": ("Doha", "SIN", "DOH", None),
    "romania": ("Bucharest", "SIN", "OTP", None),
    "saudi_arabia": ("Riyadh", "SIN", "RUH", None),
    "singapore": ("Singapore", "KUL", "SIN", "Independent inbound scenario originating in Kuala Lumpur"),
    "slovakia": ("Bratislava", "SIN", "VIE", "Ground transfer from Vienna Airport to Bratislava"),
    "slovenia": ("Ljubljana", "SIN", "LJU", None),
    "south_africa": ("Johannesburg", "SIN", "JNB", None),
    "south_korea": ("Seoul", "SIN", "ICN", None),
    "spain": ("Madrid", "SIN", "MAD", None),
    "sri_lanka": ("Colombo", "SIN", "CMB", None),
    "sweden": ("Stockholm", "SIN", "ARN", None),
    "switzerland": ("Zurich", "SIN", "ZRH", None),
    "taiwan": ("Taipei", "SIN", "TPE", None),
    "tanzania": ("Dar es Salaam", "SIN", "DAR", None),
    "thailand": ("Bangkok", "SIN", "BKK", None),
    "turkey": ("Istanbul", "SIN", "IST", None),
    "united_arab_emirates": ("Dubai", "SIN", "DXB", None),
    "united_kingdom": ("London", "SIN", "LHR", None),
    "united_states": ("New York", "SIN", "JFK", None),
    "vietnam": ("Ho Chi Minh City", "SIN", "SGN", None),
}


def _compact_flight(option: dict[str, Any] | None) -> dict[str, Any] | None:
    if not option:
        return None
    allowed = (
        "provider", "airline", "departure", "arrival", "departure_airport",
        "arrival_airport", "duration", "stops", "cabin_class", "flight_number",
        "aircraft", "arrival_airline", "arrival_flight_number", "arrival_aircraft",
    )
    return {key: option.get(key) for key in allowed if option.get(key) not in (None, "")}


def _compact_hotel(option: dict[str, Any] | None) -> dict[str, Any] | None:
    if not option:
        return None
    allowed = (
        "provider", "city", "name", "address", "contact_phone", "website",
        "check_in", "check_out", "rating", "check_in_time", "check_out_time",
        "latitude", "longitude",
    )
    return {key: option.get(key) for key in allowed if option.get(key) not in (None, "")}


async def _search_country(
    country: str,
    destination: tuple[str, str, str, str | None],
    departure_date: str,
    return_date: str,
    semaphore: asyncio.Semaphore,
) -> tuple[str, dict[str, Any]]:
    city, origin_iata, destination_iata, transfer_note = destination
    async with semaphore:
        flights, hotels = await asyncio.gather(
            search_serpapi_flights(
                origin_iata,
                destination_iata,
                departure_date,
                currency_code="SGD",
                max_results=1,
            ),
            search_serpapi_hotels(
                city,
                departure_date,
                return_date,
                currency_code="SGD",
                max_results=1,
            ),
        )
    flight = _compact_flight(flights[0] if flights else None)
    hotel = _compact_hotel(hotels[0] if hotels else None)
    return country, {
        "city": city,
        "originIata": origin_iata,
        "destinationIata": destination_iata,
        "arrivalDate": departure_date,
        "departureDate": return_date,
        "transferNote": transfer_note,
        "flight": flight,
        "hotel": hotel,
        "completeForAutofill": bool(
            flight
            and flight.get("arrival_flight_number")
            and hotel
            and hotel.get("name")
            and hotel.get("address")
        ),
    }


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--departure-date", default="2026-10-10")
    parser.add_argument("--return-date", default="2026-10-20")
    parser.add_argument("--output", default="../../.dev-logs/verified-qa-travel-facts.json")
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    semaphore = asyncio.Semaphore(4)
    results = await asyncio.gather(*(
        _search_country(
            country,
            destination,
            args.departure_date,
            args.return_date,
            semaphore,
        )
        for country, destination in DESTINATIONS.items()
    ))
    countries = dict(results)
    output_path = (Path(__file__).resolve().parents[1] / args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "verifiedAt": datetime.now(UTC).isoformat(),
        "provider": "SerpApi Google Flights and Google Hotels",
        "booked": False,
        "warning": "Live search facts for independent local QA scenarios; no reservation or ticket exists.",
        "summary": {
            "countries": len(countries),
            "withFlight": sum(bool(value["flight"]) for value in countries.values()),
            "withHotel": sum(bool(value["hotel"]) for value in countries.values()),
            "completeForAutofill": sum(value["completeForAutofill"] for value in countries.values()),
        },
        "countries": countries,
    }
    output_path.write_text(f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    print(json.dumps({"outputPath": str(output_path), **payload["summary"]}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
