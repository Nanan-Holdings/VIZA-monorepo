import assert from "node:assert/strict";
import { test } from "node:test";
import { ds160TravelMappings } from "../ds160-form-mappings";

test("travel payer aliases both target the current CEAC payer dropdown", () => {
  assert.match(ds160TravelMappings.who_is_paying.selector, /ddlWhoIsPaying/);
  assert.match(ds160TravelMappings.travel_payer.selector, /ddlWhoIsPaying/);
});
