import assert from "node:assert/strict";
import test from "node:test";
import { formatOfficialFlightDisplayLabel } from "../flight-label";

test("matches the portal alias for a four-digit flight number with a leading zero", () => {
  assert.equal(
    formatOfficialFlightDisplayLabel("MH0746", "DAD"),
    "MH746 (MH0746) - DAD",
  );
});

test("keeps a four-digit flight number without a leading zero unchanged", () => {
  assert.equal(
    formatOfficialFlightDisplayLabel("VJ5439", "CXR"),
    "VJ5439 - CXR",
  );
});

test("does not rewrite airline prefixes that are not two letters", () => {
  assert.equal(
    formatOfficialFlightDisplayLabel("3K0557", "SGN"),
    "3K0557 - SGN",
  );
});
