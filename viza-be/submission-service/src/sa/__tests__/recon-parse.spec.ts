import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReconField } from "../form-recon.js";
import { SA_FIELD_MAPPINGS } from "../field-mappings.js";

/**
 * RUN-SA-002: recon parsing on a fixture. Given a recon field inventory
 * (the shape form-recon.discoverFields produces), assert we can resolve the
 * portal field names our mappings target — the check the recon-promote step
 * runs before selectors are trusted.
 */

// Fixture: a recon snapshot of the Saudi portal's form fields.
const RECON_FIXTURE: ReconField[] = [
  { tag: "input", name: "surname", id: "surname", type: "text", placeholder: "Surname" },
  { tag: "input", name: "given_names", id: "gn", type: "text", placeholder: "Given names" },
  { tag: "input", name: "email", id: "email", type: "email", placeholder: "Email" },
  { tag: "input", name: "date_of_birth", id: "dob", type: "text", placeholder: "DOB" },
  { tag: "select", name: "nationality", id: "nat", type: "select-one", placeholder: "" },
  { tag: "input", name: "passport_number", id: "pn", type: "text", placeholder: "" },
  { tag: "input", name: "passport_expiry", id: "pe", type: "text", placeholder: "" },
];

/** Extract the name="X" token from a `tag[name="X"]` selector. */
function selectorName(selector: string): string | null {
  const m = /name="([^"]+)"/.exec(selector);
  return m ? m[1] : null;
}

test("sa.recon-parse: required mapping fields are present in the recon fixture", () => {
  const reconNames = new Set(RECON_FIXTURE.map((f) => f.name));
  const requiredNames = SA_FIELD_MAPPINGS.filter((m) => m.required)
    .map((m) => selectorName(m.selector))
    .filter((n): n is string => n != null);
  for (const name of requiredNames) {
    assert.ok(reconNames.has(name), `recon fixture exposes required field '${name}'`);
  }
});

test("sa.recon-parse: select fields in the fixture are typed select", () => {
  const nat = RECON_FIXTURE.find((f) => f.name === "nationality");
  assert.equal(nat?.tag, "select");
});
