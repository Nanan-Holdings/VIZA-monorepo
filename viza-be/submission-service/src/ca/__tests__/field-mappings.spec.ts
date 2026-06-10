import { test } from "node:test";
import assert from "node:assert/strict";
import { CA_FIELD_MAPPINGS, mapCaAnswers, caMissingRequired } from "../field-mappings.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG", given_names: "Edward", email: "e@example.com",
  date_of_birth: "1990-04-15", nationality: "CHN",
  passport_number: "E12345678", passport_expiry_date: "2030-01-01",
};

test("ca.field-mappings: date transform DD/MM/YYYY + select kind", () => {
  const mapped = mapCaAnswers(SAMPLE);
  assert.equal(mapped.find((m) => m.selector === 'input[name="date_of_birth"]')?.value, "15/04/1990");
  assert.equal(mapped.find((m) => m.selector === 'select[name="nationality"]')?.kind, "select");
});

test("ca.field-mappings: missingRequired flags absent keys", () => {
  assert.deepEqual(caMissingRequired(SAMPLE), []);
  assert.ok(caMissingRequired({}).includes("surname"));
});

test("ca.field-mappings: standard 10-field set", () => {
  assert.equal(CA_FIELD_MAPPINGS.length, 10);
});
