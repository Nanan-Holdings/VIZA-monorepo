import { test } from "node:test";
import assert from "node:assert/strict";
import { mapSaAnswers, missingRequired, toSaDate, SA_FIELD_MAPPINGS } from "../field-mappings.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG",
  given_names: "Edward",
  email: "e@example.com",
  date_of_birth: "1990-04-15",
  nationality: "CHN",
  passport_number: "E12345678",
  passport_expiry_date: "2030-01-01",
};

test("sa.field-mappings: toSaDate reformats to DD/MM/YYYY", () => {
  assert.equal(toSaDate("1990-04-15"), "15/04/1990");
  assert.equal(toSaDate("bad"), "bad");
});

test("sa.field-mappings: mapSaAnswers transforms dates + marks selects", () => {
  const mapped = mapSaAnswers(SAMPLE);
  assert.equal(mapped.find((m) => m.selector === 'input[name="date_of_birth"]')?.value, "15/04/1990");
  assert.equal(mapped.find((m) => m.selector === 'select[name="nationality"]')?.kind, "select");
});

test("sa.field-mappings: missingRequired flags absent keys", () => {
  assert.deepEqual(missingRequired(SAMPLE), []);
  assert.ok(missingRequired({}).includes("surname"));
});

test("sa.field-mappings: all mappings have selectors", () => {
  for (const m of SA_FIELD_MAPPINGS) assert.ok(m.selector.length > 0);
});
