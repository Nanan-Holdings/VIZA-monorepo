import { describe, expect, it } from "vitest";
import { extractKoreaEArrivalAnswers } from "./answer-loader";

describe("Korea e-Arrival Card answer routing", () => {
  it("uses only canonical Korea fields and does not consume SGAC transport keys", () => {
    const snapshot = extractKoreaEArrivalAnswers([
      { field_name: "transport_type", value_text: "AIR" },
      { field_name: "flight_arrival_date", value_text: "2030-01-02" },
      { field_name: "flight_departure_date", value_text: "2030-01-05" },
    ], {
      arrival_date: "2030-02-01",
      departure_date: "2030-02-05",
    });

    expect(snapshot.arrivalDate).toBe("2030-02-01");
    expect(snapshot.departureDate).toBe("2030-02-05");
    expect(snapshot.arrivalMode).toBeNull();
    expect(snapshot.stayAddressProvided).toBe(false);
  });

  it("reads Korea arrival, departure, mode, and stay address fields", () => {
    const snapshot = extractKoreaEArrivalAnswers([
      { field_name: "arrival_mode", value_json: "AIR" },
      { field_name: "arrival_date", value_text: "2030-01-02" },
      { field_name: "departure_date", value_text: "2030-01-05" },
      { field_name: "stay_address_en", value_text: "Seoul" },
    ]);

    expect(snapshot).toEqual({
      arrivalDate: "2030-01-02",
      departureDate: "2030-01-05",
      arrivalMode: "AIR",
      stayAddressProvided: true,
    });
  });
});
