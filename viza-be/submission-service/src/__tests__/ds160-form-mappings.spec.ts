import assert from "node:assert/strict";
import { test } from "node:test";
import { ds160FamilySpouseMappings, ds160PassportMappings, ds160PersonalInfoMappings, ds160TravelMappings } from "../ds160-form-mappings";
import { deriveDS160Answers } from "../ds160-derive-answers";
import { CEAC_NAV_SELECTORS } from "../ceac/selectors";

test("travel payer aliases both target the current CEAC payer dropdown", () => {
  assert.match(ds160TravelMappings.who_is_paying.selector, /ddlWhoIsPaying/);
  assert.match(ds160TravelMappings.travel_payer.selector, /ddlWhoIsPaying/);
});

test("derived departure date components map to the captured CEAC travel controls", () => {
  const answers = deriveDS160Answers({
    has_specific_travel_plans: "Y",
    arrival_date: "2027-04-06",
    intended_arrival_date: "2028-07-08",
    departure_date: "2027-05-09",
  });

  assert.equal(answers.intended_arrival_date, "2027-04-06");
  assert.equal(answers.intended_arrival_date_day, "06");
  assert.equal(answers.intended_arrival_date_month, "APR");
  assert.equal(answers.intended_arrival_date_year, "2027");
  assert.equal(answers.departure_date_day, "09");
  assert.equal(answers.departure_date_month, "MAY");
  assert.equal(answers.departure_date_year, "2027");

  assert.equal(ds160TravelMappings.intended_arrival_date_day.selector, 'select[id*="ddlTRAVEL_DTEDay"]');
  assert.equal(ds160TravelMappings.intended_arrival_date_month.selector, 'select[id*="ddlTRAVEL_DTEMonth"]');
  assert.equal(ds160TravelMappings.intended_arrival_date_year.selector, 'input[id*="tbxTRAVEL_DTEYear"]');
  assert.equal(
    ds160TravelMappings.departure_date_day.selector,
    'select[id="ctl00_SiteContentPlaceHolder_FormView1_ddlDEPARTURE_US_DTEDay"]',
  );
  assert.equal(
    ds160TravelMappings.departure_date_month.selector,
    'select[id="ctl00_SiteContentPlaceHolder_FormView1_ddlDEPARTURE_US_DTEMonth"]',
  );
  assert.equal(
    ds160TravelMappings.departure_date_year.selector,
    'input[id="ctl00_SiteContentPlaceHolder_FormView1_tbxDEPARTURE_US_DTEYear"]',
  );
  assert.equal(ds160TravelMappings.departure_date_day.type, "select");
  assert.equal(ds160TravelMappings.departure_date_month.type, "select");
  assert.equal(ds160TravelMappings.departure_date_year.type, "text");
});

test("payer email Does Not Apply uses the observed CEAC checkbox", () => {
  assert.equal(
    ds160TravelMappings.payer_email_na.selector,
    'input[id="ctl00_SiteContentPlaceHolder_FormView1_cbxDNAPAYER_EMAIL_ADDR_NA"]',
  );
  assert.equal(ds160TravelMappings.payer_email_na.type, "checkbox");
});

test("payer fields use the observed live CEAC controls", () => {
  assert.equal(ds160TravelMappings.payer_surname.selector, 'input[id*="tbxPayerSurname"]');
  assert.equal(ds160TravelMappings.payer_given_names.selector, 'input[id*="tbxPayerGivenName"]');
  assert.equal(ds160TravelMappings.payer_phone.selector, 'input[id*="tbxPayerPhone"]');
  assert.equal(ds160TravelMappings.payer_email.selector, 'input[id*="tbxPAYER_EMAIL_ADDR"]');
  assert.equal(ds160TravelMappings.payer_relationship.selector, 'select[id*="ddlPayerRelationship"]');
  assert.equal(ds160TravelMappings.payer_phone.type, "text");
  assert.equal(ds160TravelMappings.payer_relationship.type, "select");
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

test("spouse identity and nationality use the spouse-page shared controls", () => {
  assert.equal(ds160FamilySpouseMappings.spouse_surname.selector, 'input[id*="tbxSpouseSurname"]');
  assert.equal(ds160FamilySpouseMappings.spouse_given_names.selector, 'input[id*="tbxSpouseGivenName"]');
  assert.equal(ds160FamilySpouseMappings.spouse_nationality.selector, 'select[id*="ddlSpouseNatDropDownList"]');
  assert.equal(ds160FamilySpouseMappings.spouse_city_of_birth.selector, 'input[id*="tbxSpousePOBCity"]');
  assert.equal(ds160FamilySpouseMappings.spouse_nationality.type, "select");
});

test("spouse birthday maps to the shared CEAC date controls", () => {
  assert.equal(ds160FamilySpouseMappings.spouse_date_of_birth, undefined);
  assert.equal(ds160FamilySpouseMappings.spouse_date_of_birth_day.selector, 'select[id*="ddlDOBDay"]');
  assert.equal(ds160FamilySpouseMappings.spouse_date_of_birth_month.selector, 'select[id*="ddlDOBMonth"]');
  assert.equal(ds160FamilySpouseMappings.spouse_date_of_birth_year.selector, 'input[id*="tbxDOBYear"]');
  assert.equal(ds160FamilySpouseMappings.spouse_date_of_birth_day.type, "select");
  assert.equal(ds160FamilySpouseMappings.spouse_date_of_birth_month.type, "select");
  assert.equal(ds160FamilySpouseMappings.spouse_date_of_birth_year.type, "text");
});

test("CEAC next selector excludes the passport page-complete modal button", () => {
  assert.doesNotMatch(CEAC_NAV_SELECTORS.next, /input\[type="submit"\]\.next,/);
  assert.match(CEAC_NAV_SELECTORS.next, /:not\(\[id\*="Complete"\]\)/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /btnNextPageComplete/);
  assert.match(CEAC_NAV_SELECTORS.continueAfterPageComplete, /Save and Continue/);
});
