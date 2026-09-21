import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { readDs160SeedFields } from "../ds160-parity";
import {
  DS160_EXTENDED_DATE_SPLITS,
  DS160_EXTENDED_MAPPING_GROUPS,
  DS160_EXTENDED_MAPPINGS,
  DS160_EXTENDED_METADATA,
  DS160_EXTENDED_SEED_CONSUMERS,
} from "../ds160-extended-mappings";
import {
  deriveDs160ExtendedAnswers,
  DS160_EXTENDED_DERIVATION_TARGETS,
} from "../ds160-extended-derivations";
import { deriveDS160Answers, __DERIVATION_TARGETS } from "../ds160-derive-answers";

const SEED_PATH = join(
  process.cwd(),
  "..",
  "agent-backend",
  "scripts",
  "seed-ds160-form-fields.ts",
);

test("extended consumers cover every reported unconsumed seed field", () => {
  const seed = readDs160SeedFields(readFileSync(SEED_PATH, "utf8"));
  const seedByName = new Map(seed.map((field) => [field.name, field]));
  const consumers = Object.entries(DS160_EXTENDED_SEED_CONSUMERS);

  assert.equal(consumers.length, 178);
  for (const [source, targets] of consumers) {
    const seedField = seedByName.get(source);
    assert.ok(seedField, `unknown seed source: ${source}`);
    assert.ok(targets.length > 0, `empty consumer list: ${source}`);
    for (const target of targets) {
      assert.ok(DS160_EXTENDED_MAPPINGS[target], `missing mapping target: ${target}`);
      assert.ok(DS160_EXTENDED_METADATA[target], `missing metadata target: ${target}`);
    }
  }
});

test("metadata preserves seed conditions and repeat group names", () => {
  const seed = readDs160SeedFields(readFileSync(SEED_PATH, "utf8"));
  const seedByName = new Map(seed.map((field) => [field.name, field]));

  for (const [source, targets] of Object.entries(DS160_EXTENDED_SEED_CONSUMERS)) {
    const seedField = seedByName.get(source);
    assert.ok(seedField);
    for (const target of targets) {
      const metadata = DS160_EXTENDED_METADATA[target];
      assert.equal(metadata.seedFieldName, source);
      assert.equal(metadata.condition, seedField.showIf);
      assert.equal(metadata.repeatGroup, seedField.repeatGroup);
      assert.equal(metadata.readBack, "required");
      assert.notEqual(metadata.selectorEvidence, "verified");
    }
  }
});

test("date sources expose one frozen split declaration and three mappings", () => {
  assert.equal(DS160_EXTENDED_DATE_SPLITS.length, 12);
  assert.deepEqual(
    DS160_EXTENDED_DERIVATION_TARGETS.dateSplits,
    DS160_EXTENDED_DATE_SPLITS,
  );

  for (const split of DS160_EXTENDED_DATE_SPLITS) {
    const consumers = DS160_EXTENDED_SEED_CONSUMERS[split.source];
    assert.deepEqual(consumers, [
      `${split.targetPrefix}_day`,
      `${split.targetPrefix}_month`,
      `${split.targetPrefix}_year`,
    ]);
    for (const [part, mappingType] of [["day", "select"], ["month", "select"], ["year", "text"]] as const) {
      const key = `${split.targetPrefix}_${part}`;
      const metadata = DS160_EXTENDED_METADATA[key];
      assert.equal(metadata.seedFieldName, split.source);
      assert.equal(metadata.derivedFrom, split.source);
      assert.equal(metadata.derivedPart, part);
      assert.equal(DS160_EXTENDED_MAPPINGS[key].type, mappingType);
    }
  }
});

test("date derivation is strict, idempotent, and preserves applicant input", () => {
  const answers: Record<string, string> = {
    previous_visit_date_arrived: "2024-02-29",
    previous_visit_date_arrived__2: "2023-01-15",
    previous_visit_date_arrived__3: "not-a-date",
    previous_visit_date_arrived_day: "31",
    education_start_date: "DO_NOT_KNOW",
  };

  deriveDs160ExtendedAnswers(answers);
  assert.equal(answers.previous_visit_date_arrived_day, "31");
  assert.equal(answers.previous_visit_date_arrived_month, "FEB");
  assert.equal(answers.previous_visit_date_arrived_year, "2024");
  assert.equal(answers.previous_visit_date_arrived_day__2, "15");
  assert.equal(answers.previous_visit_date_arrived_month__2, "JAN");
  assert.equal(answers.previous_visit_date_arrived_year__2, "2023");
  assert.equal(answers.previous_visit_date_arrived_day__3, undefined);
  assert.equal(answers.education_start_date_day, undefined);

  const snapshot = { ...answers };
  deriveDs160ExtendedAnswers(answers);
  assert.deepEqual(answers, snapshot);
});

test("the public DS-160 derivation pipeline applies the extended closure", () => {
  const answers = deriveDS160Answers({
    previous_visit_date_arrived: "2024-02-29",
  });

  assert.equal(answers.previous_visit_date_arrived_day, "29");
  assert.equal(answers.previous_visit_date_arrived_month, "FEB");
  assert.equal(answers.previous_visit_date_arrived_year, "2024");
  assert.ok(__DERIVATION_TARGETS.dateSplits.some((split) => split.source === "previous_visit_date_arrived"));
});

test("live NA and unknown mappings retain their branches and repeat groups", () => {
  assert.match(DS160_EXTENDED_MAPPINGS.payer_address_state_na.selector, /cbxDNAPayerStateProvince/);
  assert.match(DS160_EXTENDED_MAPPINGS.payer_address_postal_na.selector, /cbxDNAPayerPostalZIPCode/);
  assert.match(DS160_EXTENDED_MAPPINGS.payer_org_address_state_na.selector, /cbxDNAPayerStateProvince/);
  assert.match(DS160_EXTENDED_MAPPINGS.payer_org_address_postal_na.selector, /cbxDNAPayerPostalZIPCode/);
  assert.match(DS160_EXTENDED_MAPPINGS.mailing_address_state_na.selector, /cbexMAILING_ADDR_STATE_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.mailing_address_postal_na.selector, /cbexMAILING_ADDR_POSTAL_CD_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.secondary_phone_na.selector, /cbexAPP_MOBILE_TEL_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.us_drivers_license_number_unknown.selector, /cbxUS_DRIVER_LICENSE_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.visa_number_unknown.selector, /cbxPREV_VISA_FOIL_NUMBER_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.lost_passport_number_unknown.selector, /cbxLOST_PPT_NUM_UNKN_IND/);
  assert.match(DS160_EXTENDED_MAPPINGS.spouse_address_state_na.selector, /cbexSPOUSE_ADDR_STATE_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.spouse_address_zip_na.selector, /cbexSPOUSE_ADDR_POSTAL_CD_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.prev_employer_state_na.selector, /cbxPREV_EMPL_ADDR_STATE_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.prev_employer_postal_na.selector, /cbxPREV_EMPL_ADDR_POSTAL_CD_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.prev_supervisor_surname_unknown.selector, /cbxSupervisorSurname_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.prev_supervisor_given_names_unknown.selector, /cbxSupervisorGivenName_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.partner_city_of_birth_na.selector, /cbexSPOUSE_POB_CITY_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.partner_address_state_na.selector, /cbexSPOUSE_ADDR_STATE_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.partner_address_zip_na.selector, /cbexSPOUSE_ADDR_POSTAL_CD_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.deceased_spouse_city_of_birth_unknown.selector, /cbxSPOUSE_POB_CITY_NA/);
  assert.match(DS160_EXTENDED_MAPPINGS.former_spouse_city_of_birth_unknown.selector, /DListSpouse_ctl00_cbxSPOUSE_POB_CITY_NA/);

  assert.equal(DS160_EXTENDED_METADATA.payer_address_state_na.seedFieldName, "payer_address_state");
  assert.equal(DS160_EXTENDED_METADATA.payer_org_address_postal_na.seedFieldName, "payer_org_address_postal");
  assert.equal(DS160_EXTENDED_METADATA.us_drivers_license_number_unknown.repeatGroup, "drivers_licenses");
  assert.equal(DS160_EXTENDED_METADATA.lost_passport_number_unknown.repeatGroup, "lost_passport");
  assert.equal(DS160_EXTENDED_METADATA.mailing_address_state_na.condition, "mailing_same_as_home === no");
  assert.equal(DS160_EXTENDED_METADATA.spouse_address_state_na.seedFieldName, "spouse_address_state");
  assert.equal(DS160_EXTENDED_METADATA.spouse_address_zip_na.seedFieldName, "spouse_address_zip");
  assert.equal(DS160_EXTENDED_METADATA.spouse_address_state_na.condition, "spouse_address_type === other");
  assert.equal(DS160_EXTENDED_METADATA.prev_employer_state_na.repeatGroup, "previous_employers");
  assert.equal(DS160_EXTENDED_METADATA.prev_supervisor_given_names_unknown.seedFieldName, "prev_supervisor_given_names");
  assert.equal(DS160_EXTENDED_METADATA.partner_city_of_birth_na.seedFieldName, "partner_city_of_birth");
  assert.equal(DS160_EXTENDED_METADATA.partner_address_state_na.condition, "partner_address_type === other");
  assert.equal(DS160_EXTENDED_METADATA.deceased_spouse_city_of_birth_unknown.condition, "marital_status === widowed");
  assert.equal(DS160_EXTENDED_METADATA.former_spouse_city_of_birth_unknown.repeatGroup, "former_spouses");
  assert.match(DS160_EXTENDED_MAPPINGS.military_date_from_day.selector, /ddlMILITARY_SVC_FROMDay/);
  assert.match(DS160_EXTENDED_MAPPINGS.military_date_from_month.selector, /ddlMILITARY_SVC_FROMMonth/);
  assert.match(DS160_EXTENDED_MAPPINGS.military_date_from_year.selector, /tbxMILITARY_SVC_FROMYear/);
  assert.match(DS160_EXTENDED_MAPPINGS.military_date_to_day.selector, /ddlMILITARY_SVC_TODay/);
  assert.match(DS160_EXTENDED_MAPPINGS.military_date_to_month.selector, /ddlMILITARY_SVC_TOMonth/);
  assert.match(DS160_EXTENDED_MAPPINGS.military_date_to_year.selector, /tbxMILITARY_SVC_TOYear/);
});

test("previous-employment dates preserve official year-only precision", () => {
  const answers: Record<string, string> = {
    prev_employment_start_date: "2019",
    prev_employment_end_date__2: "2020-04",
  };

  deriveDs160ExtendedAnswers(answers);
  assert.equal(answers.prev_employment_start_date_year, "2019");
  assert.equal(answers.prev_employment_start_date_month, undefined);
  assert.equal(answers.prev_employment_start_date_day, undefined);
  assert.equal(answers.prev_employment_end_date_year__2, "2020");
  assert.equal(answers.prev_employment_end_date_month__2, "APR");
  assert.equal(answers.prev_employment_end_date_day__2, undefined);
});

test("partner, deceased-spouse, and former-spouse birthdays preserve year-only precision", () => {
  const answers: Record<string, string> = {
    partner_date_of_birth: "1990",
    deceased_spouse_date_of_birth: "1991-02",
    former_spouse_date_of_birth__2: "1992-03-04",
  };

  deriveDs160ExtendedAnswers(answers);
  assert.equal(answers.partner_date_of_birth_year, "1990");
  assert.equal(answers.partner_date_of_birth_month, undefined);
  assert.equal(answers.partner_date_of_birth_day, undefined);
  assert.equal(answers.deceased_spouse_date_of_birth_year, "1991");
  assert.equal(answers.deceased_spouse_date_of_birth_month, "FEB");
  assert.equal(answers.deceased_spouse_date_of_birth_day, undefined);
  assert.equal(answers.former_spouse_date_of_birth_year__2, "1992");
  assert.equal(answers.former_spouse_date_of_birth_month__2, "MAR");
  assert.equal(answers.former_spouse_date_of_birth_day__2, "04");
});

test("education dates preserve official month-and-year precision", () => {
  const answers: Record<string, string> = {
    education_start_date: "2010-01",
    education_end_date__2: "2015-12",
  };

  deriveDs160ExtendedAnswers(answers);
  assert.equal(answers.education_start_date_year, "2010");
  assert.equal(answers.education_start_date_month, "JAN");
  assert.equal(answers.education_start_date_day, undefined);
  assert.equal(answers.education_end_date_year__2, "2015");
  assert.equal(answers.education_end_date_month__2, "DEC");
  assert.equal(answers.education_end_date_day__2, undefined);
});

test("military service dates preserve official month-and-year precision", () => {
  const answers: Record<string, string> = {
    military_date_from: "2010-01",
    military_date_to__2: "2011-02",
  };

  deriveDs160ExtendedAnswers(answers);
  assert.equal(answers.military_date_from_year, "2010");
  assert.equal(answers.military_date_from_month, "JAN");
  assert.equal(answers.military_date_from_day, undefined);
  assert.equal(answers.military_date_to_year__2, "2011");
  assert.equal(answers.military_date_to_month__2, "FEB");
  assert.equal(answers.military_date_to_day__2, undefined);
});

test("each group is page-stable and every selector includes a label fallback", () => {
  const seen = new Set<string>();
  for (const group of DS160_EXTENDED_MAPPING_GROUPS) {
    for (const [fieldName, mapping] of Object.entries(group.mappings)) {
      assert.equal(seen.has(fieldName), false, `duplicate group mapping: ${fieldName}`);
      seen.add(fieldName);
      assert.equal(group.metadata[fieldName].page, group.page);
      assert.match(mapping.selector, /aria-label/);
      assert.match(mapping.selector, /label:has-text/);
    }
  }
  assert.equal(seen.size, Object.keys(DS160_EXTENDED_MAPPINGS).length);
  assert.equal(Object.keys(DS160_EXTENDED_MAPPINGS).length, Object.keys(DS160_EXTENDED_METADATA).length);
});
