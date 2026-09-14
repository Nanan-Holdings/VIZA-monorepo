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

  it("maps unknown U.S. contact name and email tokens to CEAC NA checkboxes", () => {
    const answers = deriveDS160Answers({
      us_contact_surname: "DO_NOT_KNOW",
      us_contact_given_names: "DO_NOT_KNOW",
      us_contact_organization: "DO_NOT_KNOW",
      us_contact_email: "DOES_NOT_APPLY",
    });

    assert.equal(answers.us_contact_name_na, "Y");
    assert.equal(answers.us_contact_email_na, "Y");
    assert.equal(answers.us_contact_organization, undefined);
    assert.equal(answers.us_contact_organization_na, "Y");
    assert.equal(answers.us_contact_surname, undefined);
    assert.equal(answers.us_contact_given_names, undefined);
    assert.equal(answers.us_contact_email, undefined);
  });

  it("does not infer NA for a blank U.S. tax identifier", () => {
    const answers = deriveDS160Answers({ us_taxpayer_id: "" });

    assert.equal(answers.us_taxpayer_id_na, undefined);
    assert.equal(answers.us_taxpayer_id, "");
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

  it("maps present work fields to CEAC keys and splits the supplied start date", () => {
    const answers = deriveDS160Answers({
      primary_occupation: "student",
      employer_name: "NUS",
      employer_city: "Singapore",
      employer_state_province: "Central Region",
      employer_postal_code: "117566",
      employer_country: "Singapore",
      employer_phone: "+65 6516 6666",
      employment_start_date: "2021-03-15",
      monthly_salary: "SGD 1800",
      job_duties: "Full-time student",
    });

    assert.equal(answers.employer_address_city, "Singapore");
    assert.equal(answers.employer_address_state, "Central Region");
    assert.equal(answers.employer_address_postal, "117566");
    assert.equal(answers.employer_address_country, "SING");
    assert.equal(answers.employment_start_date_day, "15");
    assert.equal(answers.employment_start_date_month, "MAR");
    assert.equal(answers.employment_start_date_year, "2021");
    assert.equal(answers.monthly_income, "SGD 1800");
    assert.equal(answers.employer_address_state_na, undefined);
    assert.equal(answers.employer_address_postal_na, undefined);
    assert.equal(answers.monthly_income_na, undefined);
  });

  it("does not invent missing present work values or override an education answer", () => {
    const workAnswers = deriveDS160Answers({ primary_occupation: "student" });
    assert.equal(workAnswers.employer_name, undefined);
    assert.equal(workAnswers.employer_address_line1, undefined);
    assert.equal(workAnswers.employer_address_city, undefined);
    assert.equal(workAnswers.employer_address_country, undefined);
    assert.equal(workAnswers.employer_phone, undefined);
    assert.equal(workAnswers.employment_start_date_day, undefined);
    assert.equal(workAnswers.employment_start_date_month, undefined);
    assert.equal(workAnswers.employment_start_date_year, undefined);
    assert.equal(workAnswers.monthly_income, undefined);
    assert.equal(workAnswers.job_duties, undefined);

    const educationAnswers = deriveDS160Answers({ has_other_education: "yes" });
    assert.equal(educationAnswers.has_other_education, "Y");
  });

  it("maps explicit work-field Does Not Apply values to CEAC checkboxes", () => {
    const answers = deriveDS160Answers({
      employer_state_province: "does_not_apply",
      employer_postal_code: "does_not_apply",
      monthly_salary: "does_not_apply",
    });

    assert.equal(answers.employer_address_state_na, "Y");
    assert.equal(answers.employer_address_postal_na, "Y");
    assert.equal(answers.monthly_income_na, "Y");
    assert.equal(answers.employer_state_province, undefined);
    assert.equal(answers.employer_address_state, undefined);
    assert.equal(answers.employer_postal_code, undefined);
    assert.equal(answers.employer_address_postal, undefined);
    assert.equal(answers.monthly_salary, undefined);
    assert.equal(answers.monthly_income, undefined);
  });

  it("does not infer unanswered social media as no", () => {
    const answers = deriveDS160Answers({});

    assert.equal(answers.has_social_media, undefined);
    assert.equal(answers.social_media_provider, undefined);
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

  it("does not reuse an inactive travel branch when the active source is missing", () => {
    const noPlans = deriveDS160Answers({
      has_specific_travel_plans: "no",
      arrival_date: "2026-09-10",
    });
    assert.equal(noPlans.intended_arrival_date, undefined);
    assert.equal(noPlans.intended_arrival_date_day, undefined);

    const specificPlans = deriveDS160Answers({
      has_specific_travel_plans: "yes",
      intended_arrival_date: "2026-10-20",
      intended_length_of_stay: "99",
      intended_length_of_stay_value: "99",
      intended_length_of_stay_unit: "DAY(S)",
    });
    assert.equal(specificPlans.intended_arrival_date, undefined);
    assert.equal(specificPlans.intended_arrival_date_day, undefined);
    assert.equal(specificPlans.intended_length_of_stay, undefined);
    assert.equal(specificPlans.intended_length_of_stay_value, undefined);
    assert.equal(specificPlans.intended_length_of_stay_unit, undefined);
  });

  it("derives length of stay only from real dates in the specific-plans branch", () => {
    const noPlans = deriveDS160Answers({
      has_specific_travel_plans: "no",
      arrival_date: "2026-09-10",
      departure_date: "2026-09-20",
      intended_length_of_stay_value: "14",
      intended_length_of_stay_unit: "DAY(S)",
    });
    assert.equal(noPlans.intended_length_of_stay_value, "14");
    assert.equal(noPlans.intended_length_of_stay_unit, "D");

    const specificPlans = deriveDS160Answers({
      has_specific_travel_plans: "yes",
      arrival_date: "2026-09-10",
      departure_date: "2026-09-20",
      intended_length_of_stay: "99",
      intended_length_of_stay_value: "99",
      intended_length_of_stay_unit: "MONTH(S)",
    });
    assert.equal(specificPlans.intended_length_of_stay, "10");
    assert.equal(specificPlans.intended_length_of_stay_value, "10");
    assert.equal(specificPlans.intended_length_of_stay_unit, "D");
  });

  it("does not turn an impossible date range into a one-day stay", () => {
    const answers = deriveDS160Answers({
      has_specific_travel_plans: "yes",
      arrival_date: "2026-09-20",
      departure_date: "2026-09-10",
    });

    assert.equal(answers.intended_length_of_stay, undefined);
    assert.equal(answers.intended_length_of_stay_value, undefined);
    assert.equal(answers.intended_length_of_stay_unit, undefined);
  });

  it("does not alias U.S. contact address into the separate travel address", () => {
    const answers = deriveDS160Answers({
      us_contact_address_street1: "Contact street",
      us_contact_city: "Contact city",
      us_contact_state: "CA",
      us_contact_zip: "90001",
    });

    assert.equal(answers.us_address_street, undefined);
    assert.equal(answers.us_address_city, undefined);
    assert.equal(answers.us_address_state, undefined);
    assert.equal(answers.us_address_zip, undefined);
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
