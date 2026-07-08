import { describe, expect, it } from "vitest";
import { VN_PREARRIVAL_FORM_FIELDS } from "./form-fields";
import {
  VN_PREARRIVAL_AIRPORT_OPTIONS,
  VN_PREARRIVAL_FLIGHT_OPTIONS,
  VN_PREARRIVAL_PURPOSE_OPTIONS,
} from "./official-options";

const fieldNames = VN_PREARRIVAL_FORM_FIELDS.map((field) => field.field_name);

describe("Vietnam Pre-Arrival official form schema", () => {
  it("does not ask extra non-official declaration questions before the official review checkbox", () => {
    expect(fieldNames).not.toContain("official_free_acknowledgement");
    expect(fieldNames).not.toContain("prearrival_window_acknowledgement");
    expect(fieldNames).not.toContain("health_declaration_status");
    expect(fieldNames).not.toContain("health_guidance_acknowledgement");
    expect(fieldNames).not.toContain("is_group_submission");
  });

  it("uses the official purpose dropdown values from prearrival.immigration.gov.vn", () => {
    expect(VN_PREARRIVAL_PURPOSE_OPTIONS.map((option) => option.official_label)).toEqual([
      "Business trip",
      "Travel",
      "Study abroad",
      "Work",
      "Transit",
      "Other",
    ]);
  });

  it("models air arrival as a flight dropdown that locks the airport from the flight code", () => {
    const flightField = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "flight_number");
    const airportField = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "border_gate_airport");

    expect(flightField?.field_type).toBe("select");
    expect(flightField?.required).toBe(true);
    expect(flightField?.conditional_logic).toEqual({ showIf: "mode_of_travel === air" });
    expect(flightField?.validation_rules).toMatchObject({
      remote_search: true,
      official_source: "prearrival_category:flight",
      derives: { border_gate_airport: "airport" },
    });
    expect(airportField?.required).toBe(true);
    expect(airportField?.validation_rules).toMatchObject({ locked_by: "flight_number" });
    expect(VN_PREARRIVAL_FLIGHT_OPTIONS[0]).toMatchObject({
      value: "UO0566_CXR",
      official_label: "UO0566 - CXR",
      airport: "CXR",
    });
    expect(VN_PREARRIVAL_AIRPORT_OPTIONS.map((option) => option.value)).toEqual(["SGN", "HAN", "DAD", "CXR", "PQC"]);
  });
});
