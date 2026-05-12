from agent.graph import build_graph
from itinerary import generate_itinerary
from export_doc import export_to_word
from agent.state import TravelState
from typing import cast


def main():
    graph = build_graph()

    state: TravelState = {
    "user_input": None,
    "country": None,
    "cities": None,
    "city_days": None,
    "current_city": None,
    "travelers": None,
    "budget": None,
    "reply": None
    }

    print("Travel Agent is ready! Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ")

        if user_input.lower() == "exit":
            break

        state["user_input"] = user_input

        result = cast(TravelState, graph.invoke(state))

        if result.get("reply"):
            print("Agent:", result["reply"])

        state = {**state, **result}

        if (
            state.get("country")
            and state.get("cities")
            and state.get("city_days")
            and state.get("travelers")
            and state.get("budget")
        ):
            print("\nGenerating itinerary...\n")

            itinerary = generate_itinerary(state)

            print("Travel Plan:\n")
            print(itinerary)

            export_to_word(itinerary)
            break


if __name__ == "__main__":
    main()