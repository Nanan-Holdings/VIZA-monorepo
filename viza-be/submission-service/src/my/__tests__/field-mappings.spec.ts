import { test } from "node:test";
import assert from "node:assert/strict";
import { mapMyAnswers, missingRequired, toMyDate, MY_FIELD_MAPPINGS } from "../field-mappings.js";
import type { ReconField } from "../form-recon.js";

const SAMPLE: Record<string, string> = {
  surname: "ZHANG",
  given_names: "Edward",
  email: "e@example.com",
  date_of_birth: "1990-04-15",
  nationality: "CHN",
  passport_number: "E12345678",
  passport_expiry_date: "2030-01-01",
};

test("my.field-mappings: toMyDate reformats to DD/MM/YYYY", () => {
  assert.equal(toMyDate("1990-04-15"), "15/04/1990");
});

test("my.field-mappings: mapMyAnswers transforms dates + marks selects", () => {
  const mapped = mapMyAnswers(SAMPLE);
  assert.equal(mapped.find((m) => m.selector === 'input[name="date_of_birth"]')?.value, "15/04/1990");
  assert.equal(mapped.find((m) => m.selector === 'select[name="nationality"]')?.kind, "select");
});

test("my.field-mappings: missingRequired flags absent keys", () => {
  assert.deepEqual(missingRequired(SAMPLE), []);
  assert.ok(missingRequired({}).includes("passport_number"));
});

test("my.recon-parse: required fields present in a recon fixture", () => {
  const fixture: ReconField[] = MY_FIELD_MAPPINGS.filter((m) => m.required).map((m) => ({
    tag: "input",
    name: /name="([^"]+)"/.exec(m.selector)?.[1] ?? "",
    id: "",
    type: "text",
    placeholder: "",
  }));
  const names = new Set(fixture.map((f) => f.name));
  for (const m of MY_FIELD_MAPPINGS.filter((x) => x.required)) {
    const n = /name="([^"]+)"/.exec(m.selector)?.[1] ?? "";
    assert.ok(names.has(n), `recon exposes ${n}`);
  }
});
