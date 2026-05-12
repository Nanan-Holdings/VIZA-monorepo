from typing import TypedDict, Optional

class TravelState(TypedDict):
    user_input: Optional[str]

    country: Optional[str]
    cities: Optional[list]
    city_days: Optional[dict]

    current_city: Optional[str]

    travelers: Optional[int]
    budget: Optional[int]

    reply: Optional[str]