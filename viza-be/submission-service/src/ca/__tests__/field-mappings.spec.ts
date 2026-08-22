import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CA_PURPOSE_FIELD_MAPPINGS,
  caPurposeMissingRequired,
} from "../field-mappings.js";

test("CA field map uses the exact authenticated purpose-page selectors", () => {
  assert.deepEqual(
    CA_PURPOSE_FIELD_MAPPINGS.slice(0, 3).map((mapping) => mapping.selector),
    [
      "#applyingFor_radio-button-464-input",
      "#visaPurpose_radio-button-470-input",
      "#visitDetails_txtArea",
    ],
  );
  assert.equal(CA_PURPOSE_FIELD_MAPPINGS.length, 10);
});

test("CA purpose mapping reports only its three truthful required answers", () => {
  assert.deepEqual(caPurposeMissingRequired({}), [
    "visit_details",
    "intended_stay_from",
    "intended_stay_to",
  ]);
  assert.deepEqual(
    caPurposeMissingRequired({
      visit_details: "Tourism in Alberta.",
      intended_stay_from: "2026-10-10",
      intended_stay_to: "2026-10-15",
    }),
    [],
  );
});
