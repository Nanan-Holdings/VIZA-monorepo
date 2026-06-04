import { test } from "node:test";
import assert from "node:assert/strict";
import { AE_FIELD_MAPPINGS, mapAeAnswers, aeMissingRequired } from "../field-mappings.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG", given_names: "Edward", email: "e@example.com",
  date_of_birth: "1990-04-15", nationality: "CHN",
  passport_number: "E12345678", passport_expiry_date: "2030-01-01",
};

test("ae.field-mappings: date transform + select kind", () => {
  const m = mapAeAnswers(SAMPLE);
  assert.equal(m.find((x) => x.selector === 'input[name="date_of_birth"]')?.value, "15/04/1990");
  assert.equal(m.find((x) => x.selector === 'select[name="nationality"]')?.kind, "select");
});
test("ae.field-mappings: missingRequired + 10-field set", () => {
  assert.deepEqual(aeMissingRequired(SAMPLE), []);
  assert.ok(aeMissingRequired({}).includes("email"));
  assert.equal(AE_FIELD_MAPPINGS.length, 10);
});
