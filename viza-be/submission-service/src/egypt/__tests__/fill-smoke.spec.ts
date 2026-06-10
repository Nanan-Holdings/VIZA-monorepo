import { test } from "node:test";
import assert from "node:assert/strict";
import { mapEgAnswers, EG_FIELD_MAPPINGS } from "../field-mappings.js";

/**
 * RUN-EG-002: recon+fill smoke against a fixture. Asserts that, given a
 * recon'd field inventory (the selectors the runner expects) and a complete
 * answer set, the fill plan covers every recon'd field and produces values.
 * Browser-free — exercises the deterministic mapping the runner applies.
 */

// Fixture: the field inventory a recon snapshot (form-recon.ts) would yield.
const RECON_FIELDS = EG_FIELD_MAPPINGS.map((m) => m.selector);

const COMPLETE_ANSWERS: Record<string, string> = {
  surname: "ZHANG",
  given_names: "Edward Zehua",
  email: "edward@example.com",
  phone: "+201000000000",
  date_of_birth: "1990-04-15",
  nationality: "CHN",
  passport_number: "E12345678",
  passport_expiry_date: "2030-01-01",
  passport_issuing_country: "CHN",
  intended_arrival_date: "2026-08-01",
};

test("eg.fill-smoke: fill plan covers every recon'd selector for a complete answer set", () => {
  const plan = mapEgAnswers(COMPLETE_ANSWERS);
  const planned = new Set(plan.map((p) => p.selector));
  for (const selector of RECON_FIELDS) {
    assert.ok(planned.has(selector), `plan fills ${selector}`);
  }
  // every planned value is non-empty
  for (const p of plan) assert.ok(p.value.length > 0, `${p.selector} has a value`);
});

test("eg.fill-smoke: partial answers fill only the provided fields", () => {
  const plan = mapEgAnswers({ surname: "ZHANG", email: "e@e.com" });
  assert.equal(plan.length, 2);
});
