import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DS160_WORK_EDUCATION_MINIMUM_AGE,
  getDs160Age,
  isDs160FieldAgeEligible,
  isDs160UsContactVisible,
  isDs160WorkEducationPage,
  isDs160WorkEducationVisible,
} from "../ds160-age-gate";
import { assertDs160RequiredAnswers, findDs160PlaceholderFields } from "../ceac/field-contract";
import { DS160_FIELD_CONTRACTS } from "../ds160-field-contract";
import { deriveDS160Answers } from "../ds160-derive-answers";

const TODAY = new Date("2026-09-21T12:00:00.000Z");

function requiredFixture(dateOfBirth: string): Record<string, string> {
  const answers: Record<string, string> = { date_of_birth: dateOfBirth };
  for (const [fieldName, field] of Object.entries(DS160_FIELD_CONTRACTS)) {
    if (field.required && !answers[fieldName]) answers[fieldName] = field.type === "date" ? "2000-01-01" : "fixture";
  }
  return answers;
}

describe("DS-160 Work/Education/Training age gate", () => {
  it("uses the observed birthday boundary and fails open for unknown dates", () => {
    assert.equal(DS160_WORK_EDUCATION_MINIMUM_AGE, 14);
    assert.equal(getDs160Age("2012-09-21", TODAY), 14);
    assert.equal(getDs160Age("2012-09-22", TODAY), 13);
    assert.equal(isDs160WorkEducationVisible({ date_of_birth: "2012-09-21" }, TODAY), true);
    assert.equal(isDs160WorkEducationVisible({ date_of_birth: "2012-09-22" }, TODAY), false);
    assert.equal(isDs160WorkEducationVisible({ date_of_birth: "" }, TODAY), true);
    assert.equal(isDs160WorkEducationVisible({ date_of_birth: "not-a-date" }, TODAY), true);
  });

  it("recognizes all three CEAC work pages and their checked-in contract fields", () => {
    assert.equal(isDs160WorkEducationPage("work_education_present"), true);
    assert.equal(isDs160WorkEducationPage("work_education_previous"), true);
    assert.equal(isDs160WorkEducationPage("work_education_additional"), true);
    assert.equal(isDs160WorkEducationPage("security_background_1"), false);
    assert.equal(isDs160FieldAgeEligible(
      DS160_FIELD_CONTRACTS.primary_occupation,
      { date_of_birth: "2012-09-22" },
      TODAY,
    ), false);
    assert.equal(isDs160UsContactVisible({ has_specific_plans: "no", intended_length_of_stay_unit: "H" }), false);
    assert.equal(isDs160UsContactVisible({ has_specific_plans: "NO", intended_length_of_stay_unit: "LESS_THAN_24_HOURS" }), false);
    assert.equal(isDs160UsContactVisible({ has_specific_plans: "no", intended_length_of_stay_unit: "D" }), true);
  });

  it("does not delete persisted work answers when the page is hidden for a minor", () => {
    const answers = {
      date_of_birth: "2012-09-22",
      primary_occupation: "student",
      employer_name: "Saved School",
    };
    deriveDS160Answers(answers);
    assert.equal(answers.primary_occupation, "student");
    assert.equal(answers.employer_name, "Saved School");
  });

  it("skips hidden minor work requirements and placeholder/date checks while retaining unknown-DOB strictness", () => {
    const minor = requiredFixture("2012-09-22");
    for (const [fieldName, field] of Object.entries(DS160_FIELD_CONTRACTS)) {
      if (/Work\/Education\/Training/i.test(field.page) && !isDs160FieldAgeEligible(field, minor, TODAY)) {
        delete minor[fieldName];
      }
    }
    minor.primary_occupation = "请输入当前职业";
    minor.prev_employment_start_date = "2020";
    minor.has_specific_plans = "no";
    minor.intended_length_of_stay_unit = "H";
    minor.us_contact_surname = "请输入联系人姓氏";
    assert.doesNotThrow(() => assertDs160RequiredAnswers(minor, { now: TODAY }));
    assert.deepEqual(findDs160PlaceholderFields(minor, { now: TODAY }), []);

    const unknownDob = { ...minor };
    unknownDob.primary_occupation = "fixture";
    delete unknownDob.date_of_birth;
    assert.throws(() => assertDs160RequiredAnswers(unknownDob, { now: TODAY }), /date_of_birth/);
  });
});
