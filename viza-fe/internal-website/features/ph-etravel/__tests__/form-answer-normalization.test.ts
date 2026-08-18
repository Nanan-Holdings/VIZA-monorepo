import { describe, expect, test } from "vitest";

import { normalizePhEtravelArrivalFormAnswers } from "../form-answer-normalization";

describe("Philippines eTravel form answer normalization", () => {
  test("clears hidden SEA stay answers without leaking that rule into AIR", () => {
    const sea = normalizePhEtravelArrivalFormAnswers({
      transport_type: "SEA",
      is_disembarking: "no",
      stay_location_type: "HOTEL",
      hotel_name_or_address: "Saved hotel",
    });
    const air = normalizePhEtravelArrivalFormAnswers({
      transport_type: "AIR",
      stay_location_type: "HOTEL",
      hotel_name_or_address: "Saved hotel",
    });
    expect(sea.values.stay_location_type).toBe("");
    expect(sea.values.hotel_name_or_address).toBe("");
    expect(air.values.stay_location_type).toBe("HOTEL");
    expect(air.values.hotel_name_or_address).toBe("Saved hotel");
    expect(air.clearedFieldNames).not.toContain("hotel_name_or_address");
  });

  test("clears the current Health child field names when a parent is No", () => {
    const result = normalizePhEtravelArrivalFormAnswers({
      has_recent_travel_history_30d: "no",
      visited_country_30d: "PH",
      has_been_sick_30d: "yes",
      sickness_symptom: "SS002",
    });
    expect(result.values.visited_country_30d).toBe("");
    expect(result.values.sickness_symptom).toBe("SS002");
    expect(result.clearedFieldNames).toContain("visited_country_30d");
  });

  test("clears symptom selections when the sick answer switches to No", () => {
    const result = normalizePhEtravelArrivalFormAnswers({
      has_been_sick_30d: "no",
      sickness_symptom: "SS002",
    });

    expect(result.values.sickness_symptom).toBe("");
    expect(result.clearedFieldNames).toContain("sickness_symptom");
  });

  test("clears Owner and recipient values only on electronic positive Owner N/A", () => {
    const result = normalizePhEtravelArrivalFormAnswers({
      transport_type: "SEA",
      sea_flow: "electronic_customs",
      customs_declaration: "yes",
      currency_declaration: "yes",
      owner_details_not_applicable: "true",
      owner_first_name: "Not retained",
      recipient_last_name: "Not retained",
      currency_transport_method: "courier",
    });
    expect(result.values.owner_first_name).toBeUndefined();
    expect(result.values.recipient_last_name).toBeUndefined();
    expect(result.values.currency_transport_method).toBe("courier");
  });

  test("keeps official purpose code including POV999 and rejects labels as submitted values", () => {
    const code = normalizePhEtravelArrivalFormAnswers({
      purpose_of_travel: "POV999",
    });
    const label = normalizePhEtravelArrivalFormAnswers({
      purpose_of_visit_code: "Others",
      purpose_of_travel: "Others",
    });

    expect(code.values.purpose_of_visit_code).toBe("POV999");
    expect(code.values.purpose_of_travel).toBe("POV999");
    expect(label.values.purpose_of_visit_code).toBe("");
    expect(label.values.purpose_of_travel).toBe("");
    expect(label.clearedFieldNames).toEqual(
      expect.arrayContaining(["purpose_of_visit_code", "purpose_of_travel"])
    );
  });

  test("clears electronic customs answers when a SEA destination switches to manual forms", () => {
    const result = normalizePhEtravelArrivalFormAnswers({
      transport_type: "SEA",
      sea_flow: "manual_forms",
      customs_declaration: "yes",
      has_baggage_or_currency_to_declare: "yes",
      goods_amount: "1000",
      baggage_items: "saved item",
      currency_declaration: "yes",
      currency_items: "saved currency",
    });

    expect(result.values.customs_declaration).toBe("");
    expect(result.values.goods_amount).toBe("");
    expect(result.values.currency_items).toBe("");
    expect(result.clearedFieldNames).toEqual(
      expect.arrayContaining([
        "customs_declaration",
        "has_baggage_or_currency_to_declare",
        "goods_amount",
        "baggage_items",
        "currency_items",
      ])
    );
  });

  test("clears positive electronic customs descendants when SEA electronic branch switches to No", () => {
    const result = normalizePhEtravelArrivalFormAnswers({
      transport_type: "SEA",
      sea_flow: "electronic_customs",
      customs_declaration: "no",
      goods_amount: "1000",
      baggage_items: "saved item",
      currency_declaration: "yes",
      currency_items: "saved currency",
      no_of_days_in_philippines: "3",
    });

    expect(result.values.customs_declaration).toBe("no");
    expect(result.values.goods_amount).toBe("");
    expect(result.values.currency_declaration).toBe("");
    expect(result.values.no_of_days_in_philippines).toBe("");
    expect(result.clearedFieldNames).toEqual(
      expect.arrayContaining([
        "goods_amount",
        "baggage_items",
        "currency_declaration",
        "currency_items",
        "no_of_days_in_philippines",
      ])
    );
  });
});
