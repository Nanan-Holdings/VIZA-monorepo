import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ds160PassportMappings,
  ds160PersonalInfoMappings,
  ds160PersonalInfo2Mappings,
  ds160ContactMappings,
  ds160TravelMappings,
  ds160UsContactMappings,
  ds160WorkAdditionalMappings,
  ds160SecurityBackground1Mappings,
  ds160SecurityBackground2Mappings,
  ds160SecurityBackground3Mappings,
  ds160SecurityBackground4Mappings,
  ds160SecurityBackground5Mappings,
} from "../ds160-form-mappings";
import { DS160_SECURITY_BACKGROUND_KEYS } from "../ceac/security-background";
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

test("Personal2 uses the live nationality select and SSN NA checkbox ids", () => {
  assert.equal(ds160PersonalInfo2Mappings.nationality_country.type, "select");
  assert.match(ds160PersonalInfo2Mappings.nationality_country.selector, /ddlAPP_NATL/);
  assert.equal(ds160PersonalInfo2Mappings.us_social_security_number_na.type, "checkbox");
  assert.match(ds160PersonalInfo2Mappings.us_social_security_number_na.selector, /cbexAPP_SSN_NA/);
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

test("AddressPhone maps both verified CEAC social-media groups", () => {
  assert.equal(ds160ContactMappings.has_social_media, undefined);
  assert.match(ds160ContactMappings.social_media_provider.selector, /ddlSocialMedia/);
  assert.match(ds160ContactMappings.social_media_identifier.selector, /tbxSocialMediaIdent/);
  assert.match(ds160ContactMappings.has_other_social_media.selector, /rblAddSocial/);
  assert.match(ds160ContactMappings.other_social_media_platform.selector, /AddSocial/);
  assert.match(ds160ContactMappings.other_social_media_handle.selector, /AddSocial/);
});

test("Work/Education Additional maps every Yes-branch detail", () => {
  for (const key of [
    "clan_tribe_name",
    "language_name",
    "traveled_country",
    "organization_name",
    "specialized_skills_explain",
    "military_country",
    "military_branch",
    "military_rank",
    "military_specialty",
    "military_date_from",
    "military_date_to",
    "paramilitary_explain",
  ]) {
    assert.ok(ds160WorkAdditionalMappings[key], `missing Additional mapping for ${key}`);
  }
  assert.match(ds160WorkAdditionalMappings.language_name.selector, /dtlLANGUAGES/);
  assert.match(ds160WorkAdditionalMappings.military_country.selector, /MILITARY_SVC_CNTRY/);
  assert.match(ds160WorkAdditionalMappings.paramilitary_explain.selector, /INSURGENT_ORG_EXPL/);
});

test("every Security gate has a conditional explanation selector", () => {
  const allMappings = {
    ...ds160SecurityBackground1Mappings,
    ...ds160SecurityBackground2Mappings,
    ...ds160SecurityBackground3Mappings,
    ...ds160SecurityBackground4Mappings,
    ...ds160SecurityBackground5Mappings,
  };
  for (const key of DS160_SECURITY_BACKGROUND_KEYS) {
    assert.equal(allMappings[key]?.type, "radio", `missing Security gate mapping for ${key}`);
    assert.equal(allMappings[`${key}_explain`]?.type, "text", `missing Security explanation mapping for ${key}`);
    assert.match(allMappings[`${key}_explain`].selector, /tbx|_EXPL/);
  }
});

test("Security Part 4 maps only the controls present on current CEAC", () => {
  for (const [key, selectorFragment] of [
    ["has_immigration_fraud", "ImmigrationFraud"],
    ["has_removal_order", "Deport"],
  ] as const) {
    assert.equal(ds160SecurityBackground4Mappings[key]?.type, "radio");
    assert.match(ds160SecurityBackground4Mappings[key].selector, new RegExp(selectorFragment));
    assert.equal(ds160SecurityBackground4Mappings[`${key}_explain`]?.type, "text");
  }
  assert.equal(ds160SecurityBackground4Mappings.has_removal_deportation_hearing, undefined);
  assert.equal(ds160SecurityBackground4Mappings.has_failed_removal_hearing, undefined);
  assert.equal(ds160SecurityBackground4Mappings.has_overstayed, undefined);
  assert.equal(ds160SecurityBackground4Mappings.has_been_detained, undefined);
  assert.equal(ds160SecurityBackground4Mappings.practicing_polygamy, undefined);
});

test("CEAC next selector excludes the passport page-complete modal button", () => {
  assert.doesNotMatch(CEAC_NAV_SELECTORS.next, /input\[type="submit"\]\.next,/);
  assert.match(CEAC_NAV_SELECTORS.next, /:not\(\[id\*="Complete"\]\)/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /btnNextPageComplete/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /Save and Continue/);
});
