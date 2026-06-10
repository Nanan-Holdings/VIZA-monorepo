import { test } from "node:test";
import assert from "node:assert/strict";
import { TR_FIELD_MAPPINGS, mapTrAnswers, trMissingRequired } from "../field-mappings.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG", given_names: "Edward", email: "e@example.com",
  date_of_birth: "1990-04-15", nationality: "CHN",
  passport_number: "E12345678", passport_expiry_date: "2030-01-01",
};

test("tr.field-mappings: date transform + select kind", () => {
  const m = mapTrAnswers(SAMPLE);
  assert.equal(m.find((x) => x.selector === 'input[name="date_of_birth"]')?.value, "15/04/1990");
  assert.equal(m.find((x) => x.selector === 'select[name="nationality"]')?.kind, "select");
});
test("tr.field-mappings: missingRequired + 10-field set", () => {
  assert.deepEqual(trMissingRequired(SAMPLE), []);
  assert.ok(trMissingRequired({}).includes("surname"));
  assert.equal(TR_FIELD_MAPPINGS.length, 10);
});
