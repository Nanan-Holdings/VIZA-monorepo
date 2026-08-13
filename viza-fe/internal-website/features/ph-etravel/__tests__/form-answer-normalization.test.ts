import { describe, expect, test } from "vitest";

import { normalizePhEtravelArrivalFormAnswers } from "../form-answer-normalization";

describe("Philippines eTravel form answer normalization", () => {
  test("clears hidden SEA stay answers without leaking that rule into AIR", () => {
    const sea = normalizePhEtravelArrivalFormAnswers({
      transport_type: "SEA", is_disembarking: "no", stay_location_type: "HOTEL", hotel_name_or_address: "Saved hotel",
    });
    const air = normalizePhEtravelArrivalFormAnswers({
      transport_type: "AIR", stay_location_type: "HOTEL", hotel_name_or_address: "Saved hotel",
    });
    expect(sea.values.stay_location_type).toBe("");
    expect(sea.values.hotel_name_or_address).toBe("");
    expect(air.values.stay_location_type).toBe("HOTEL");
    expect(air.values.hotel_name_or_address).toBe("Saved hotel");
    expect(air.clearedFieldNames).not.toContain("hotel_name_or_address");
  });

  test("clears only observed Health positive branches", () => {
    const result = normalizePhEtravelArrivalFormAnswers({
      has_recent_travel_history_30d: "no", visited_countries_30d: "PH", has_been_sick_30d: "yes", sickness_symptoms: "cough",
    });
    expect(result.values.visited_countries_30d).toBe("");
    expect(result.values.sickness_symptoms).toBe("cough");
  });

  test("clears Owner and recipient values only on electronic positive Owner N/A", () => {
    const result = normalizePhEtravelArrivalFormAnswers({
      transport_type: "SEA", sea_flow: "electronic_customs", customs_declaration: "yes", currency_declaration: "yes",
      owner_details_not_applicable: "true", owner_first_name: "Not retained", recipient_last_name: "Not retained", currency_transport_method: "courier",
    });
    expect(result.values.owner_first_name).toBeUndefined();
    expect(result.values.recipient_last_name).toBeUndefined();
    expect(result.values.currency_transport_method).toBe("courier");
  });
});
