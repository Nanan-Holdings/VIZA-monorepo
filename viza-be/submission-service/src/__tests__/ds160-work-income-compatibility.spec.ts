import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSampleDS160Answers,
  findMissingWorkIncomeAnswers,
  verify,
} from "../ds160-completeness-verify";
import { DS160_FIELDS } from "../ds160-coverage-audit";

describe("DS-160 work and income compatibility coverage", () => {
  it("builds the completeness sample through the same intake aliases as production", () => {
    const answers = buildSampleDS160Answers();

    assert.equal(answers.employer_address_city, "Beijing");
    assert.equal(answers.employer_address_state, "Beijing");
    assert.equal(answers.employer_address_postal, "100080");
    assert.equal(answers.employer_address_country, "CHIN");
    assert.equal(answers.monthly_income, "30000");
    assert.equal(answers.employment_start_date_day, "01");
    assert.equal(answers.employment_start_date_month, "JUN");
    assert.equal(answers.employment_start_date_year, "2015");

    const workKeys = [
      "employer_address_city",
      "employer_address_state",
      "employer_address_state_na",
      "employer_address_postal",
      "employer_address_postal_na",
      "employer_address_country",
      "employment_start_date_day",
      "employment_start_date_month",
      "employment_start_date_year",
      "monthly_income",
      "monthly_income_na",
    ];
    const missing = new Set(verify().missingKeys);
    for (const key of workKeys) assert.equal(missing.has(key), false, `${key} must be satisfied`);
  });

  it("fails closed with canonical missing groups instead of inventing work answers", () => {
    assert.deepEqual(findMissingWorkIncomeAnswers({ employer_city: "Beijing" }), [
      "employer_address_state|employer_address_state_na",
      "employer_address_postal|employer_address_postal_na",
      "employer_address_country",
      "employment_start_date_day",
      "employment_start_date_month",
      "employment_start_date_year",
      "monthly_income|monthly_income_na",
    ]);

    assert.deepEqual(findMissingWorkIncomeAnswers({
      employer_city: "Beijing",
      employer_state_province: "DOES_NOT_APPLY",
      employer_postal_code: "DOES_NOT_APPLY",
      employer_country: "China",
      employment_start_date: "2015-06-01",
      monthly_salary: "DOES_NOT_APPLY",
    }), []);
  });

  it("reports the canonical CEAC work keys as covered by deterministic intake aliases", () => {
    const expectedSources: Record<string, string> = {
      employer_address_city: "employer_city",
      employer_address_state: "employer_state_province",
      employer_address_postal: "employer_postal_code",
      employer_address_country: "employer_country",
      employment_start_date: "employment_start_date",
      monthly_income: "monthly_salary",
    };

    for (const [fieldName, sourceField] of Object.entries(expectedSources)) {
      const field = DS160_FIELDS.find((candidate) => candidate.fieldName === fieldName);
      assert.ok(field, `${fieldName} must be present in the coverage audit`);
      assert.equal(field.simplifiedSource?.sourceField, sourceField);
      assert.equal(field.simplifiedSource?.lossy, false);
    }
  });
});
