from openai import OpenAI
import os
import json
from tools.flights import search_flights
from tools.hotels import search_hotels
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def extract_info(state):
    user_input = state.get("user_input", "").strip()

    # country
    if state.get("country") is None:
        state["country"] = user_input
        return state

    # cities
    if state.get("cities") is None:
        cities = [c.strip() for c in user_input.split(",")]
        state["cities"] = cities
        return state

    # city days
    if state.get("city_days") is None:
        state["city_days"] = {}

    for city in state["cities"]:
        if city not in state["city_days"]:
            if user_input.isdigit():
                state["city_days"][city] = int(user_input)
                return state

    # travelers
    if state.get("travelers") is None:
        if user_input.isdigit():
            state["travelers"] = int(user_input)
            return state

    # budget
    if state.get("budget") is None:
        if user_input.isdigit():
            state["budget"] = int(user_input)
            return state

    return state


def ask_question(state):
    if state.get("country") is None:
        return {"reply": "Which country would you like to visit?"}

    if state.get("cities") is None:
        return {"reply": "Which cities would you like to visit? (comma separated)"}

    if state.get("city_days") is None:
        state["city_days"] = {}

    for city in state["cities"]:
        if city not in state["city_days"]:
            return {"reply": f"How many days will you stay in {city}?"}

    if state.get("travelers") is None:
        return {"reply": "How many travelers?"}

    if state.get("budget") is None:
        return {"reply": "What is your budget?"}

    return {"reply": "Great! Generating your travel plan..."}

def call_tools(state):
    flights = search_flights(state["destination"], state["start_date"])
    hotels = search_hotels(state["destination"])

    return {
        "flights": flights,
        "hotels": hotels
    }
