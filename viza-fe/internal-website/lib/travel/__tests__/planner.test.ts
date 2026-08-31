import { describe, expect, it } from "vitest";
import {
  FORM_PAYLOAD_PREFIX,
  buildTravelStateFromMessages,
  createInitialTravelState,
  nextMissingField,
  toTravelPayload,
  toTravelPlanningPayload,
} from "@/lib/travel/planner";

function formMessage(payload: Record<string, unknown>): string {
  return `<!--${FORM_PAYLOAD_PREFIX}${JSON.stringify(payload)}-->`;
}

const selectedFlight = {
  leg_index: 1,
  from: "广州",
  to: "东京",
  departure_date: "2026-10-05",
  skip: true,
};

const selectedHotel = {
  stay_index: 1,
  city: "Tokyo",
  check_in: "2026-10-05",
  check_out: "2026-10-07",
  nights: 2,
  option_index: 1,
  option: { name: "Tokyo hotel" },
};

describe("Travel planner state reconstruction", () => {
  it("does not fall back to country after the country and cities are selected", () => {
    const country = buildTravelStateFromMessages([
      { role: "user", content: formMessage({ countries: ["波兰"] }) },
    ]);
    expect(country.country).toBe("波兰");
    expect(nextMissingField(country)).toBe("cities");

    const cities = buildTravelStateFromMessages([
      {
        role: "user",
        content: formMessage({ countries: ["波兰"], cities: ["华沙"] }),
      },
    ]);
    expect(nextMissingField(cities)).toBe("destination_confirmation");

    const confirmed = buildTravelStateFromMessages([
      {
        role: "user",
        content: formMessage({
          countries: ["波兰"],
          cities: ["华沙"],
          destination_confirmed: true,
        }),
      },
    ]);
    expect(nextMissingField(confirmed)).toBe("departure_date");
  });

  it("keeps multi-country selections authoritative over a stale scalar country", () => {
    const state = buildTravelStateFromMessages([
      {
        role: "user",
        content: formMessage({
          countries: ["波兰"],
          country: "波兰",
          cities: ["华沙"],
          destination_confirmed: true,
        }),
      },
      {
        role: "user",
        content: formMessage({
          countries: ["波兰", "德国"],
          country: "波兰",
          cities: ["华沙", "柏林"],
        }),
      },
    ]);

    expect(state.countries).toEqual(["波兰", "德国"]);
    expect(state.country).toBe("波兰、德国");
    expect(state.cities).toEqual(["华沙", "柏林"]);
    expect(nextMissingField(state)).toBe("destination_confirmation");
  });

  it("deduplicates country aliases from the explicit destination contract", () => {
    const state = buildTravelStateFromMessages([
      {
        role: "user",
        content: formMessage({
          countries: [
            "Poland",
            "波兰",
            "POLAND",
            "US",
            "美国",
            "United States",
          ],
        }),
      },
    ]);

    expect(state.countries).toEqual(["Poland", "US"]);
    expect(state.country).toBe("Poland、US");
  });

  it("deduplicates Chinese and English city aliases and canonicalizes city-day/order keys", () => {
    const state = buildTravelStateFromMessages([
      {
        role: "user",
        content: formMessage({
          countries: ["Japan"],
          cities: ["Tokyo", "东京", "Kraków", "Krakow"],
          city_days: { "东京": 3, Krakow: 2 },
          travel_order: ["东京", "Kraków"],
        }),
      },
    ]);

    expect(state.cities).toEqual(["Tokyo", "Kraków"]);
    expect(state.city_days).toEqual({ Tokyo: 3, "Kraków": 2 });
    expect(state.travel_days).toBe(5);
    expect(state.travel_order).toEqual(["Tokyo", "Kraków"]);
  });

  it("keeps travel_days and city_days consistent when a partial city-day update arrives", () => {
    const state = buildTravelStateFromMessages([
      {
        role: "user",
        content: formMessage({
          countries: ["Japan"],
          cities: ["Tokyo", "Osaka"],
          travel_days: 5,
        }),
      },
      {
        role: "user",
        content: formMessage({ city_days: { Tokyo: 4 } }),
      },
    ]);

    expect(state.city_days).toEqual({ Tokyo: 4, Osaka: 2 });
    expect(state.travel_days).toBe(6);
    expect(
      Object.values(state.city_days).reduce((total, days) => total + days, 0)
    ).toBe(state.travel_days);
  });

  it("treats repeated destination form payloads as idempotent for dependent selections", () => {
    const destination = formMessage({
      countries: ["Japan"],
      cities: ["Tokyo"],
      destination_confirmed: true,
    });
    const state = buildTravelStateFromMessages([
      { role: "user", content: destination },
      {
        role: "user",
        content: formMessage({
          selected_flights: [selectedFlight],
          selected_hotels: [selectedHotel],
        }),
      },
      { role: "user", content: destination },
    ]);

    expect(state.selected_flights[0]).toMatchObject(selectedFlight);
    expect(state.selected_hotels[0]).toMatchObject(selectedHotel);

    const changed = buildTravelStateFromMessages([
      { role: "user", content: destination },
      {
        role: "user",
        content: formMessage({
          selected_flights: [selectedFlight],
          selected_hotels: [selectedHotel],
        }),
      },
      {
        role: "user",
        content: formMessage({ countries: ["Japan"], cities: ["Osaka"] }),
      },
    ]);
    expect(changed.selected_flights).toEqual([]);
    expect(changed.selected_hotels).toEqual([]);
  });

  it("honors explicit empty form arrays as a destination reset", () => {
    const state = buildTravelStateFromMessages([
      {
        role: "user",
        content: formMessage({
          countries: ["Japan"],
          cities: ["Tokyo"],
          destination_confirmed: true,
          selected_flights: [selectedFlight],
          selected_hotels: [selectedHotel],
        }),
      },
      {
        role: "user",
        content: formMessage({
          countries: [],
          cities: [],
          travel_order: [],
          selected_flights: [],
          selected_hotels: [],
        }),
      },
    ]);

    expect(state.country).toBeNull();
    expect(state.countries).toEqual([]);
    expect(state.cities).toEqual([]);
    expect(state.travel_order).toEqual([]);
    expect(state.selected_flights).toEqual([]);
    expect(state.selected_hotels).toEqual([]);
    expect(nextMissingField(state)).toBe("country");
  });

  it("builds a consistent multi-city planning payload in the requested order", () => {
    const state = {
      ...createInitialTravelState(),
      country: "日本、韩国",
      countries: ["日本", "韩国"],
      cities: ["东京", "首尔"],
      city_days: { 东京: 3, 首尔: 2 },
      destination_confirmed: true,
      departure_date: "2026-10-05",
      date_flexibility: "fixed" as const,
      travel_days: 5,
      travelers: 2,
      budget: 8000,
      origin_country: "中国",
      origin_city: "广州",
      return_country: "中国",
      return_city: "广州",
      travel_order: ["首尔", "东京"],
      final_note: "",
    };
    const payload = toTravelPlanningPayload(state);
    expect(payload).toMatchObject({
      country: "日本、韩国",
      countries: ["日本", "韩国"],
      cities: ["首尔", "东京"],
      city_days: { 首尔: 2, 东京: 3 },
      travel_days: 5,
      travel_order: ["首尔", "东京"],
    });
    expect(toTravelPayload(state)?.final_note).toBe("");
  });

  it("does not emit a planning payload when city days contradict travel days", () => {
    const state = {
      ...createInitialTravelState(),
      country: "日本",
      countries: ["日本"],
      cities: ["东京", "大阪"],
      city_days: { 东京: 4, 大阪: 2 },
      destination_confirmed: true,
      departure_date: "2026-10-05",
      date_flexibility: "fixed" as const,
      travel_days: 5,
      travelers: 2,
      budget: 8000,
      origin_country: "中国",
      origin_city: "广州",
      return_country: "中国",
      return_city: "广州",
      travel_order: ["东京", "大阪"],
      final_note: "",
    };

    expect(nextMissingField(state)).toBe("travel_days");
    expect(toTravelPlanningPayload(state)).toBeNull();
  });
});
