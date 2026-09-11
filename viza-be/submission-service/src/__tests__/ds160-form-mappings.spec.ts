import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ds160PassportMappings,
  ds160PersonalInfoMappings,
  ds160ContactMappings,
  ds160TravelMappings,
  ds160UsContactMappings,
} from "../ds160-form-mappings";
import { CEAC_NAV_SELECTORS } from "../ceac/selectors";

test("travel payer aliases both target the current CEAC payer dropdown", () => {
  assert.match(ds160TravelMappings.who_is_paying.selector, /ddlWhoIsPaying/);
  assert.match(ds160TravelMappings.travel_payer.selector, /ddlWhoIsPaying/);
});

test("passport no-expiration checkbox uses the inverse CEAC-derived field", () => {
  assert.equal(ds160PassportMappings.passport_has_expiry, undefined);
  assert.match(ds160PassportMappings.passport_expiry_na.selector, /cbxPPT_EXPIRE_NA/);
});

test("Personal1 birth-state NA uses the live CEAC checkbox id", () => {
  assert.equal(ds160PersonalInfoMappings.state_of_birth_na.type, "checkbox");
  assert.match(ds160PersonalInfoMappings.state_of_birth_na.selector, /cbexAPP_POB_ST_PROVINCE_NA/);
});

test("passport-book and U.S. contact NA keys target CEAC checkboxes", () => {
  assert.equal(ds160PassportMappings.passport_book_number_na.type, "checkbox");
  assert.match(ds160PassportMappings.passport_book_number_na.selector, /PPT_BOOK_NUM_NA/);
  assert.equal(ds160UsContactMappings.us_contact_name_na.type, "checkbox");
  assert.match(ds160UsContactMappings.us_contact_name_na.selector, /US_POC_NAME_NA/);
});

test("AddressPhone uses the canonical Secondary Phone keys", () => {
  assert.equal(ds160ContactMappings.mobile_phone, undefined);
  assert.equal(ds160ContactMappings.mobile_phone_na, undefined);
  assert.match(ds160ContactMappings.secondary_phone.selector, /tbxAPP_MOBILE_TEL/);
  assert.match(ds160ContactMappings.secondary_phone_na.selector, /cbexAPP_MOBILE_TEL_NA/);
});

test("AddressPhone maps the other-social question without conflating the provider dropdown", () => {
  assert.equal(ds160ContactMappings.has_social_media, undefined);
  assert.match(ds160ContactMappings.has_other_social_media.selector, /rblAddSocial/);
  assert.match(ds160ContactMappings.social_media_provider.selector, /ddlSocialMedia/);
});

test("CEAC next selector excludes the passport page-complete modal button", () => {
  assert.doesNotMatch(CEAC_NAV_SELECTORS.next, /input\[type="submit"\]\.next,/);
  assert.match(CEAC_NAV_SELECTORS.next, /:not\(\[id\*="Complete"\]\)/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /btnNextPageComplete/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /Save and Continue/);
});
