import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { assertDs160RequiredAnswers, Ds160RequiredAnswersError } from "../ceac/field-contract";
import { DS160_FIELD_CONTRACTS } from "../ds160-field-contract";

const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");

function completeRequiredFixture(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [fieldName, field] of Object.entries(DS160_FIELD_CONTRACTS)) {
    if (!field.required) continue;
    if (field.type !== "date") {
      answers[fieldName] = "fixture";
      continue;
    }
    answers[fieldName] = fieldName === "previous_visit_date_arrived"
      ? "2020"
      : ["father_date_of_birth", "mother_date_of_birth", "spouse_date_of_birth"].includes(fieldName)
        ? "1990"
        : "2000-01-01";
  }
  return answers;
}

function declaration(source: string, fieldName: string): string {
  const start = source.indexOf(`field_name: "${fieldName}"`);
  const end = source.indexOf("\n  },", start);
  assert.ok(start >= 0 && end > start, `missing seed declaration for ${fieldName}`);
  return source.slice(start, end);
}

function missingFields(error: unknown): string[] {
  assert.ok(error instanceof Ds160RequiredAnswersError);
  return [...error.missingFields];
}

const SOCIAL_OPTIONS = [
  ["ASKF", "ASK.FM"],
  ["DUBN", "DOUBAN"],
  ["FCBK", "FACEBOOK"],
  ["FLKR", "FLICKR"],
  ["GOGL", "GOOGLE+"],
  ["INST", "INSTAGRAM"],
  ["LINK", "LINKEDIN"],
  ["MYSP", "MYSPACE"],
  ["PTST", "PINTEREST"],
  ["QZNE", "QZONE (QQ)"],
  ["RDDT", "REDDIT"],
  ["SWBO", "SINAWEIBO"],
  ["TWBO", "TENCENTWEIBO"],
  ["TUMB", "TUMBLR"],
  ["TWIT", "TWITTER"],
  ["TWOO", "TWOO"],
  ["VINE", "VINE"],
  ["VKON", "VKONTAKTE (VK)"],
  ["YUKU", "YOUKU"],
  ["YTUB", "YOUTUBE"],
  ["NONE", "NONE"],
] as const;

describe("DS-160 Previous U.S. Travel, Address/Phone, and Family contract", () => {
  it("records the confirmed required flags, precision metadata, lengths, NA paths, and social options", () => {
    const source = readFileSync(seedPath, "utf8");
    const required = [
      "previous_visit_date_arrived",
      "previous_visit_length_of_stay",
      "previous_visit_length_of_stay_unit",
      "us_drivers_license_number",
      "us_drivers_license_state",
      "visa_number",
      "visa_lost_or_stolen_explain",
      "visa_cancelled_or_revoked_explain",
      "refusal_explain",
      "immigrant_petition_explain",
      "home_address_line1",
      "home_address_city",
      "home_address_state_province",
      "home_address_postal_code",
      "home_address_country",
      "mailing_same_as_home",
      "mailing_address_line1",
      "mailing_address_city",
      "mailing_address_state",
      "mailing_address_postal",
      "mailing_address_country",
      "primary_phone",
      "secondary_phone",
      "work_phone",
      "has_other_phones",
      "additional_phone",
      "email_address",
      "has_other_emails",
      "additional_email",
      "has_social_media",
      "social_media_platform",
      "social_media_handle",
      "has_other_social_media",
      "other_social_media_name",
      "other_social_media_identifier",
      "social_media_identifier",
      "spouse_surname",
      "spouse_given_names",
      "spouse_date_of_birth",
      "spouse_nationality",
      "spouse_city_of_birth",
      "spouse_country_of_birth",
      "spouse_address_type",
      "spouse_address_street1",
      "spouse_address_city",
      "spouse_address_state",
      "spouse_address_zip",
      "spouse_address_country",
    ];
    for (const fieldName of required) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].required, true, fieldName);
      assert.match(declaration(source, fieldName), /required: true/);
    }

    const maxLengths: Record<string, number> = {
      previous_visit_length_of_stay: 3,
      us_drivers_license_number: 20,
      visa_number: 12,
      visa_lost_or_stolen_explain: 4000,
      visa_cancelled_or_revoked_explain: 4000,
      refusal_explain: 4000,
      immigrant_petition_explain: 4000,
      home_address_line1: 40,
      home_address_line2: 40,
      home_address_city: 20,
      home_address_state_province: 20,
      home_address_postal_code: 10,
      mailing_address_line1: 40,
      mailing_address_line2: 40,
      mailing_address_city: 20,
      mailing_address_state: 20,
      mailing_address_postal: 10,
      primary_phone: 15,
      secondary_phone: 15,
      work_phone: 15,
      additional_phone: 15,
      email_address: 50,
      additional_email: 40,
      social_media_handle: 50,
      social_media_identifier: 50,
      other_social_media_name: 40,
      other_social_media_identifier: 40,
      father_surname: 33,
      father_given_names: 33,
      mother_surname: 33,
      mother_given_names: 33,
      spouse_surname: 33,
      spouse_given_names: 33,
      spouse_city_of_birth: 20,
      spouse_address_street1: 40,
      spouse_address_street2: 40,
      spouse_address_city: 20,
      spouse_address_state: 20,
      spouse_address_zip: 10,
    };
    for (const [fieldName, maxLength] of Object.entries(maxLengths)) {
      assert.match(declaration(source, fieldName), new RegExp(`maxLength: ${maxLength}`), fieldName);
    }

    assert.match(declaration(source, "intended_arrival_date"), /minimum_date_precision: "month"/);
    assert.match(declaration(source, "previous_visit_date_arrived"), /minimum_date_precision: "year"/);
    for (const fieldName of [
      "father_date_of_birth",
      "mother_date_of_birth",
      "spouse_date_of_birth",
    ]) assert.match(declaration(source, fieldName), /minimum_date_precision: "year"/);
    assert.equal(DS160_FIELD_CONTRACTS.visa_number.allowsDoesNotApply, true);
    for (const fieldName of [
      "home_address_state_province",
      "home_address_postal_code",
      "mailing_address_state",
      "mailing_address_postal",
      "secondary_phone",
      "work_phone",
    ]) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].allowsDoesNotApply, true, fieldName);
    }

    for (const fieldName of ["social_media_platform", "social_media_provider"]) {
      const block = declaration(source, fieldName);
      const options = [...block.matchAll(/\{ value: "([^"]+)", text: "([^"]+)" \}/g)].map((match) => [match[1], match[2]]);
      assert.deepEqual(options, SOCIAL_OPTIONS, fieldName);
    }
  });

  it("gates parent controls and requires the active spouse branch", () => {
    const source = readFileSync(seedPath, "utf8");
    for (const fieldName of [
      "father_surname",
      "father_given_names",
      "mother_surname",
      "mother_given_names",
    ]) assert.match(declaration(source, fieldName), /allow_do_not_know: true/);

    const unknownParents = completeRequiredFixture();
    unknownParents.father_surname = "DO_NOT_KNOW";
    unknownParents.father_given_names = "DO_NOT_KNOW";
    unknownParents.mother_surname = "DO_NOT_KNOW";
    unknownParents.mother_given_names = "DO_NOT_KNOW";
    delete unknownParents.father_date_of_birth;
    delete unknownParents.father_in_us;
    delete unknownParents.mother_date_of_birth;
    delete unknownParents.mother_in_us;
    assert.doesNotThrow(() => assertDs160RequiredAnswers(unknownParents));

    const married = completeRequiredFixture();
    married.marital_status = "married";
    delete married.spouse_surname;
    assert.throws(() => assertDs160RequiredAnswers(married), /spouse_surname/);
    Object.assign(married, {
      spouse_surname: "SURNAME",
      spouse_given_names: "GIVEN",
      spouse_date_of_birth: "1990",
      spouse_nationality: "CHN",
      spouse_city_of_birth: "CITY",
      spouse_country_of_birth: "CHN",
      spouse_address_type: "same_as_home",
    });
    assert.doesNotThrow(() => assertDs160RequiredAnswers(married));

    const otherAddress: Record<string, string> = { ...married, spouse_address_type: "other" };
    for (const fieldName of [
      "spouse_address_street1",
      "spouse_address_city",
      "spouse_address_state",
      "spouse_address_zip",
      "spouse_address_country",
    ]) delete otherAddress[fieldName];
    assert.throws(() => assertDs160RequiredAnswers(otherAddress), /spouse_address_street1/);
    Object.assign(otherAddress, {
      spouse_address_street1: "1 Example Street",
      spouse_address_city: "CITY",
      spouse_address_state: "DOES_NOT_APPLY",
      spouse_address_zip: "DOES_NOT_APPLY",
      spouse_address_country: "CHN",
    });
    assert.doesNotThrow(() => assertDs160RequiredAnswers(otherAddress));
  });

  it("requires active previous-travel rows and accepts license/visa unknown choices", () => {
    const answers = completeRequiredFixture();
    answers.has_been_in_us = "yes";
    answers.has_us_drivers_license = "yes";
    answers.us_drivers_license_number = "DO_NOT_KNOW";
    answers.us_drivers_license_state = "CA";
    answers.has_us_visa = "yes";
    answers.visa_number = "DO_NOT_KNOW";
    answers.visa_lost_or_stolen = "yes";
    answers.visa_cancelled_or_revoked = "yes";
    answers.has_been_refused = "yes";
    answers.immigrant_petition_filed = "yes";

    delete answers.previous_visit_length_of_stay;
    assert.throws(() => assertDs160RequiredAnswers(answers), (error: unknown) => {
      assert.ok(missingFields(error).includes("previous_visit_length_of_stay"));
      return true;
    });

    answers.previous_visit_length_of_stay = "10";
    assert.doesNotThrow(() => assertDs160RequiredAnswers(answers));

    const noUsHistory = completeRequiredFixture();
    noUsHistory.has_been_in_us = "no";
    for (const fieldName of [
      "previous_visit_date_arrived",
      "previous_visit_length_of_stay",
      "previous_visit_length_of_stay_unit",
      "us_drivers_license_number",
      "us_drivers_license_state",
    ]) delete noUsHistory[fieldName];
    assert.doesNotThrow(() => assertDs160RequiredAnswers(noUsHistory));
  });

  it("requires the visible address, phone, email, and social branches", () => {
    const answers = completeRequiredFixture();
    answers.mailing_same_as_home = "no";
    answers.has_other_phones = "yes";
    answers.has_other_emails = "yes";
    answers.has_social_media = "yes";
    answers.social_media_platform = "FCBK";
    answers.has_other_social_media = "yes";
    for (const fieldName of [
      "mailing_address_line1",
      "mailing_address_city",
      "mailing_address_state",
      "mailing_address_postal",
      "mailing_address_country",
      "additional_phone",
      "additional_email",
      "social_media_handle",
      "social_media_identifier",
      "other_social_media_name",
      "other_social_media_identifier",
    ]) delete answers[fieldName];
    assert.throws(() => assertDs160RequiredAnswers(answers), (error: unknown) => {
      const missing = missingFields(error);
      for (const fieldName of [
        "mailing_address_line1",
        "mailing_address_city",
        "mailing_address_state",
        "mailing_address_postal",
        "mailing_address_country",
        "additional_phone",
        "additional_email",
        "social_media_handle",
        "other_social_media_name",
        "other_social_media_identifier",
      ]) assert.ok(missing.includes(fieldName), fieldName);
      return true;
    });

    Object.assign(answers, {
      mailing_address_line1: "1 Example Street",
      mailing_address_city: "CITY",
      mailing_address_state: "DOES_NOT_APPLY",
      mailing_address_postal: "DOES_NOT_APPLY",
      mailing_address_country: "CHN",
      additional_phone: "123456789",
      additional_email: "other@example.com",
      social_media_handle: "user",
      other_social_media_name: "Example",
      other_social_media_identifier: "example-user",
    });
    assert.doesNotThrow(() => assertDs160RequiredAnswers(answers));

    const noListedSocial = completeRequiredFixture();
    noListedSocial.has_social_media = "yes";
    noListedSocial.social_media_platform = "NONE";
    delete noListedSocial.social_media_handle;
    assert.doesNotThrow(() => assertDs160RequiredAnswers(noListedSocial));
  });
});
