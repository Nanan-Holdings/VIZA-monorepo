import { describe, expect, it } from "vitest";
import {
  isKoreaArrivalCardSchemaUnavailable,
  KOREA_REQUIRED_SCHEMA_FIELD_NAMES,
} from "./schema-availability";

describe("Korea e-Arrival Card schema availability", () => {
  it("fails closed only after the Korea schema load completes without fields", () => {
    expect(isKoreaArrivalCardSchemaUnavailable({
      isKoreaArrivalCard: true,
      schemaLoadComplete: false,
      schemaFieldNames: [],
    })).toBe(false);
    expect(isKoreaArrivalCardSchemaUnavailable({
      isKoreaArrivalCard: true,
      schemaLoadComplete: true,
      schemaFieldNames: [],
    })).toBe(true);
    expect(isKoreaArrivalCardSchemaUnavailable({
      isKoreaArrivalCard: true,
      schemaLoadComplete: true,
      schemaFieldNames: [...KOREA_REQUIRED_SCHEMA_FIELD_NAMES, "arrival_date"],
    })).toBe(false);
    expect(isKoreaArrivalCardSchemaUnavailable({
      isKoreaArrivalCard: true,
      schemaLoadComplete: true,
      schemaFieldNames: [...KOREA_REQUIRED_SCHEMA_FIELD_NAMES, "email_address"],
    })).toBe(true);
    expect(isKoreaArrivalCardSchemaUnavailable({
      isKoreaArrivalCard: true,
      schemaLoadComplete: true,
      schemaFieldNames: ["surname", "given_name", "email_address", "trip_payer", "security_question"],
    })).toBe(true);
    expect(isKoreaArrivalCardSchemaUnavailable({
      isKoreaArrivalCard: false,
      schemaLoadComplete: true,
      schemaFieldNames: [],
    })).toBe(false);
  });
});
