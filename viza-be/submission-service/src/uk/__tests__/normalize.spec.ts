import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeUkAnswers } from "../normalize";
import { UkNormalizationError } from "../errors";

/** A representative full UK wizard answer set (wizard-native keys/values). */
function wizardAnswers(): Record<string, string> {
  return {
    given_names: "Wei",
    surname: "Zhang",
    sex: "Male",
    marital_status: "married",
    date_of_birth: "1990-05-14",
    place_of_birth: "Shanghai",
    country_of_nationality: "CHN",
    country_of_birth: "CHN",
    has_other_nationalities: "no",
    passport_number: "E12345678",
    passport_issuing_authority: "CHN",
    passport_date_of_issue: "2020-01-02",
    passport_date_of_expiry: "2030-01-02",
    email_address: "wei.zhang@example.com",
    telephone_number: "13800138000",
    home_address_line1: "12 Nanjing Road",
    home_address_city: "Shanghai",
    home_address_postcode: "200001",
    home_country: "CHN",
    owns_home: "yes",
    employment_status: "employed",
    employer_name: "Acme Co",
    employer_address: "1 Industrial Ave",
    employer_phone: "02112345678",
    job_title: "Engineer",
    monthly_income: "20000",
    estimated_trip_cost: "3000",
    trip_cost_currency: "GBP",
    trip_funding_source: "self",
    purpose_of_visit: "tourism",
    intended_arrival_date: "2026-08-01",
    intended_departure_date: "2026-08-15",
    uk_address_line1: "10 Downing Street",
    uk_address_city: "London",
    uk_address_postcode: "SW1A 2AA",
    host_name: "The Savoy",
    has_visited_uk_before: "no",
    has_been_refused_uk_visa: "no",
    has_been_refused_other_visa: "no",
  };
}

describe("normalizeUkAnswers — key + value translation", () => {
  it("remaps wizard keys to the seed keys the fillers consume", () => {
    const out = normalizeUkAnswers({ answers: wizardAnswers() });
    assert.equal(out.home_address_line_1, "12 Nanjing Road");
    assert.equal(out.home_address_country, "CHN");
    assert.equal(out.phone_number, "13800138000");
    assert.equal(out.passport_issue_date, "2020-01-02");
    assert.equal(out.passport_expiry_date, "2030-01-02");
    assert.equal(out.employer_address_line_1, "1 Industrial Ave");
    assert.equal(out.employer_phone_number, "02112345678");
    assert.equal(out.job_earnings_amount, "20000");
    assert.equal(out.planned_spend_amount, "3000");
    assert.equal(out.planned_spend_currency, "GBP");
    // No stale wizard-native keys leak through.
    assert.equal(out.home_address_line1, undefined);
    assert.equal(out.telephone_number, undefined);
  });

  it("lowercases sex to the seed enum the gender filler expects", () => {
    assert.equal(normalizeUkAnswers({ answers: { ...wizardAnswers(), sex: "Male" } }).sex, "male");
    assert.equal(normalizeUkAnswers({ answers: { ...wizardAnswers(), sex: "Female" } }).sex, "female");
  });

  it("maps trip dates to planned_* keys", () => {
    const out = normalizeUkAnswers({ answers: wizardAnswers() });
    assert.equal(out.planned_arrival_date, "2026-08-01");
    assert.equal(out.planned_departure_date, "2026-08-15");
  });

  it("derives others_paying_for_visit from funding source", () => {
    assert.equal(
      normalizeUkAnswers({ answers: { ...wizardAnswers(), trip_funding_source: "self" } }).others_paying_for_visit,
      "no",
    );
    assert.equal(
      normalizeUkAnswers({ answers: { ...wizardAnswers(), trip_funding_source: "sponsor" } }).others_paying_for_visit,
      "yes",
    );
  });

  it("maps the UK accommodation block", () => {
    const out = normalizeUkAnswers({ answers: wizardAnswers() });
    assert.equal(out.has_uk_accommodation_address, "yes");
    assert.equal(out.uk_accommodation_address_line_1, "10 Downing Street");
    assert.equal(out.uk_accommodation_city, "London");
    assert.equal(out.uk_accommodation_postcode, "SW1A 2AA");
    assert.equal(out.uk_accommodation_name, "The Savoy");
  });

  it("routes 'visiting_family' purpose under tourism with a sub-purpose", () => {
    const out = normalizeUkAnswers({ answers: { ...wizardAnswers(), purpose_of_visit: "visiting_family" } });
    assert.equal(out.purpose_of_visit, "tourism");
    assert.equal(out.tourism_purpose, "visiting_family");
  });

  it("maps 'study' purpose to short_term_study and wedding to marriage", () => {
    assert.equal(
      normalizeUkAnswers({ answers: { ...wizardAnswers(), purpose_of_visit: "study" } }).purpose_of_visit,
      "short_term_study",
    );
    assert.equal(
      normalizeUkAnswers({ answers: { ...wizardAnswers(), purpose_of_visit: "wedding_civil_partnership" } }).purpose_of_visit,
      "marriage",
    );
  });

  it("treats a prior refusal as an immigration problem (truthful)", () => {
    assert.equal(
      normalizeUkAnswers({ answers: { ...wizardAnswers(), has_been_refused_uk_visa: "yes" } }).has_immigration_problems,
      "yes",
    );
    assert.equal(
      normalizeUkAnswers({ answers: wizardAnswers() }).has_immigration_problems,
      "no",
    );
  });

  it("converts DD/MM/YYYY dates to ISO", () => {
    const out = normalizeUkAnswers({ answers: { ...wizardAnswers(), date_of_birth: "14/05/1990" } });
    assert.equal(out.date_of_birth, "1990-05-14");
  });

  it("passes the background extras through to their seed keys", () => {
    const out = normalizeUkAnswers({
      answers: {
        ...wizardAnswers(),
        visit_activities_description: "Sightseeing in London",
        has_family_in_uk: "yes",
        has_financial_dependants: "no",
        travelling_in_organised_group: "no",
        travelling_with_non_partner: "yes",
      },
    });
    assert.equal(out.visit_activities_description, "Sightseeing in London");
    assert.equal(out.has_family_in_uk, "yes");
    assert.equal(out.has_financial_dependants, "no");
    assert.equal(out.travelling_in_organised_group, "no");
    assert.equal(out.travelling_with_non_partner, "yes");
  });
});

describe("normalizeUkAnswers — guards", () => {
  it("throws on an unrecognized sex value", () => {
    assert.throws(
      () => normalizeUkAnswers({ answers: { ...wizardAnswers(), sex: "robot" } }),
      UkNormalizationError,
    );
  });

  it("throws on an unrecognized purpose value", () => {
    assert.throws(
      () => normalizeUkAnswers({ answers: { ...wizardAnswers(), purpose_of_visit: "smuggling" } }),
      UkNormalizationError,
    );
  });

  it("throws when core identity is missing", () => {
    const { given_names: _g, ...noName } = wizardAnswers();
    assert.throws(() => normalizeUkAnswers({ answers: noName }), UkNormalizationError);
  });

  it("falls back to profile.full_name for given/family name", () => {
    const { given_names: _g, surname: _s, ...noName } = wizardAnswers();
    const out = normalizeUkAnswers({
      answers: noName,
      profile: { full_name: "Mei Ling Chen" },
    });
    assert.equal(out.given_names, "Mei Ling");
    assert.equal(out.surname, "Chen");
  });
});
