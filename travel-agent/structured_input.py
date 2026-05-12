def get_user_input():
    state = {}

    # 1. Country
    country = input("Select country (e.g. Japan, France): ")
    state["country"] = country

    # 2. Cities
    cities = input("Enter cities (comma separated, e.g. Tokyo,Osaka): ")
    city_list = [c.strip() for c in cities.split(",")]
    state["cities"] = city_list

    # 3. Days per city
    city_days = {}
    for city in city_list:
        days = int(input(f"How many days in {city}? "))
        city_days[city] = days

    state["city_days"] = city_days

    # 4. Travelers
    travelers = int(input("Number of travelers: "))
    state["travelers"] = travelers

    # 5. Budget
    budget = int(input("Total budget: "))
    state["budget"] = budget

    return state
