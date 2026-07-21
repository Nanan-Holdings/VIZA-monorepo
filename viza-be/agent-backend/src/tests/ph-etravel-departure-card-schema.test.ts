import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

import {
  PH_ETRAVEL_DEPARTURE_FORM_FIELDS,
  PH_ETRAVEL_DEPARTURE_VISA_TYPE,
} from "../../scripts/ph-etravel/departure-form-fields";

const migrationSource = readFileSync(
  new URL("../../drizzle/0113_ph_etravel_departure_card_package.sql", import.meta.url),
  "utf8",
);

describe("Philippines eTravel Departure Card schema seed", () => {
  test("is an independent package with a locked departure travel type", () => {
    expect(PH_ETRAVEL_DEPARTURE_VISA_TYPE).toBe("PH_ETRAVEL_DEPARTURE_CARD");
    expect(migrationSource).toContain("PH_ETRAVEL_DEPARTURE_CARD");
    expect(migrationSource).not.toContain("PH_ETRAVEL_ARRIVAL_CARD");

    const travelType = PH_ETRAVEL_DEPARTURE_FORM_FIELDS.find((field) => field.field_name === "travel_type");
    expect(travelType?.options?.map((option) => option.value)).toEqual(["DEPARTURE"]);
    expect(travelType?.validation_rules).toMatchObject({ defaultValue: "DEPARTURE", locked: true });
  });

  test("covers air/sea, Filipino/foreigner, travel tax, customs and currency branches", () => {
    const names = new Set(PH_ETRAVEL_DEPARTURE_FORM_FIELDS.map((field) => field.field_name));
    for (const name of [
      "passport_holder_type", "departure_airport", "departure_seaport", "airline_name", "flight_number",
      "vessel_name", "destination_country", "destination_port", "flight_departure_date", "flight_arrival_date",
      "return_date", "travel_tax_payment_type", "travel_tax_reference_number", "travel_tax_ticket_number",
      "cfo_registration_number", "has_goods_to_declare", "has_currency_to_declare", "currency_type",
      "currency_amount", "currency_source", "bsp_authorization_number", "bsp_authorization_date",
      "customs_signature_declaration", "final_declaration",
    ]) {
      expect(names.has(name), `${name} missing`).toBe(true);
    }
  });

  test("excludes arrival-only accommodation, health, entry-port and travel-history fields", () => {
    const names = new Set(PH_ETRAVEL_DEPARTURE_FORM_FIELDS.map((field) => field.field_name));
    for (const name of [
      "philippines_address", "destination_hotel_name", "destination_hotel_address", "destination_type",
      "port_of_entry", "airport_of_origin", "origin_country", "has_recent_travel_history_30d",
      "has_exposure_to_sick_person_30d", "has_been_sick_30d", "visited_country_30d",
    ]) {
      expect(names.has(name), `${name} must not be present`).toBe(false);
    }
  });

  test("keeps official option codes unique and every visible field bilingual", () => {
    const airports = PH_ETRAVEL_DEPARTURE_FORM_FIELDS.find((field) => field.field_name === "departure_airport")?.options ?? [];
    const seaports = PH_ETRAVEL_DEPARTURE_FORM_FIELDS.find((field) => field.field_name === "departure_seaport")?.options ?? [];
    expect(airports).toHaveLength(20);
    expect(seaports).toHaveLength(53);
    expect(new Set(airports.map((option) => option.value)).size).toBe(airports.length);
    expect(new Set(seaports.map((option) => option.value)).size).toBe(seaports.length);

    for (const field of PH_ETRAVEL_DEPARTURE_FORM_FIELDS) {
      expect(String(field.validation_rules?.label_zh ?? ""), field.field_name).toMatch(/[\u3400-\u9fff]/);
      for (const option of field.options ?? []) {
        expect(option.label_en || option.text, `${field.field_name}:${option.value}`).toBeTruthy();
        expect(option.label_zh, `${field.field_name}:${option.value}`).toMatch(/[\u3400-\u9fff]/);
      }
    }
  });
});
