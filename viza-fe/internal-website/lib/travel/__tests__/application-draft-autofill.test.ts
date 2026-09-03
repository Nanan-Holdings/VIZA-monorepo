import { describe, expect, it } from "vitest";
import {
  previewTravelApplicationAutofill,
  type TravelAutofillApplication,
} from "@/lib/travel/application-draft-autofill";
import { createInitialTravelState } from "@/lib/travel/planner";
import type { TravelState } from "@/lib/travel/planner";

const application: TravelAutofillApplication = {
  id: "app-jp",
  country: "japan",
  visaType: "JP_VISIT_JAPAN_WEB",
  existingAnswers: {},
  fields: [
    { fieldName: "arrival_date", fieldType: "date", options: null },
    { fieldName: "accommodation_name", fieldType: "text", options: null },
    { fieldName: "accommodation_address", fieldType: "text", options: null },
    { fieldName: "flight_number", fieldType: "text", options: null },
  ],
};

function fixedState(): TravelState {
  return {
    ...createInitialTravelState(),
    countries: ["Japan"],
    cities: ["Tokyo"],
    travel_order: ["Tokyo"],
    city_days: { Tokyo: 3 },
    departure_date: "2026-09-15",
    date_flexibility: "fixed" as const,
    destination_confirmed: true,
  };
}

describe("Travel application draft autofill", () => {
  it("maps fixed dates and verified provider facts", () => {
    const state = fixedState();
    state.selected_hotels = [
      {
        stay_index: 0,
        city: "Tokyo",
        check_in: "2026-09-15",
        check_out: "2026-09-17",
        nights: 2,
        option_index: 0,
        option: {
          provider: "rapidapi-booking-com",
          name: "Real Hotel",
          address: "1 Chiyoda, Tokyo",
        },
      },
    ];
    state.selected_flights = [
      {
        leg_index: 0,
        from: "Singapore",
        to: "Tokyo",
        departure_date: "2026-09-15",
        skip: false,
        option_index: 0,
        option: {
          provider: "rapidapi-booking-com",
          flight_number: "SQ12",
        },
      },
    ];

    const result = previewTravelApplicationAutofill(application, state);
    expect(Object.fromEntries(result.patches.map((patch) => [patch.fieldName, patch.value]))).toEqual({
      arrival_date: "2026-09-15",
      accommodation_name: "Real Hotel",
      accommodation_address: "1 Chiyoda, Tokyo",
      flight_number: "SQ12",
    });
  });

  it("excludes flexible dates and provider estimates", () => {
    const state = fixedState();
    state.date_flexibility = "flexible";
    state.selected_hotels = [
      {
        stay_index: 0,
        city: "Tokyo",
        check_in: "2026-09-15",
        check_out: "2026-09-17",
        nights: 2,
        option_index: 0,
        option: {
          provider: "unavailable-estimate",
          estimated: true,
          name: "酒店待确认",
        },
      },
    ];

    const result = previewTravelApplicationAutofill(application, state);
    expect(result.patches).toEqual([]);
    expect(result.warnings.join(" ")).toContain("fixed");
    expect(result.warnings.join(" ")).toContain("hotel");
  });

  it("accepts complete SerpApi flight and hotel facts", () => {
    const state = fixedState();
    state.selected_hotels = [
      {
        stay_index: 0,
        city: "Tokyo",
        check_in: "2026-09-15",
        check_out: "2026-09-17",
        nights: 2,
        option_index: 0,
        option: {
          provider: "serpapi-google-hotels",
          name: "Provider Hotel",
          address: "Verified provider address",
        },
      },
    ];
    state.selected_flights = [
      {
        leg_index: 0,
        from: "Singapore",
        to: "Tokyo",
        departure_date: "2026-09-15",
        skip: false,
        option_index: 0,
        option: {
          provider: "serpapi-google-flights",
          flight_number: "ZG 54",
        },
      },
    ];

    const result = previewTravelApplicationAutofill(application, state);
    expect(Object.fromEntries(result.patches.map((patch) => [patch.fieldName, patch.value]))).toMatchObject({
      accommodation_name: "Provider Hotel",
      accommodation_address: "Verified provider address",
      flight_number: "ZG 54",
    });
  });

  it("never overwrites an existing answer", () => {
    const result = previewTravelApplicationAutofill(
      {
        ...application,
        existingAnswers: { arrival_date: "2026-10-01" },
      },
      fixedState()
    );
    expect(result.patches.some((patch) => patch.fieldName === "arrival_date")).toBe(false);
    expect(result.skippedExisting).toEqual(["arrival_date"]);
  });
});
