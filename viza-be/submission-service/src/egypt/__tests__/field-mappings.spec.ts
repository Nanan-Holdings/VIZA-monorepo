import { test } from "node:test";
import assert from "node:assert/strict";
import { mapEgAnswers, missingRequired, toEgDate, EG_FIELD_MAPPINGS } from "../field-mappings.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG",
  given_names: "Edward",
  email: "e@example.com",
  date_of_birth: "1990-04-15",
  nationality: "CHN",
  passport_number: "E12345678",
  passport_expiry_date: "2030-01-01",
};

test("eg.field-mappings: toEgDate reformats to DD-MM-YYYY", () => {
  assert.equal(toEgDate("1990-04-15"), "15-04-1990");
  assert.equal(toEgDate("bad"), "bad");
});

test("eg.field-mappings: mapEgAnswers transforms dates + marks selects", () => {
  const mapped = mapEgAnswers(SAMPLE);
  const dob = mapped.find((m) => m.selector === 'input[name="date_of_birth"]');
  assert.equal(dob?.value, "15-04-1990");
  const nat = mapped.find((m) => m.selector === 'select[name="nationality"]');
  assert.equal(nat?.kind, "select");
});

test("eg.field-mappings: missingRequired flags absent keys", () => {
  assert.deepEqual(missingRequired(SAMPLE), []);
  assert.ok(missingRequired({}).includes("surname"));
});

test("eg.field-mappings: all mappings have selectors", () => {
  for (const m of EG_FIELD_MAPPINGS) assert.ok(m.selector.length > 0);
});
