import assert from "node:assert/strict";
import { test } from "node:test";
import { ds160FamilySpouseMappings, ds160PassportMappings, ds160PersonalInfoMappings, ds160TravelMappings } from "../ds160-form-mappings";
import { CEAC_NAV_SELECTORS } from "../ceac/selectors";

test("travel payer aliases both target the current CEAC payer dropdown", () => {
  assert.match(ds160TravelMappings.who_is_paying.selector, /ddlWhoIsPaying/);
  assert.match(ds160TravelMappings.travel_payer.selector, /ddlWhoIsPaying/);
});

test("payer email Does Not Apply uses the observed CEAC checkbox", () => {
  assert.equal(
    ds160TravelMappings.payer_email_na.selector,
    'input[id="ctl00_SiteContentPlaceHolder_FormView1_cbxDNAPAYER_EMAIL_ADDR_NA"]',
  );
  assert.equal(ds160TravelMappings.payer_email_na.type, "checkbox");
});

test("passport no-expiration checkbox uses the inverse CEAC-derived field", () => {
  assert.equal(ds160PassportMappings.passport_has_expiry, undefined);
  assert.match(ds160PassportMappings.passport_expiry_na.selector, /cbxPPT_EXPIRE_NA/);
});

test("birth province NA maps to the observed CEAC checkbox", () => {
  assert.equal(
    ds160PersonalInfoMappings.state_of_birth_na.selector,
    'input[id="ctl00_SiteContentPlaceHolder_FormView1_cbexAPP_POB_ST_PROVINCE_NA"]',
  );
  assert.equal(ds160PersonalInfoMappings.state_of_birth_na.type, "checkbox");
});

test("spouse city unknown maps to the observed CEAC checkbox", () => {
  assert.equal(
    ds160FamilySpouseMappings.spouse_city_of_birth_na.selector,
    'input[id="ctl00_SiteContentPlaceHolder_FormView1_cbexSPOUSE_POB_CITY_NA"]',
  );
  assert.equal(ds160FamilySpouseMappings.spouse_city_of_birth_na.type, "checkbox");
});

test("CEAC next selector excludes the passport page-complete modal button", () => {
  assert.doesNotMatch(CEAC_NAV_SELECTORS.next, /input\[type="submit"\]\.next,/);
  assert.match(CEAC_NAV_SELECTORS.next, /:not\(\[id\*="Complete"\]\)/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /btnNextPageComplete/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /Save and Continue/);
});
