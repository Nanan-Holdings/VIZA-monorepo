import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { DS160_FIELD_CONTRACT_COUNT, DS160_FIELD_CONTRACTS } from "../ds160-field-contract";
import { assertDs160RequiredAnswers } from "../ceac/field-contract";
import { readDs160SeedFields } from "../ds160-parity";

function completeRequiredFixture(): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const [fieldName, field] of Object.entries(DS160_FIELD_CONTRACTS)) {
    if (field.required) answers[fieldName] = field.type === "date" ? "2000-01-01" : "fixture";
  }
  return answers;
}

describe("DS-160 checked-in field contract", () => {
  it("contains the complete seed field shape without executing the seed", () => {
    const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");
    const fields = readDs160SeedFields(readFileSync(seedPath, "utf8"));
    assert.equal(fields.length, 337);
    assert.equal(DS160_FIELD_CONTRACT_COUNT, fields.length);
    assert.deepEqual(Object.keys(DS160_FIELD_CONTRACTS).sort(), fields.map((field) => field.name).sort());

    for (const field of fields) {
      const contract = DS160_FIELD_CONTRACTS[field.name];
      assert.ok(contract, `missing contract for ${field.name}`);
      assert.equal(contract.page, field.page, field.name);
      assert.equal(contract.step, field.step, field.name);
      assert.equal(contract.type, field.type, field.name);
      assert.equal(contract.required, field.required, field.name);
      assert.equal(contract.label, field.label, field.name);
      assert.equal(contract.showIf, field.showIf, field.name);
      assert.equal(contract.repeatGroup, field.repeatGroup, field.name);
    }
  });

  it("models the explicit Sign and Submit preparer branch", () => {
    const assistance = DS160_FIELD_CONTRACTS.ds160_preparer_assistance;
    assert.equal(assistance.step, 22);
    assert.equal(assistance.type, "radio");
    assert.equal(assistance.required, true);
    assert.equal(assistance.showIf, undefined);

    const detailNames = [
      "ds160_preparer_surname",
      "ds160_preparer_given_names",
      "ds160_preparer_organization_name",
      "ds160_preparer_street1",
      "ds160_preparer_street2",
      "ds160_preparer_city",
      "ds160_preparer_state_province",
      "ds160_preparer_postal_code",
      "ds160_preparer_country",
      "ds160_preparer_relationship",
    ];
    for (const fieldName of detailNames) {
      const field = DS160_FIELD_CONTRACTS[fieldName];
      assert.equal(field.step, 22, fieldName);
      assert.equal(field.showIf, "ds160_preparer_assistance === yes", fieldName);
    }

    assert.equal(DS160_FIELD_CONTRACTS.ds160_preparer_street2.required, false);
    assert.equal(DS160_FIELD_CONTRACTS.ds160_preparer_street2.optional, true);
    for (const fieldName of [
      "ds160_preparer_given_names",
      "ds160_preparer_organization_name",
      "ds160_preparer_state_province",
      "ds160_preparer_postal_code",
    ]) {
      assert.equal(DS160_FIELD_CONTRACTS[fieldName].allowsDoesNotApply, true, fieldName);
    }
  });

  it("requires an SSN answer while allowing an explicit Does Not Apply value", () => {
    const socialSecurityNumber = DS160_FIELD_CONTRACTS.us_social_security_number;
    assert.equal(socialSecurityNumber.required, true);
    assert.equal(socialSecurityNumber.allowsDoesNotApply, true);
  });

  it("requires the CEAC monthly-income decision in the active student branch", () => {
    const monthlyIncome = DS160_FIELD_CONTRACTS.monthly_salary;
    assert.equal(monthlyIncome.required, true);
    assert.equal(monthlyIncome.allowsDoesNotApply, true);
    assert.equal(
      monthlyIncome.showIf,
      "primary_occupation !== _empty && primary_occupation !== retired && primary_occupation !== homemaker && primary_occupation !== not_employed",
    );
  });

  it("requires Personal Information identity answers while preserving Does Not Apply", () => {
    const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");
    const source = readFileSync(seedPath, "utf8");
    const fields = [
      ["full_name_native_alphabet", "Full Name in Native Alphabet"],
      ["state_of_birth", "State/Province of Birth"],
      ["national_id_number", "National Identification Number"],
      ["us_social_security_number", "U.S. Social Security Number"],
      ["us_taxpayer_id", "U.S. Taxpayer ID Number"],
    ] as const;

    for (const [fieldName, label] of fields) {
      const contract = DS160_FIELD_CONTRACTS[fieldName];
      assert.equal(contract.required, true, fieldName);
      assert.equal(contract.label, label, fieldName);
      assert.equal(contract.allowsDoesNotApply, true, fieldName);

      const start = source.indexOf(`field_name: "${fieldName}"`);
      const end = source.indexOf("\n  },", start);
      assert.ok(start >= 0 && end > start, `missing seed declaration for ${fieldName}`);
      const declaration = source.slice(start, end);
      assert.match(declaration, /required: true/);
      assert.match(declaration, /has_does_not_apply: true/);
    }

    const passportStart = source.indexOf('field_name: "other_nationality_passport_number"');
    const passportEnd = source.indexOf("\n  },", passportStart);
    assert.ok(passportStart >= 0 && passportEnd > passportStart);
    const passportDeclaration = source.slice(passportStart, passportEnd);
    assert.match(passportDeclaration, /required: true/);
    assert.match(passportDeclaration, /maxLength: 20/);

    for (const [fieldName, maxLength] of [
      ["full_name_native_alphabet", 100],
      ["other_surname", 33],
      ["other_given_names", 33],
      ["city_of_birth", 20],
      ["state_of_birth", 20],
      ["national_id_number", 20],
      ["us_taxpayer_id", 20],
    ] as const) {
      const start = source.indexOf(`field_name: "${fieldName}"`);
      const end = source.indexOf("\n  },", start);
      assert.ok(start >= 0 && end > start, `missing seed declaration for ${fieldName}`);
      assert.match(source.slice(start, end), new RegExp(`maxLength: ${maxLength}`));
    }
    assert.equal(DS160_FIELD_CONTRACTS.national_id_number.maxLength, 20);
    assert.equal(DS160_FIELD_CONTRACTS.us_taxpayer_id.maxLength, 20);

    const personalMigration = readFileSync(
      path.resolve(__dirname, "../../../agent-backend/drizzle/0197_ds160_personal_identity_required_fields.sql"),
      "utf8",
    );
    assert.match(personalMigration, /WHEN 'national_id_number' THEN[\s\S]*\{"maxLength":20\}/);
    assert.match(personalMigration, /WHEN 'us_taxpayer_id' THEN[\s\S]*\{"maxLength":20\}/);

    const otherNationality = completeRequiredFixture();
    otherNationality.other_nationality = "yes";
    otherNationality.other_nationality_country = "JPN";
    otherNationality.other_nationality_has_passport = "yes";
    delete otherNationality.other_nationality_passport_number;
    assert.throws(
      () => assertDs160RequiredAnswers(otherNationality),
      /other_nationality_passport_number/,
    );
    otherNationality.other_nationality_passport_number = "P123456";
    assert.doesNotThrow(() => assertDs160RequiredAnswers(otherNationality));

    const secondRow: Record<string, string> = {
      ...otherNationality,
      other_nationality_country__2: "CAN",
      other_nationality_has_passport__2: "yes",
    };
    assert.throws(
      () => assertDs160RequiredAnswers(secondRow),
      /other_nationality_passport_number__2/,
    );
    secondRow.other_nationality_passport_number__2 = "C123456";
    assert.doesNotThrow(() => assertDs160RequiredAnswers(secondRow));

    const noPassport: Record<string, string> = { ...otherNationality, other_nationality_has_passport: "no" };
    delete noPassport.other_nationality_passport_number;
    assert.doesNotThrow(() => assertDs160RequiredAnswers(noPassport));

    const answers = completeRequiredFixture();
    answers.full_name_native_alphabet = "DOES_NOT_APPLY";
    answers.state_of_birth = "DOES_NOT_APPLY";
    answers.national_id_number = "DOES_NOT_APPLY";
    answers.us_social_security_number = "DOES_NOT_APPLY";
    answers.us_taxpayer_id = "DOES_NOT_APPLY";
    assert.doesNotThrow(() => {
      // Explicit NA values satisfy the required CEAC controls.
      assertDs160RequiredAnswers(answers);
    });
  });

  it("gates parent DOB and U.S. presence on both parent names being known", () => {
    assert.equal(
      DS160_FIELD_CONTRACTS.father_date_of_birth.showIf,
      "father_surname !== DO_NOT_KNOW || father_given_names !== DO_NOT_KNOW",
    );
    assert.equal(
      DS160_FIELD_CONTRACTS.father_in_us.showIf,
      "father_surname !== DO_NOT_KNOW || father_given_names !== DO_NOT_KNOW",
    );
    assert.equal(
      DS160_FIELD_CONTRACTS.mother_date_of_birth.showIf,
      "mother_surname !== DO_NOT_KNOW || mother_given_names !== DO_NOT_KNOW",
    );
    assert.equal(
      DS160_FIELD_CONTRACTS.mother_in_us.showIf,
      "mother_surname !== DO_NOT_KNOW || mother_given_names !== DO_NOT_KNOW",
    );
  });

  it("matches CEAC telecode grouping and optional given-name behavior", () => {
    const pattern = "^[0-9]{4}(?: [0-9]{4})*$";
    const surname = DS160_FIELD_CONTRACTS.telecode_surname;
    const givenNames = DS160_FIELD_CONTRACTS.telecode_given_names;
    assert.equal(surname.required, true);
    assert.equal(givenNames.required, false);
    for (const [fieldName, field] of [
      ["telecode_surname", surname],
      ["telecode_given_names", givenNames],
    ] as const) {
      assert.equal(field.maxLength, 20, fieldName);
      assert.equal(field.pattern, pattern, fieldName);
    }

    const grouping = new RegExp(pattern);
    assert.equal(grouping.test("1234"), true);
    assert.equal(grouping.test("1234 5678"), true);
    assert.equal(grouping.test("12345678"), false);
    assert.equal(grouping.test("1234 567"), false);

    const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");
    const source = readFileSync(seedPath, "utf8");
    for (const fieldName of ["telecode_surname", "telecode_given_names"]) {
      const start = source.indexOf(`field_name: "${fieldName}"`);
      const end = source.indexOf("\n  },", start);
      assert.ok(start >= 0 && end > start, `missing seed declaration for ${fieldName}`);
      const declaration = source.slice(start, end);
      assert.match(declaration, /maxLength: 20/);
      assert.match(declaration, /pattern: "\^\[0-9\]\{4\}\(\?: \[0-9\]\{4\}\)\*\$"/);
    }
  });

  it("keeps the DS-160 seed additive", () => {
    const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");
    const source = readFileSync(seedPath, "utf8");
    assert.match(source, /\.upsert\(batch, \{ onConflict: "visa_type,field_name" \}\)/);
    assert.doesNotMatch(source, /\.from\(\"visa_form_fields\"\)[\s\S]*?\.delete\(\)/);
  });
});
