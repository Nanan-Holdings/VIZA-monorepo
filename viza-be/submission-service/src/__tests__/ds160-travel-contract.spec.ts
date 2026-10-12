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
    if (field.required) answers[fieldName] = field.type === "date" ? "2000-01-01" : "fixture";
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

describe("DS-160 Travel Information contract", () => {
  it("records the confirmed CEAC required flags, NA controls, lengths, and companion options", () => {
    const source = readFileSync(seedPath, "utf8");
    const required = [
      "arrival_date",
      "arrival_city",
      "departure_date",
      "departure_city",
      "planned_location",
      "us_address_street1",
      "us_address_city",
      "us_address_state",
      "payer_surname",
      "payer_given_names",
      "payer_phone",
      "payer_email",
      "payer_relationship",
      "payer_address_same_as_home",
      "payer_address_street1",
      "payer_address_city",
      "payer_address_state",
      "payer_address_postal",
      "payer_address_country",
      "payer_org_name",
      "payer_org_phone",
      "payer_org_relationship",
      "payer_org_address_street1",
      "payer_org_address_city",
      "payer_org_address_state",
      "payer_org_address_postal",
      "payer_org_address_country",
      "companion_group_travel",
      "companion_group_name",
      "companion_surname",
      "companion_given_names",
      "companion_relationship",
    ];
    for (const fieldName of required) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].required, true, fieldName);
      assert.match(declaration(source, fieldName), /required: true/);
    }

    for (const fieldName of [
      "arrival_flight",
      "departure_flight",
      "us_address_zip",
      "us_address_street2",
      "payer_address_street2",
      "payer_org_address_street2",
    ]) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].required, false, fieldName);
      assert.match(declaration(source, fieldName), /required: false/);
    }

    const maxLengths: Record<string, number> = {
      intended_length_of_stay_value: 3,
      arrival_flight: 20,
      arrival_city: 20,
      departure_flight: 20,
      departure_city: 20,
      planned_location: 40,
      us_address_street1: 40,
      us_address_street2: 40,
      us_address_city: 20,
      us_address_zip: 10,
      payer_surname: 33,
      payer_given_names: 33,
      payer_phone: 15,
      payer_email: 50,
      payer_address_street1: 40,
      payer_address_street2: 40,
      payer_address_city: 20,
      payer_address_state: 20,
      payer_address_postal: 10,
      payer_org_name: 33,
      payer_org_phone: 15,
      payer_org_address_street1: 40,
      payer_org_address_street2: 40,
      payer_org_address_city: 20,
      payer_org_address_state: 20,
      payer_org_address_postal: 10,
      companion_group_name: 75,
      companion_surname: 33,
      companion_given_names: 33,
    };
    for (const [fieldName, maxLength] of Object.entries(maxLengths)) {
      assert.match(declaration(source, fieldName), new RegExp(`maxLength: ${maxLength}`), fieldName);
    }

    for (const fieldName of [
      "payer_email",
      "payer_address_state",
      "payer_address_postal",
      "payer_org_address_state",
      "payer_org_address_postal",
    ]) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].allowsDoesNotApply, true, fieldName);
      assert.match(declaration(source, fieldName), /has_does_not_apply: true/);
    }

    const relationship = declaration(source, "companion_relationship");
    for (const value of ["PARENT", "SPOUSE", "CHILD", "OTHER RELATIVE", "FRIEND", "BUSINESS ASSOCIATE", "OTHER"]) {
      assert.match(relationship, new RegExp(`value: "${value}"`));
    }
    assert.doesNotMatch(relationship, /SIBLING|SCHOOLMATES/);
  });

  it("requires the specific-plans and U.S. address branch while keeping optional controls optional", () => {
    const answers = completeRequiredFixture();
    answers.has_specific_plans = "yes";
    answers.trip_payer_type = "self";
    for (const fieldName of [
      "arrival_date",
      "arrival_city",
      "departure_date",
      "departure_city",
      "planned_location",
      "us_address_street1",
      "us_address_city",
      "us_address_state",
    ]) delete answers[fieldName];
    for (const optional of ["arrival_flight", "departure_flight", "us_address_zip", "us_address_street2"]) {
      delete answers[optional];
    }

    assert.throws(() => assertDs160RequiredAnswers(answers), (error: unknown) => {
      const missing = missingFields(error);
      for (const fieldName of [
        "arrival_date",
        "arrival_city",
        "departure_date",
        "departure_city",
        "planned_location",
        "us_address_street1",
        "us_address_city",
        "us_address_state",
      ]) assert.ok(missing.includes(fieldName), fieldName);
      for (const optional of ["arrival_flight", "departure_flight", "us_address_zip", "us_address_street2"]) {
        assert.equal(missing.includes(optional), false, optional);
      }
      return true;
    });

    const noPlans = completeRequiredFixture();
    noPlans.has_specific_plans = "no";
    noPlans.trip_payer_type = "self";
    for (const fieldName of [
      "arrival_date",
      "arrival_city",
      "departure_date",
      "departure_city",
      "planned_location",
      "us_address_street1",
      "us_address_city",
      "us_address_state",
      "us_address_zip",
      "us_address_street2",
    ]) delete noPlans[fieldName];
    assert.doesNotThrow(() => assertDs160RequiredAnswers(noPlans));
  });

  it("requires other-person payer details and accepts the confirmed NA choices", () => {
    const answers = completeRequiredFixture();
    answers.trip_payer_type = "other_person";
    answers.payer_address_same_as_home = "no";
    for (const fieldName of [
      "payer_surname",
      "payer_given_names",
      "payer_phone",
      "payer_email",
      "payer_relationship",
      "payer_address_street1",
      "payer_address_city",
      "payer_address_state",
      "payer_address_postal",
      "payer_address_country",
    ]) delete answers[fieldName];
    assert.throws(() => assertDs160RequiredAnswers(answers), /payer_surname/);

    Object.assign(answers, {
      payer_surname: "PAYER",
      payer_given_names: "PERSON",
      payer_phone: "123456789",
      payer_email: "DOES_NOT_APPLY",
      payer_relationship: "PARENT",
      payer_address_street1: "1 Example Street",
      payer_address_city: "CITY",
      payer_address_state: "DOES_NOT_APPLY",
      payer_address_postal: "DOES_NOT_APPLY",
      payer_address_country: "CHN",
    });
    assert.doesNotThrow(() => assertDs160RequiredAnswers(answers));

    const sameAddress: Record<string, string> = { ...answers, payer_address_same_as_home: "yes" };
    delete sameAddress.payer_address_street1;
    delete sameAddress.payer_address_city;
    delete sameAddress.payer_address_state;
    delete sameAddress.payer_address_postal;
    delete sameAddress.payer_address_country;
    assert.doesNotThrow(() => assertDs160RequiredAnswers(sameAddress));
  });

  it("requires other-company payer details and keeps the address line two optional", () => {
    const answers = completeRequiredFixture();
    answers.trip_payer_type = "other_company";
    for (const fieldName of [
      "payer_org_name",
      "payer_org_phone",
      "payer_org_relationship",
      "payer_org_address_street1",
      "payer_org_address_city",
      "payer_org_address_state",
      "payer_org_address_postal",
      "payer_org_address_country",
    ]) delete answers[fieldName];
    assert.throws(() => assertDs160RequiredAnswers(answers), /payer_org_name/);

    Object.assign(answers, {
      payer_org_name: "COMPANY",
      payer_org_phone: "123456789",
      payer_org_relationship: "SPONSOR",
      payer_org_address_street1: "1 Example Street",
      payer_org_address_city: "CITY",
      payer_org_address_state: "DOES_NOT_APPLY",
      payer_org_address_postal: "DOES_NOT_APPLY",
      payer_org_address_country: "CHN",
    });
    delete answers.payer_org_address_street2;
    assert.doesNotThrow(() => assertDs160RequiredAnswers(answers));
  });

  it("requires either a companion group name or complete repeated companion rows", () => {
    const group = completeRequiredFixture();
    group.has_companions = "yes";
    group.companion_group_travel = "yes";
    delete group.companion_group_name;
    assert.throws(() => assertDs160RequiredAnswers(group), /companion_group_name/);
    group.companion_group_name = "GROUP";
    assert.doesNotThrow(() => assertDs160RequiredAnswers(group));

    const rows = completeRequiredFixture();
    rows.has_companions = "yes";
    rows.companion_group_travel = "no";
    delete rows.companion_surname;
    delete rows.companion_given_names;
    delete rows.companion_relationship;
    assert.throws(() => assertDs160RequiredAnswers(rows), /companion_surname/);
    Object.assign(rows, {
      companion_surname: "SURNAME",
      companion_given_names: "GIVEN",
      companion_relationship: "FRIEND",
    });
    assert.doesNotThrow(() => assertDs160RequiredAnswers(rows));
  });
});
