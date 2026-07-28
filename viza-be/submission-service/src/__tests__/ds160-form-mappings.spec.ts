import assert from "node:assert/strict";
import { test } from "node:test";
import { ds160PassportMappings, ds160TravelMappings } from "../ds160-form-mappings";

test("travel payer aliases both target the current CEAC payer dropdown", () => {
  assert.match(ds160TravelMappings.who_is_paying.selector, /ddlWhoIsPaying/);
  assert.match(ds160TravelMappings.travel_payer.selector, /ddlWhoIsPaying/);
});

test("passport no-expiration checkbox uses the inverse CEAC-derived field", () => {
  assert.equal(ds160PassportMappings.passport_has_expiry, undefined);
  assert.match(ds160PassportMappings.passport_expiry_na.selector, /cbxPPT_EXPIRE_NA/);
});
