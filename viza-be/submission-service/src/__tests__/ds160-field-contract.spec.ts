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
    assert.equal(fields.length, 325);
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
});

