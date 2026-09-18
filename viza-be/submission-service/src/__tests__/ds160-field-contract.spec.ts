import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { DS160_FIELD_CONTRACT_COUNT, DS160_FIELD_CONTRACTS } from "../ds160-field-contract";
import { readDs160SeedFields } from "../ds160-parity";

describe("DS-160 checked-in field contract", () => {
  it("contains the complete seed field shape without executing the seed", () => {
    const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");
    const fields = readDs160SeedFields(readFileSync(seedPath, "utf8"));
    assert.equal(fields.length, 336);
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

  it("keeps the DS-160 seed additive", () => {
    const seedPath = path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts");
    const source = readFileSync(seedPath, "utf8");
    assert.match(source, /\.upsert\(batch, \{ onConflict: "visa_type,field_name" \}\)/);
    assert.doesNotMatch(source, /\.from\(\"visa_form_fields\"\)[\s\S]*?\.delete\(\)/);
  });
});
