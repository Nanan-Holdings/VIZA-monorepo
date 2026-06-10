import { test } from "node:test";
import assert from "node:assert/strict";
import { mapIdAnswers, missingRequired, toIdDate, ID_FIELD_MAPPINGS } from "../field-mappings.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG",
  given_names: "Edward Zehua",
  email: "edward@example.com",
  phone: "+6512345678",
  date_of_birth: "1990-04-15",
  nationality: "CHN",
  passport_number: "E12345678",
  passport_expiry_date: "2030-01-01",
  intended_arrival_date: "2026-07-01",
};

test("id.field-mappings: toIdDate reformats YYYY-MM-DD to DD/MM/YYYY", () => {
  assert.equal(toIdDate("1990-04-15"), "15/04/1990");
  assert.equal(toIdDate("not-a-date"), "not-a-date");
});

test("id.field-mappings: mapIdAnswers maps and transforms in order", () => {
  const mapped = mapIdAnswers(SAMPLE);
  const dob = mapped.find((m) => m.selector === 'input[name="date_of_birth"]');
  assert.ok(dob);
  assert.equal(dob.value, "15/04/1990"); // transformed
  const surname = mapped.find((m) => m.selector === 'input[name="surname"]');
  assert.equal(surname?.value, "ZHANG");
  const nationality = mapped.find((m) => m.selector === 'select[name="nationality"]');
  assert.equal(nationality?.kind, "select");
});

test("id.field-mappings: empty answers are skipped", () => {
  const mapped = mapIdAnswers({ surname: "ZHANG", given_names: "" });
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].selector, 'input[name="surname"]');
});

test("id.field-mappings: missingRequired flags absent required keys", () => {
  assert.deepEqual(missingRequired(SAMPLE), []);
  const missing = missingRequired({ given_names: "Edward" });
  assert.ok(missing.includes("surname"));
  assert.ok(missing.includes("passport_number"));
});

test("id.field-mappings: every mapping has a non-empty selector", () => {
  for (const m of ID_FIELD_MAPPINGS) {
    assert.ok(m.selector.length > 0, `${m.canonicalKey} has a selector`);
  }
});
