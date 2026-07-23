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

  it("models official flights plus the official Other/manual-flight branch", () => {
    const flightField = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "flight_number");
    const customFlightField = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "custom_flight_number");
    const airportField = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "border_gate_airport");

    expect(flightField?.field_type).toBe("select");
    expect(flightField?.required).toBe(true);
    expect(flightField?.conditional_logic).toEqual({ showIf: "mode_of_travel === air" });
    expect(flightField?.validation_rules).toMatchObject({
      remote_search: true,
      official_source: "prearrival_category:flight",
      derives: { border_gate_airport: "airport" },
    });
    expect(customFlightField).toMatchObject({
      field_type: "text",
      required: true,
      conditional_logic: { showIf: "mode_of_travel === air && flight_number === other" },
    });
    expect(airportField?.required).toBe(true);
    expect(airportField?.validation_rules).toMatchObject({
      locked_by: "flight_number",
      editable_when_value: "other",
    });
    expect(VN_PREARRIVAL_FLIGHT_OPTIONS[0]).toMatchObject({
      value: "other",
      official_label: "Other",
    });
    expect(VN_PREARRIVAL_FLIGHT_OPTIONS[1]).toMatchObject({
      value: "UO0566_CXR",
      official_label: "UO0566 - CXR",
      airport: "CXR",
    });
    expect(VN_PREARRIVAL_AIRPORT_OPTIONS.map((option) => option.value)).toEqual(["SGN", "HAN", "DAD", "CXR", "PQC"]);
  });

  it("does not ask for a passport image inside the official question list", () => {
    expect(fieldNames).not.toContain("passport_image");
  });

  it("uses Chinese step names for the Vietnam pre-arrival frontend tabs", () => {
    expect([...new Set(VN_PREARRIVAL_FORM_FIELDS.map((field) => field.step_name))]).toEqual([
      "旅客信息",
      "行程信息",
      "确认申报",
    ]);
  });

  it("shows the official visa information note and where to find the visa number", () => {
    const acknowledgement = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "visa_information_acknowledgement");
    const visaNumber = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "visa_number");

    expect(acknowledgement?.validation_rules).toMatchObject({
      helper_zh: expect.stringContaining("所选签证类型决定"),
      helper_en: expect.stringContaining("selected visa type determines"),
    });
    expect(visaNumber?.validation_rules).toMatchObject({
      numeric_length_when: { field: "visa_type", equals: "EV", length: 9 },
      helper_zh: expect.stringContaining("9 位纯数字"),
      helper_en: expect.stringContaining("9-digit numeric"),
    });
  });

  it("uses official hotel dropdown only for hotels and free-text address for residential or others", () => {
    const hotelAddress = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "hotel_accommodation_address");
    const freeTextAddress = VN_PREARRIVAL_FORM_FIELDS.find((field) => field.field_name === "accommodation_address");

    expect(hotelAddress).toMatchObject({
      field_type: "select",
      required: true,
      conditional_logic: { showIf: "accommodation_type === hotel" },
      validation_rules: expect.objectContaining({
        official_source: "prearrival_category:hotel",
        remote_search: true,
      }),
    });
    expect(freeTextAddress).toMatchObject({
      field_type: "text",
      required: true,
      conditional_logic: { showIf: "accommodation_type in [residential, others]" },
    });
  });
});
