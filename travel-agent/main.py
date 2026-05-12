from structured_input import get_user_input
from itinerary import generate_itinerary
from export_doc import export_to_word
from dotenv import load_dotenv

load_dotenv()

def main():
    print("Travel Planner Starting...\n")

    # Step 1: Get structured input
    state = get_user_input()

    print("\nGenerating itinerary...\n")

    # Step 2: Generate itinerary
    itinerary_text = generate_itinerary(state)

    print("Travel Plan:\n")
    print(itinerary_text)

    # Step 3: Export to Word
    export_to_word(itinerary_text)


if __name__ == "__main__":
    main()
