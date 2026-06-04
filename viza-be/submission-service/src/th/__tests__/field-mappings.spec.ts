import { test } from "node:test";
import assert from "node:assert/strict";
import { TH_FIELD_MAPPINGS, mapThAnswers, thMissingRequired } from "../field-mappings.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG", given_names: "Edward", email: "e@example.com",
  date_of_birth: "1990-04-15", nationality: "CHN",
  passport_number: "E12345678", passport_expiry_date: "2030-01-01",
};

test("th.field-mappings: date transform + select kind", () => {
  const m = mapThAnswers(SAMPLE);
  assert.equal(m.find((x) => x.selector === 'input[name="date_of_birth"]')?.value, "15/04/1990");
  assert.equal(m.find((x) => x.selector === 'select[name="nationality"]')?.kind, "select");
});
test("th.field-mappings: missingRequired + 10-field set", () => {
  assert.deepEqual(thMissingRequired(SAMPLE), []);
  assert.ok(thMissingRequired({}).includes("passport_number"));
  assert.equal(TH_FIELD_MAPPINGS.length, 10);
});
