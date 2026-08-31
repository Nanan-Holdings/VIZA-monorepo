import { describe, expect, it } from "vitest";
import {
  applyTravelStateOperations,
  coerceTravelState,
  type TravelStateOperation,
} from "@/lib/travel/conversation-state";
import { createInitialTravelState, type TravelState } from "@/lib/travel/planner";

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

function operation(
  overrides: Partial<TravelStateOperation>
): TravelStateOperation {
  return {
    op: "set",
    path: "final_note",
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    explicit: true,
    evidence: "用户明确提供",
    ...overrides,
  };
}

function completeState(overrides: Partial<TravelState> = {}): TravelState {
  return {
    ...createInitialTravelState(),
    country: "日本",
    countries: ["日本"],
    cities: ["东京", "大阪"],
    city_days: { "东京": 3, "大阪": 2 },
    destination_confirmed: true,
    departure_date: "2026-10-05",
    date_flexibility: "fixed",
    travel_days: 5,
    travelers: 2,
    budget: 5000,
    origin_country: "中国",
    origin_city: "广州",
    return_country: "中国",
    return_city: "广州",
    travel_order: ["东京", "大阪"],
    selected_flights: [selectedFlight],
    selected_hotels: [selectedHotel],
    ...overrides,
  };
}

describe("Travel conversation state coercion", () => {
  it("canonicalizes aliases, drops malformed selections, and keeps city days consistent", () => {
    const state = coerceTravelState({
      country: "stale scalar",
      countries: ["日本", " 日本 ", ""],
      cities: ["Tokyo", "东京", "Osaka", "大阪"],
      city_days: { "东京": 3, Osaka: 2, Unknown: 9 },
      travel_days: 5,
      travel_order: ["大阪", "Osaka", "东京"],
      departure_date: "2026-10-05",
      date_flexibility: "fixed",
      selected_flights: [selectedFlight, { leg_index: 0 }],
      selected_hotels: [selectedHotel, { stay_index: 0 }],
    });

    expect(state.country).toBe("日本");
    expect(state.countries).toEqual(["日本"]);
    expect(state.cities).toEqual(["Tokyo", "Osaka"]);
    expect(state.city_days).toEqual({ Tokyo: 3, Osaka: 2 });
    expect(state.travel_days).toBe(5);
    expect(state.travel_order).toEqual(["Osaka", "Tokyo"]);
    expect(state.selected_flights).toHaveLength(1);
    expect(state.selected_hotels).toHaveLength(1);
    expect(
      Object.values(state.city_days).reduce((total, days) => total + days, 0)
    ).toBe(state.travel_days);
  });

  it("does not infer travel_days from city defaults when only destinations are known", () => {
    const state = coerceTravelState({
      countries: ["日本"],
      cities: ["东京", "大阪"],
      city_days: { "东京": 2, "大阪": 2 },
    });

    expect(state.city_days).toEqual({ "东京": 2, "大阪": 2 });
    expect(state.travel_days).toBeNull();
  });

  it("deduplicates country aliases without treating arbitrary short text as a code", () => {
    const state = coerceTravelState({
      countries: [
        "Poland",
        "波兰",
        "POLAND",
        "US",
        "美国",
        "United States",
        "AB",
        "ab",
      ],
    });

    expect(state.countries).toEqual(["Poland", "US", "AB"]);
    expect(state.country).toBe("Poland、US、AB");
  });
});

describe("Travel conversation destination operations", () => {
  it("makes alias and repeated add/remove operations idempotent", () => {
    const initial = completeState();
    const addAlias = operation({
      op: "add",
      path: "cities",
      valueText: "Tokyo",
      evidence: "Tokyo",
    });
    const firstAdd = applyTravelStateOperations(initial, [addAlias]);
    const secondAdd = applyTravelStateOperations(firstAdd.state, [addAlias]);

    expect(firstAdd.state.cities).toEqual(["东京", "大阪"]);
    expect(firstAdd.state.destination_confirmed).toBe(true);
    expect(firstAdd.state.selected_flights).toHaveLength(1);
    expect(firstAdd.state.selected_hotels).toHaveLength(1);
    expect(secondAdd.state).toEqual(firstAdd.state);

    const removeAbsent = operation({
      op: "remove",
      path: "cities",
      valueText: "京都",
      evidence: "京都",
    });
    const firstRemove = applyTravelStateOperations(firstAdd.state, [removeAbsent]);
    const secondRemove = applyTravelStateOperations(firstRemove.state, [removeAbsent]);
    expect(firstRemove.state).toEqual(firstAdd.state);
    expect(secondRemove.state).toEqual(firstRemove.state);
  });

  it("clears stale flight and hotel choices only when a city really changes", () => {
    const result = applyTravelStateOperations(completeState(), [
      operation({
        op: "add",
        path: "cities",
        valueText: "京都",
        evidence: "京都",
      }),
    ]);

    expect(result.state.countries).toEqual(["日本"]);
    expect(result.state.country).toBe("日本");
    expect(result.state.cities).toEqual(["东京", "大阪", "京都"]);
    expect(result.state.destination_confirmed).toBe(false);
    expect(result.state.selected_flights).toEqual([]);
    expect(result.state.selected_hotels).toEqual([]);
    expect(result.state.travel_days).toBe(5);
    expect(Object.values(result.state.city_days)).toEqual([2, 2, 1]);
  });

  it("changes countries without deleting cities and synchronizes the scalar country", () => {
    const added = applyTravelStateOperations(completeState(), [
      operation({
        op: "add",
        path: "countries",
        valueText: "韩国",
        evidence: "韩国",
      }),
    ]);

    expect(added.state.countries).toEqual(["日本", "韩国"]);
    expect(added.state.country).toBe("日本、韩国");
    expect(added.state.cities).toEqual(["东京", "大阪"]);
    expect(added.state.selected_flights).toEqual([]);
    expect(added.state.selected_hotels).toEqual([]);

    const removed = applyTravelStateOperations(added.state, [
      operation({
        op: "remove",
        path: "countries",
        valueText: "韩国",
        evidence: "韩国",
      }),
    ]);
    expect(removed.state.countries).toEqual(["日本"]);
    expect(removed.state.country).toBe("日本");
    expect(removed.state.cities).toEqual(["东京", "大阪"]);
  });

  it("keeps cities when the last country is removed, while clearing the country scalar", () => {
    const result = applyTravelStateOperations(completeState(), [
      operation({
        op: "remove",
        path: "countries",
        valueText: "日本",
        evidence: "日本",
      }),
    ]);

    expect(result.state.countries).toEqual([]);
    expect(result.state.country).toBeNull();
    expect(result.state.cities).toEqual(["东京", "大阪"]);
  });

  it("accepts a complete travel order expressed with Chinese or English city aliases", () => {
    const result = applyTravelStateOperations(completeState(), [
      operation({
        path: "travel_order",
        valueText: "Osaka -> Tokyo",
        evidence: "Osaka -> Tokyo",
      }),
    ]);

    expect(result.state.travel_order).toEqual(["大阪", "东京"]);
    expect(result.state.selected_flights).toEqual([]);
    expect(result.state.selected_hotels).toEqual([]);

    const repeated = applyTravelStateOperations(result.state, [
      operation({
        path: "travel_order",
        valueText: "大阪、东京",
        evidence: "大阪、东京",
      }),
    ]);
    expect(repeated.state).toEqual(result.state);
  });
});

describe("Travel conversation scalar operations", () => {
  it.each([
    ["travel_days", { valueNumber: 6 }],
    ["travelers", { valueNumber: 3 }],
    ["departure_date", { valueText: "2026-10-06" }],
  ] as const)("clears selections when %s changes", (path, values) => {
    const result = applyTravelStateOperations(completeState(), [
      operation({ path, ...values }),
    ]);

    expect(result.state.selected_flights).toEqual([]);
    expect(result.state.selected_hotels).toEqual([]);
  });

  it("preserves selections for repeated scalar values", () => {
    const state = completeState();
    const result = applyTravelStateOperations(state, [
      operation({ path: "travel_days", valueNumber: 5 }),
      operation({ path: "travelers", valueNumber: 2 }),
      operation({ path: "departure_date", valueText: "2026-10-05" }),
    ]);

    expect(result.state.selected_flights).toHaveLength(1);
    expect(result.state.selected_hotels).toHaveLength(1);
    expect(result.state.travel_days).toBe(5);
    expect(result.state.travelers).toBe(2);
    expect(result.state.departure_date).toBe("2026-10-05");
  });

  it("rejects empty or invalid scalar values without hidden inference", () => {
    const state = completeState();
    const result = applyTravelStateOperations(state, [
      operation({
        path: "cities",
        op: "add",
        valueText: "京都",
        explicit: false,
        evidence: "用户可能喜欢京都",
      }),
      operation({
        path: "departure_date",
        valueText: "not-a-date",
        evidence: "日期不清楚",
      }),
      operation({
        path: "budget",
        valueNumber: 0,
        evidence: "预算不明确",
      }),
    ]);

    expect(result.applied).toEqual([]);
    expect(result.rejected).toHaveLength(3);
    expect(result.state).toEqual(coerceTravelState(state));
  });

  it("makes unset and reset operations idempotent", () => {
    const unset = operation({ op: "unset", path: "departure_date" });
    const firstUnset = applyTravelStateOperations(completeState(), [unset]);
    const secondUnset = applyTravelStateOperations(firstUnset.state, [unset]);

    expect(firstUnset.state.departure_date).toBeNull();
    expect(firstUnset.state.date_flexibility).toBeNull();
    expect(firstUnset.state.selected_flights).toEqual([]);
    expect(firstUnset.state.selected_hotels).toEqual([]);
    expect(secondUnset.state).toEqual(firstUnset.state);

    const reset = operation({ op: "reset", path: "trip", evidence: "重新开始" });
    const firstReset = applyTravelStateOperations(firstUnset.state, [reset]);
    const secondReset = applyTravelStateOperations(firstReset.state, [reset]);
    expect(firstReset.state).toEqual(createInitialTravelState());
    expect(secondReset.state).toEqual(firstReset.state);
  });
});
