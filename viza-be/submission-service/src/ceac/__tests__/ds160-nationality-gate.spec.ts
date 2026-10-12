import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertDs160RequiredAnswers,
  createDs160BranchPolicy,
  Ds160DuplicateNationalityError,
  findDs160DuplicateNationalityFields,
} from "../field-contract";
import {
  DS160_ESTA_NATIONALITY_CODES,
  isDs160EstaNationalityGateVisible,
  resolveDs160NationalityCode,
} from "../../ds160-nationality-gate";
import { DS160_COUNTRY_LABELS } from "../../ds160-country-catalog";

test("runner catalog retains the full observed Geography/Nationality union", () => {
  assert.equal(Object.keys(DS160_COUNTRY_LABELS).length, 255);
  assert.deepEqual(DS160_COUNTRY_LABELS.BRZL, ["BRAZIL"]);
  assert.deepEqual(DS160_COUNTRY_LABELS.CHIN, ["CHINA"]);
  assert.deepEqual(DS160_COUNTRY_LABELS.JPN, ["JAPAN"]);
  assert.deepEqual(DS160_COUNTRY_LABELS.HNK, ["HONG KONG", "HONG KONG SAR"]);
});

test("CEAC ESTA gate uses the observed 37-country set and active other-nationality rows", () => {
  assert.equal(DS160_ESTA_NATIONALITY_CODES.size, 37);
  assert.equal(isDs160EstaNationalityGateVisible({
    nationality_country: "CHIN",
    other_nationality: "yes",
    other_nationality_country: "JPN",
    other_nationality_has_passport: "no",
  }), true);
  assert.equal(isDs160EstaNationalityGateVisible({
    nationality_country: "CHIN",
    other_nationality: "yes",
    other_nationality_country: "CAN",
    other_nationality_country__2: "JPN",
    other_nationality_has_passport: "no",
    other_nationality_has_passport__2: "no",
  }), true);
  assert.equal(isDs160EstaNationalityGateVisible({
    nationality_country: "CHIN",
    other_nationality: "no",
    permanent_resident_other_country: "yes",
    other_permanent_resident_country: "JPN",
  }), false);
  assert.equal(isDs160EstaNationalityGateVisible({ nationality_country: "JPN" }), true);
  assert.equal(isDs160EstaNationalityGateVisible({ nationality_country: "IND" }), false);
  assert.equal(isDs160EstaNationalityGateVisible({ nationality_country: "BRA" }), false);
  assert.equal(isDs160EstaNationalityGateVisible({ nationality_country: "中国" }), false);
});

test("nationality aliases normalize to the CEAC value used by cross-field checks", () => {
  assert.equal(resolveDs160NationalityCode("CHN"), "CHIN");
  assert.equal(resolveDs160NationalityCode("China"), "CHIN");
  assert.equal(resolveDs160NationalityCode("中国"), "CHIN");
  assert.equal(resolveDs160NationalityCode("JP"), "JPN");
  assert.equal(resolveDs160NationalityCode("日本"), "JPN");
  assert.equal(resolveDs160NationalityCode("FRANCE"), "FRAN");
  assert.equal(resolveDs160NationalityCode("IN"), "IND");
  assert.equal(resolveDs160NationalityCode("India"), "IND");
  assert.equal(resolveDs160NationalityCode("BR"), "BRZL");
  assert.equal(resolveDs160NationalityCode("BRA"), "BRZL");
  assert.equal(resolveDs160NationalityCode("BRAZIL"), "BRZL");
  assert.equal(resolveDs160NationalityCode("BRZL"), "BRZL");
  assert.equal(resolveDs160NationalityCode("CHILE"), "CHIL");
});

test("preflight rejects duplicate active nationality and permanent-resident countries", () => {
  const otherDuplicate = {
    nationality_country: "CHIN",
    other_nationality: "yes",
    other_nationality_country: "CHN",
    other_nationality_has_passport: "no",
  };
  assert.deepEqual(findDs160DuplicateNationalityFields(otherDuplicate), [
    "nationality_country",
    "other_nationality_country",
  ]);

  const permanentDuplicate = {
    nationality_country: "CHIN",
    other_nationality: "no",
    permanent_resident_other_country: "yes",
    other_permanent_resident_country: "China",
  };
  assert.deepEqual(findDs160DuplicateNationalityFields(permanentDuplicate), [
    "nationality_country",
    "other_permanent_resident_country",
  ]);

  assert.throws(
    () => assertDs160RequiredAnswers(otherDuplicate),
    (error: unknown) => error instanceof Ds160DuplicateNationalityError &&
      error.duplicateFields.join(",") === "nationality_country,other_nationality_country",
  );
});

test("full observed country catalog catches non-ESTA label/code duplicates", () => {
  assert.deepEqual(findDs160DuplicateNationalityFields({
    nationality_country: "BRZL",
    other_nationality: "yes",
    other_nationality_country: "BRAZIL",
  }), ["nationality_country", "other_nationality_country"]);

  assert.deepEqual(findDs160DuplicateNationalityFields({
    nationality_country: "BR",
    other_nationality: "yes",
    other_nationality_country: "BRAZIL",
  }), ["nationality_country", "other_nationality_country"]);
});

test("inactive permanent-resident rows do not create duplicates", () => {
  assert.deepEqual(findDs160DuplicateNationalityFields({
    nationality_country: "CHIN",
    other_nationality: "no",
    other_nationality_country: "CHIN",
    permanent_resident_other_country: "no",
    other_permanent_resident_country: "CHIN",
  }), []);
});

test("hidden historic affirmative ESTA answers stay active for conservative review", () => {
  const policy = createDs160BranchPolicy({
    nationality_country: "CHIN",
    other_nationality: "no",
    permanent_resident_other_country: "yes",
    other_permanent_resident_country: "JPN",
    vwp_denial: "Y",
    vwp_denial_explain: "The prior authorization was denied.",
  });
  assert.equal(policy.isSeedActive("vwp_denial"), true);
  assert.equal(policy.isSeedActive("vwp_denial_explain"), true);

  const negative = createDs160BranchPolicy({
    nationality_country: "CHIN",
    other_nationality: "no",
    permanent_resident_other_country: "yes",
    other_permanent_resident_country: "JPN",
    vwp_denial: "N",
  });
  assert.equal(policy.isSeedActive("vwp_denial"), true);
  assert.equal(negative.isSeedActive("vwp_denial"), false);
});
