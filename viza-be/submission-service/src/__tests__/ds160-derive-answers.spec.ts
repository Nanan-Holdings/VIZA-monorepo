import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveDS160Answers } from "../ds160-derive-answers";

describe("deriveDS160Answers", () => {
  it("maps a no-social-media answer to the CEAC NONE provider option", () => {
    const answers = deriveDS160Answers({ has_social_media: "N" });

    assert.equal(answers.social_media_provider, "NONE");
    assert.equal(answers.has_social_media, "N");
    assert.equal(answers.social_media_identifier, undefined);
  });

  it("preserves every contact repeat row while keeping legacy first-row keys", () => {
    const answers = deriveDS160Answers({
      "additional_phones[]": JSON.stringify(["+86 111", "+65 222"]),
      "additional_emails[]": JSON.stringify(["one@example.com", "two@example.com"]),
      "social_media[]": JSON.stringify([
        { platform: "INSTAGRAM", handle: "first" },
        { platform: "REDDIT", handle: "second" },
      ]),
      "other_social_media[]": JSON.stringify([
        { platform: "WeChat", handle: "wx-one" },
        { platform: "TikTok", handle: "tt-two" },
      ]),
    });

    assert.equal(answers.additional_phone, "+86 111");
    assert.equal(answers.additional_phone__2, "+65 222");
    assert.equal(answers.additional_email, "one@example.com");
    assert.equal(answers.additional_email__2, "two@example.com");
    assert.equal(answers.social_media_provider, "INSTAGRAM");
    assert.equal(answers.social_media_platform__2, "REDDIT");
    assert.equal(answers.social_media_handle__2, "second");
    assert.equal(answers.other_social_media_name__2, "TikTok");
    assert.equal(answers.other_social_media_identifier__2, "tt-two");
    assert.equal(answers.has_other_phone, "Y");
    assert.equal(answers.has_other_email, "Y");
    assert.equal(answers.has_other_social_media, "Y");
  });

  it("upgrades legacy repeat rows into canonical arrays without losing order", () => {
    const answers = deriveDS160Answers({
      has_other_phones: "yes",
      additional_phone: "+86 111",
      additional_phone__2: "+65 222",
      has_other_emails: "yes",
      additional_email: "one@example.com",
      additional_email__2: "two@example.com",
      has_social_media: "yes",
      social_media_platform: "INSTAGRAM",
      social_media_handle: "first",
      social_media_platform__2: "REDDIT",
      social_media_handle__2: "second",
    });

    assert.deepEqual(JSON.parse(answers["additional_phones[]"]), ["+86 111", "+65 222"]);
    assert.deepEqual(JSON.parse(answers["additional_emails[]"]), ["one@example.com", "two@example.com"]);
    assert.deepEqual(JSON.parse(answers["social_media[]"]), [
      { platform: "INSTAGRAM", handle: "first" },
      { platform: "REDDIT", handle: "second" },
    ]);
  });

  it("removes stale repeat rows when arrays shrink or a conditional branch closes", () => {
    const shrunk = deriveDS160Answers({
      has_other_phones: "yes",
      "additional_phones[]": JSON.stringify(["+86 111"]),
      additional_phone: "+86 111",
      additional_phone__2: "+65 222",
    });
    assert.equal(shrunk.additional_phone, "+86 111");
    assert.equal(shrunk.additional_phone__2, undefined);

    const closed = deriveDS160Answers({
      mailing_same_as_home: "yes",
      mailing_address_line1: "STALE",
      mailing_address_state: "STALE",
      has_other_phones: "no",
      "additional_phones[]": JSON.stringify(["+86 111"]),
      additional_phone: "+86 111",
      has_other_emails: "no",
      additional_email: "stale@example.com",
      has_social_media: "no",
      social_media_platform: "INSTAGRAM",
      social_media_handle: "stale",
      has_other_social_media: "no",
      other_social_media_name: "WeChat",
      other_social_media_identifier: "stale",
    });

    assert.equal(closed.mailing_address_line1, undefined);
    assert.equal(closed.mailing_address_state, undefined);
    assert.equal(closed.additional_phone, undefined);
    assert.equal(closed["additional_phones[]"], "[]");
    assert.equal(closed.additional_email, undefined);
    assert.equal(closed["additional_emails[]"], "[]");
    assert.equal(closed.social_media_provider, "NONE");
    assert.equal(closed.social_media_identifier, undefined);
    assert.equal(closed.other_social_media_name, undefined);
    assert.equal(closed["other_social_media[]"], "[]");
  });

  it("aliases legacy mobile phone answers and lets explicit NA clear stale text", () => {
    const legacy = deriveDS160Answers({ mobile_phone: "+86 123" });
    assert.equal(legacy.secondary_phone, "+86 123");
    assert.equal(legacy.secondary_phone_na, undefined);

    const stale = deriveDS160Answers({
      secondary_phone: "+86 123",
      secondary_phone_na: "yes",
      work_phone: "+86 456",
      work_phone_na: "Y",
    });
    assert.equal(stale.secondary_phone, undefined);
    assert.equal(stale.work_phone, undefined);
    assert.equal(stale.secondary_phone_na, "Y");
    assert.equal(stale.work_phone_na, "Y");
  });

  it("transliterates known Chinese city names for CEAC city text fields", () => {
    const answers = deriveDS160Answers({ home_address_city: "长沙" });

    assert.equal(answers.home_address_city, "CHANGSHA");
  });

  it("removes non-fillable NA tokens from optional CEAC text fields", () => {
    const answers = deriveDS160Answers({
      passport_issuance_state: "DOES_NOT_APPLY",
      home_address_state: "DOES_NOT_APPLY",
      home_address_postal: "DOES_NOT_APPLY",
    });

    assert.equal(answers.passport_issuance_state, undefined);
    assert.equal(answers.home_address_state_na, "Y");
    assert.equal(answers.home_address_postal_na, "Y");
    assert.equal(answers.home_address_state, undefined);
    assert.equal(answers.home_address_postal, undefined);
  });

  it("maps inapplicable birth-state and passport-book answers to CEAC NA checkboxes", () => {
    const answers = deriveDS160Answers({
      state_of_birth: "does_not_apply",
      passport_book_number: "does_not_apply",
    });

    assert.equal(answers.state_of_birth, undefined);
    assert.equal(answers.state_of_birth_na, "Y");
    assert.equal(answers.passport_book_number, undefined);
    assert.equal(answers.passport_book_number_na, "Y");
  });

  it("maps unknown U.S. contact name and email tokens to CEAC NA checkboxes", () => {
    const answers = deriveDS160Answers({
      us_contact_surname: "DO_NOT_KNOW",
      us_contact_given_names: "DO_NOT_KNOW",
      us_contact_organization: "DO_NOT_KNOW",
      us_contact_email: "DOES_NOT_APPLY",
    });

    assert.equal(answers.us_contact_name_na, "Y");
    assert.equal(answers.us_contact_email_na, "Y");
    assert.equal(answers.us_contact_organization, "UNKNOWN");
    assert.equal(answers.us_contact_organization_na, undefined);
    assert.equal(answers.us_contact_surname, undefined);
    assert.equal(answers.us_contact_given_names, undefined);
    assert.equal(answers.us_contact_email, undefined);
  });

  it("defaults blank U.S. tax identifiers to CEAC NA checkboxes", () => {
    const answers = deriveDS160Answers({ us_taxpayer_id: "" });

    assert.equal(answers.us_taxpayer_id_na, "Y");
    assert.equal(answers.us_taxpayer_id, undefined);
  });

  it("normalizes parent-in-US yes/no answers to CEAC radio values", () => {
    const answers = deriveDS160Answers({
      father_in_us: "no",
      mother_in_us: "yes",
    });

    assert.equal(answers.father_in_us, "N");
    assert.equal(answers.mother_in_us, "Y");
  });

  it("normalizes canonical portal choice values for CEAC controls", () => {
    const answers = deriveDS160Answers({
      sex: "male",
      marital_status: "single",
      other_names_used: "no",
      has_specific_plans: "no",
      trip_payer_type: "self",
      lost_passport: "no",
      has_attended_education: "no",
      has_traveled_last_five_years: "no",
      has_belonged_to_organization: "no",
      has_served_paramilitary: "no",
      purpose_of_trip_specify: "B1/B2",
      intended_length_of_stay_unit: "DAY(S)",
    });

    assert.equal(answers.sex, "M");
    assert.equal(answers.marital_status, "S");
    assert.equal(answers.has_other_names, "N");
    assert.equal(answers.has_specific_travel_plans, "N");
    assert.equal(answers.trip_payer_type, "self");
    assert.equal(answers.who_is_paying, "S");
    assert.equal(answers.travel_payer, "S");
    assert.equal(answers.passport_lost_or_stolen, "N");
    assert.equal(answers.has_other_education, "N");
    assert.equal(answers.has_countries_visited, "N");
    assert.equal(answers.has_organization, "N");
    assert.equal(answers.has_served_insurgent, "N");
    assert.equal(answers.purpose_of_trip_specify, "B1-B2");
    assert.equal(answers.intended_length_of_stay_unit, "D");
  });

  it("does not fabricate present education answers when required intake is missing", () => {
    const answers = deriveDS160Answers({
      primary_occupation: "education",
      employer_name: "DOES_NOT_APPLY",
      home_address_line1: "Beijing",
      home_address_city: "长沙",
      home_address_country: "China",
      primary_phone: "19974931995",
    });

    assert.equal(answers.employer_name, "DOES_NOT_APPLY");
    assert.equal(answers.employer_address_line1, undefined);
    assert.equal(answers.employer_address_city, undefined);
    assert.equal(answers.employer_address_country, undefined);
    assert.equal(answers.employer_phone, undefined);
    assert.equal(answers.employment_start_date_day, undefined);
    assert.equal(answers.employment_start_date_month, undefined);
    assert.equal(answers.employment_start_date_year, undefined);
    assert.equal(answers.monthly_income_na, undefined);
    assert.equal(answers.job_duties, undefined);
  });

  it("aliases intake work and income fields without overwriting canonical answers", () => {
    const answers = deriveDS160Answers({
      employer_city: "长沙",
      employer_state_province: "Hunan",
      employer_postal_code: "410000",
      employer_country: "China",
      monthly_salary: "30000",
      employer_address_city: "SHANGHAI",
      monthly_income: "45000",
    });

    assert.equal(answers.employer_address_city, "SHANGHAI");
    assert.equal(answers.employer_address_state, "Hunan");
    assert.equal(answers.employer_address_postal, "410000");
    assert.equal(answers.employer_address_country, "CHIN");
    assert.equal(answers.monthly_income, "45000");
  });

  it("maps explicit work NA tokens but leaves ordinary missing values unresolved", () => {
    const explicitNa = deriveDS160Answers({
      employer_state_province: "DOES_NOT_APPLY",
      employer_postal_code: "DOES_NOT_APPLY",
      monthly_salary: "DOES_NOT_APPLY",
    });

    assert.equal(explicitNa.employer_address_state, undefined);
    assert.equal(explicitNa.employer_address_state_na, "Y");
    assert.equal(explicitNa.employer_address_postal, undefined);
    assert.equal(explicitNa.employer_address_postal_na, "Y");
    assert.equal(explicitNa.monthly_income, undefined);
    assert.equal(explicitNa.monthly_income_na, "Y");

    const missing = deriveDS160Answers({ primary_occupation: "BUSINESS" });
    assert.equal(missing.employer_address_state_na, undefined);
    assert.equal(missing.employer_address_postal_na, undefined);
    assert.equal(missing.monthly_income_na, undefined);
  });

  it("splits the persisted employment start date without replacing explicit parts", () => {
    const answers = deriveDS160Answers({
      employment_start_date: "2015-06-19",
      employment_start_date_day: "20",
    });

    assert.equal(answers.employment_start_date_day, "20");
    assert.equal(answers.employment_start_date_month, "JUN");
    assert.equal(answers.employment_start_date_year, "2015");
  });

  it("does not open previous education details when no institution data exists", () => {
    const answers = deriveDS160Answers({ has_other_education: "yes" });

    assert.equal(answers.has_other_education, "N");
  });

  it("uses the intended date for the no-specific-plans CEAC branch", () => {
    const answers = deriveDS160Answers({
      has_specific_travel_plans: "no",
      arrival_date: "2026-09-10",
      intended_arrival_date: "2026-10-20",
      intended_arrival_date_day: "10",
      intended_arrival_date_month: "SEP",
      intended_arrival_date_year: "2026",
    });

    assert.equal(answers.has_specific_travel_plans, "N");
    assert.equal(answers.intended_arrival_date, "2026-10-20");
    assert.equal(answers.intended_arrival_date_day, "20");
    assert.equal(answers.intended_arrival_date_month, "OCT");
    assert.equal(answers.intended_arrival_date_year, "2026");
  });

  it("uses the booked arrival date for the specific-plans CEAC branch", () => {
    const answers = deriveDS160Answers({
      has_specific_travel_plans: "yes",
      arrival_date: "2026-09-10",
      intended_arrival_date: "2026-10-20",
    });

    assert.equal(answers.has_specific_travel_plans, "Y");
    assert.equal(answers.intended_arrival_date, "2026-09-10");
    assert.equal(answers.intended_arrival_date_day, "10");
    assert.equal(answers.intended_arrival_date_month, "SEP");
    assert.equal(answers.intended_arrival_date_year, "2026");
    assert.equal(answers.arrival_date_month, "SEP");
  });

  it("derives CEAC passport expiration state from the persisted date", () => {
    const answers = deriveDS160Answers({
      passport_has_expiry: "no",
      passport_expiration_date: "2034-08-19",
    });

    assert.equal(answers.passport_has_expiry, "Y");
    assert.equal(answers.passport_expiry_na, "N");
    assert.equal(answers.passport_expiry_day, "19");
    assert.equal(answers.passport_expiry_month, "08");
    assert.equal(answers.passport_expiry_year, "2034");
  });

  it("checks CEAC no-expiration only when no date exists", () => {
    const answers = deriveDS160Answers({
      passport_has_expiry: "no",
      passport_expiry_day: "19",
      passport_expiry_month: "08",
      passport_expiry_year: "2034",
    });

    assert.equal(answers.passport_expiry_na, "Y");
    assert.equal(answers.passport_expiry_day, undefined);
    assert.equal(answers.passport_expiry_month, undefined);
    assert.equal(answers.passport_expiry_year, undefined);
  });
});
