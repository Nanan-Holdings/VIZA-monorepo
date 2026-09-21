import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDs160AnswerMap, deriveDS160Answers, findInvalidDs160DateAnswers } from "../ds160-derive-answers";

describe("deriveDS160Answers", () => {
  it("preserves an explicit empty answer over stale profile or English aliases", () => {
    const answers = buildDs160AnswerMap([
      { field_name: "given_names", value_text: "", value_json: null },
      { field_name: "given_names_en", value_text: "STALE GIVEN NAMES", value_json: null },
      { field_name: "surname", value_text: "STALE SURNAME", value_json: "" },
    ]);

    assert.ok(Object.prototype.hasOwnProperty.call(answers, "given_names"));
    assert.equal(answers.given_names, "");
    assert.equal(answers.surname, "");

    const derived = deriveDS160Answers({ ...answers });
    assert.equal(derived.given_names, "");
    assert.equal(derived.surname, "");
  });

  it("clears stale mechanical alias targets while preserving non-empty target compatibility", () => {
    const cleared = {
      home_address_state_province: "",
      home_address_state: "OLD STATE",
    };

    deriveDS160Answers(cleared);
    assert.equal(cleared.home_address_state, "");
    deriveDS160Answers(cleared);
    assert.equal(cleared.home_address_state, "");

    const compatible = {
      home_address_state_province: "NEW STATE",
      home_address_state: "EXISTING TARGET",
    };
    deriveDS160Answers(compatible);
    assert.equal(compatible.home_address_state, "EXISTING TARGET");
  });

  it("preserves a native-script name even when a translated alias is saved", () => {
    const answers = deriveDS160Answers({
      full_name_native_alphabet: "张三",
      full_name_native_alphabet_en: "ZHANG SAN",
      surname: "张",
      surname_en: "ZHANG",
    });

    assert.equal(answers.full_name_native_alphabet, "张三");
    assert.equal(answers.surname, "ZHANG");
  });

  it("does not fill a native-script name from an English-only alias", () => {
    const answers = deriveDS160Answers({ full_name_native_alphabet_en: "ZHANG SAN" });

    assert.equal(answers.full_name_native_alphabet, undefined);
  });

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

  it("normalizes ISO and localized country values to CEAC codes", () => {
    const answers = deriveDS160Answers({
      nationality_country: "BR",
      other_nationality_country: "BRAZIL",
      place_of_birth_country: "中国",
      employer_address_country: "IN",
    });

    assert.equal(answers.nationality_country, "BRZL");
    assert.equal(answers.other_nationality_country, "BRZL");
    assert.equal(answers.place_of_birth_country, "CHIN");
    assert.equal(answers.employer_address_country, "IND");
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

  it("maps birth province Does Not Apply to the CEAC checkbox", () => {
    const answers = deriveDS160Answers({
      state_of_birth: "DOES_NOT_APPLY",
    });

    assert.equal(answers.state_of_birth_na, "Y");
    assert.equal(answers.state_of_birth, undefined);
  });

  it("maps live conditional NA/unknown branches, including repeat rows", () => {
    const answers = deriveDS160Answers({
      payer_email: "DOES_NOT_APPLY",
      passport_expiration_date: "DOES_NOT_APPLY",
      payer_address_state: "DOES_NOT_APPLY",
      payer_address_postal: "DOES_NOT_APPLY",
      payer_org_address_state: "DOES_NOT_APPLY",
      payer_org_address_postal: "DOES_NOT_APPLY",
      mailing_address_state: "DOES_NOT_APPLY",
      mailing_address_postal: "DOES_NOT_APPLY",
      secondary_phone: "DOES_NOT_APPLY",
      us_drivers_license_number: "DO_NOT_KNOW",
      us_drivers_license_number__2: "DO_NOT_KNOW",
      visa_number: "DO_NOT_KNOW",
      lost_passport_number: "DO_NOT_KNOW",
      lost_passport_number__2: "DO_NOT_KNOW",
    });

    for (const key of [
      "payer_email_na",
      "passport_expiry_na",
      "payer_address_state_na",
      "payer_address_postal_na",
      "payer_org_address_state_na",
      "payer_org_address_postal_na",
      "mailing_address_state_na",
      "mailing_address_postal_na",
      "secondary_phone_na",
      "us_drivers_license_number_unknown",
      "us_drivers_license_number_unknown__2",
      "visa_number_unknown",
      "lost_passport_number_unknown",
      "lost_passport_number_unknown__2",
    ]) {
      assert.equal(answers[key], "Y", `${key} should be checked`);
    }

    for (const key of [
      "payer_email",
      "passport_expiration_date",
      "payer_address_state",
      "payer_address_postal",
      "payer_org_address_state",
      "payer_org_address_postal",
      "mailing_address_state",
      "mailing_address_postal",
      "secondary_phone",
      "us_drivers_license_number",
      "us_drivers_license_number__2",
      "visa_number",
      "lost_passport_number",
      "lost_passport_number__2",
    ]) {
      assert.equal(answers[key], undefined, `${key} should not reach a text control`);
    }
  });

  it("maps spouse city and address Does Not Apply controls", () => {
    const answers = deriveDS160Answers({
      spouse_city_of_birth: "DO_NOT_KNOW",
      spouse_address_state: "DOES_NOT_APPLY",
      spouse_address_zip: "DOES_NOT_APPLY",
    });

    assert.equal(answers.spouse_city_of_birth_na, "Y");
    assert.equal(answers.spouse_address_state_na, "Y");
    assert.equal(answers.spouse_address_zip_na, "Y");
    assert.equal(answers.spouse_city_of_birth, undefined);
    assert.equal(answers.spouse_address_state, undefined);
    assert.equal(answers.spouse_address_zip, undefined);
  });

  it("maps partner and deceased/former spouse unknown controls per branch", () => {
    const answers = deriveDS160Answers({
      marital_status: "civil_union",
      partner_city_of_birth: "DO_NOT_KNOW",
      partner_address_state: "DOES_NOT_APPLY",
      partner_address_zip: "DOES_NOT_APPLY",
      deceased_spouse_city_of_birth: "DO_NOT_KNOW",
      former_spouse_city_of_birth__2: "DO_NOT_KNOW",
    });

    assert.equal(answers.partner_city_of_birth_na, "Y");
    assert.equal(answers.partner_address_state_na, "Y");
    assert.equal(answers.partner_address_zip_na, "Y");
    assert.equal(answers.deceased_spouse_city_of_birth_unknown, "Y");
    assert.equal(answers.former_spouse_city_of_birth_unknown__2, "Y");
    assert.equal(answers.partner_city_of_birth, undefined);
    assert.equal(answers.partner_address_state, undefined);
    assert.equal(answers.partner_address_zip, undefined);
    assert.equal(answers.deceased_spouse_city_of_birth, undefined);
    assert.equal(answers.former_spouse_city_of_birth__2, undefined);
  });

  it("maps previous-employer NA and supervisor unknown controls per repeat row", () => {
    const answers = deriveDS160Answers({
      prev_employer_state: "DOES_NOT_APPLY",
      prev_employer_state__2: "DOES_NOT_APPLY",
      prev_employer_postal: "DOES_NOT_APPLY",
      prev_supervisor_surname: "DO_NOT_KNOW",
      prev_supervisor_given_names__2: "DO_NOT_KNOW",
    });

    assert.equal(answers.prev_employer_state_na, "Y");
    assert.equal(answers.prev_employer_state_na__2, "Y");
    assert.equal(answers.prev_employer_postal_na, "Y");
    assert.equal(answers.prev_supervisor_surname_unknown, "Y");
    assert.equal(answers.prev_supervisor_given_names_unknown__2, "Y");
    assert.equal(answers.prev_employer_state, undefined);
    assert.equal(answers.prev_employer_state__2, undefined);
    assert.equal(answers.prev_employer_postal, undefined);
    assert.equal(answers.prev_supervisor_surname, undefined);
    assert.equal(answers.prev_supervisor_given_names__2, undefined);
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

  it("preserves official partial-date precision without inventing components", () => {
    const answers = deriveDS160Answers({
      intended_arrival_date: "2027-11",
      previous_visit_date_arrived: "2022",
      previous_visit_date_arrived__2: "2023-04",
      father_date_of_birth: "1960",
      mother_date_of_birth: "1965-06",
      employment_start_date: "2024",
      prev_employment_start_date: "2019",
      prev_employment_start_date__2: "2018",
      prev_employment_end_date: "2020",
      education_start_date: "2010-01",
      education_end_date: "2015-01",
      military_date_from: "2010-01",
      military_date_to: "2011-01",
      spouse_date_of_birth: "1990",
      partner_date_of_birth: "1991",
      deceased_spouse_date_of_birth: "1992-02",
      former_spouse_date_of_birth__2: "1993-03-04",
      unrelated_date: "2024-01-02",
    });

    assert.equal(answers.intended_arrival_date_year, "2027");
    assert.equal(answers.intended_arrival_date_month, "NOV");
    assert.equal(answers.intended_arrival_date_day, undefined);
    assert.equal(answers.previous_visit_date_arrived_year, "2022");
    assert.equal(answers.previous_visit_date_arrived_month, undefined);
    assert.equal(answers.previous_visit_date_arrived_day, undefined);
    assert.equal(answers.previous_visit_date_arrived_year__2, "2023");
    assert.equal(answers.previous_visit_date_arrived_month__2, "APR");
    assert.equal(answers.previous_visit_date_arrived_day__2, undefined);
    assert.equal(answers.father_dob_year, "1960");
    assert.equal(answers.father_dob_month, undefined);
    assert.equal(answers.father_dob_day, undefined);
    assert.equal(answers.mother_dob_year, "1965");
    assert.equal(answers.mother_dob_month, "JUN");
    assert.equal(answers.mother_dob_day, undefined);
    assert.equal(answers.employment_start_date_year, "2024");
    assert.equal(answers.employment_start_date_month, undefined);
    assert.equal(answers.employment_start_date_day, undefined);
    assert.equal(answers.prev_employment_start_date_year, "2019");
    assert.equal(answers.prev_employment_start_date_month, undefined);
    assert.equal(answers.prev_employment_start_date_day, undefined);
    assert.equal(answers.prev_employment_start_date_year__2, "2018");
    assert.equal(answers.prev_employment_start_date_month__2, undefined);
    assert.equal(answers.prev_employment_start_date_day__2, undefined);
    assert.equal(answers.prev_employment_end_date_year, "2020");
    assert.equal(answers.prev_employment_end_date_month, undefined);
    assert.equal(answers.prev_employment_end_date_day, undefined);
    assert.equal(answers.education_start_date_year, "2010");
    assert.equal(answers.education_start_date_month, "JAN");
    assert.equal(answers.education_start_date_day, undefined);
    assert.equal(answers.education_end_date_year, "2015");
    assert.equal(answers.education_end_date_month, "JAN");
    assert.equal(answers.education_end_date_day, undefined);
    assert.equal(answers.military_date_from_year, "2010");
    assert.equal(answers.military_date_from_month, "JAN");
    assert.equal(answers.military_date_from_day, undefined);
    assert.equal(answers.military_date_to_year, "2011");
    assert.equal(answers.military_date_to_month, "JAN");
    assert.equal(answers.military_date_to_day, undefined);
    assert.equal(answers.spouse_date_of_birth, "1990");
    assert.equal(answers.partner_date_of_birth_year, "1991");
    assert.equal(answers.partner_date_of_birth_month, undefined);
    assert.equal(answers.partner_date_of_birth_day, undefined);
    assert.equal(answers.deceased_spouse_date_of_birth_year, "1992");
    assert.equal(answers.deceased_spouse_date_of_birth_month, "FEB");
    assert.equal(answers.deceased_spouse_date_of_birth_day, undefined);
    assert.equal(answers.former_spouse_date_of_birth_year__2, "1993");
    assert.equal(answers.former_spouse_date_of_birth_month__2, "MAR");
    assert.equal(answers.former_spouse_date_of_birth_day__2, "04");
    assert.equal(answers.unrelated_date, "2024-01-02");

    assert.deepEqual(findInvalidDs160DateAnswers(answers), []);
    assert.deepEqual(findInvalidDs160DateAnswers({
      intended_arrival_date: "2027",
      previous_visit_date_arrived: "2022-13",
      father_date_of_birth: "not-a-date",
      spouse_date_of_birth: "1990-01-01T00:00:00.000Z",
      employment_start_date: "2024-02-03",
      prev_employment_start_date: "2019-01",
      prev_employment_end_date: "2020-01-01T00:00:00.000Z",
      education_start_date: "2010",
      education_end_date: "2015-13",
      military_date_from: "2010",
      military_date_to: "2011-13",
      partner_date_of_birth: "1991-13",
      deceased_spouse_date_of_birth: "1992-13",
      former_spouse_date_of_birth__2: "1993-01-01T00:00:00.000Z",
    }), ["intended_arrival_date", "previous_visit_date_arrived", "father_date_of_birth", "spouse_date_of_birth", "prev_employment_end_date", "education_start_date", "education_end_date", "military_date_from", "military_date_to", "partner_date_of_birth", "deceased_spouse_date_of_birth", "former_spouse_date_of_birth__2"]);
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

  it("preserves a student's explicit no-income decision for CEAC", () => {
    const answers = deriveDS160Answers({
      primary_occupation: "student",
      monthly_salary: "DOES_NOT_APPLY",
    });

    assert.equal(answers.primary_occupation, "student");
    assert.equal(answers.monthly_income_na, "Y");
    assert.equal(answers.monthly_salary, undefined);
    assert.equal(answers.monthly_income, undefined);
  });

  it("maps education address Does Not Apply values to row-local CEAC checkboxes", () => {
    const answers = deriveDS160Answers({
      education_state_province: "DOES_NOT_APPLY",
      education_postal_code: "DOES_NOT_APPLY",
    });

    assert.equal(answers.education_address_state_na, "Y");
    assert.equal(answers.education_address_postal_na, "Y");
    assert.equal(answers.education_state_province, undefined);
    assert.equal(answers.education_postal_code, undefined);
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
