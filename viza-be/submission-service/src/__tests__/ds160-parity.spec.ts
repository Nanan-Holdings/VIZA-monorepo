import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, it } from "node:test";
import { branchInventory, consumedSourceKeys, deriveKeyCoverage, ds160ConditionMatches, readDs160SeedFields, type Ds160Derivations } from "../ds160-parity";
import { ds160ConditionMatches as runtimeDs160ConditionMatches } from "../ds160-conditions";

describe("DS-160 contract audit", () => {
  it("does not require employed-branch fixture answers for retired applicants", () => {
    const expression = "primary_occupation !== _empty && primary_occupation !== retired && primary_occupation !== homemaker && primary_occupation !== not_employed";
    assert.equal(ds160ConditionMatches(expression, { primary_occupation: "retired" }), false);
    assert.equal(ds160ConditionMatches(expression, { primary_occupation: "student" }), true);
    assert.equal(ds160ConditionMatches(expression, {}), false);
    assert.equal(ds160ConditionMatches("has_telecode === yes || other_names_used === yes", { other_names_used: "Y" }), true);
    assert.equal(ds160ConditionMatches("intended_length_of_stay_unit === DAY(S)", { intended_length_of_stay_unit: "DAY(S)" }), true);
    assert.equal(runtimeDs160ConditionMatches("marital_status === divorced", { marital_status: "D" }), true);
    assert.equal(runtimeDs160ConditionMatches("marital_status === single", { marital_status: "S" }), true);
    assert.throws(() => ds160ConditionMatches("unknown_syntax", {}), /Unsupported/);
    assert.throws(() => ds160ConditionMatches("gate === yes || unknown_syntax", { gate: "yes" }), /Unsupported/);
  });
  it("keeps adjacent field conditions separate and ignores comments/outside declarations", () => {
    const fields = readDs160SeedFields(`
      // field_name: "comment_only"
      const OTHER = { field_name: "outside" };
      const FIELDS = [
        { field_name: "gate", field_type: "radio", step_number: 1, step_name: "Personal" },
        { field_name: "detail", field_type: "text", step_number: 1, step_name: "Personal",
          conditional_logic: { showIf: "gate === yes" }, validation_rules: { repeat_group: "names" } }
      ];
      throw new Error("The database seed must never execute");
    `);
    assert.deepEqual(fields.map(field => field.name), ["gate", "detail"]);
    assert.equal(fields[0].showIf, undefined);
    assert.equal(fields[1].showIf, "gate === yes");
    assert.equal(fields[1].repeatGroup, "names");
    const branches = branchInventory(fields, new Set(["gate"]));
    assert.deepEqual(branches[0].unmappedFields, ["detail"]);
    assert.equal(branches[0].officialVerified, false);
  });

  it("includes every generated security explanation and conditional family/repeater declaration", () => {
    const fields = readDs160SeedFields(readFileSync(path.resolve(__dirname, "../../../agent-backend/scripts/seed-ds160-form-fields.ts"), "utf8"));
    const byName = new Map(fields.map(field => [field.name, field]));
    assert.equal(byName.get("has_arrest_conviction_explain")?.showIf, "has_arrest_conviction === yes");
    assert.equal(byName.get("former_spouse_surname")?.showIf, "marital_status === divorced");
    assert.equal(byName.get("companion_surname")?.repeatGroup, "companions");
    assert.ok(fields.every(field => Number.isFinite(field.step) && field.page !== "unknown"));
    for (const field of fields) if (field.showIf) assert.doesNotThrow(() => ds160ConditionMatches(field.showIf!, {}));
    assert.ok(fields.length > 300);
  });

  it("rejects duplicate definitions rather than hiding them in a Set", () => {
    assert.throws(() => readDs160SeedFields('const FIELDS = [{field_name: "name"}, {field_name: "name"}];'), /Duplicate/);
  });

  it("follows chained derivations regardless of rule order without losing unmapped branches", () => {
    const rules: Ds160Derivations = {
      keyAliases: [{ from: "middle", to: "ceac" }, { from: "source", to: "middle" }],
      naPairs: [{ source: "ceac", naKey: "ceac_na" }],
      dateSplits: [{ source: "start_date", targetPrefix: "start" }],
      customDerivations: [{ requires: ["from", "to"], produces: ["duration"] }],
    };
    const coverage = deriveKeyCoverage(["source", "from"], rules);
    assert.ok(coverage.has("ceac_na"));
    assert.equal(coverage.has("duration"), false);
    const consumed = consumedSourceKeys(["ceac_na", "start_day", "duration"], rules);
    for (const key of ["source", "middle", "start_date", "from", "to"]) assert.ok(consumed.has(key));
    assert.equal(consumed.has("former_spouse_surname"), false);
  });
});
