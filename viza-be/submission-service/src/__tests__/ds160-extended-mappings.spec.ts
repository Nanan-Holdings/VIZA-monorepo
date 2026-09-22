import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

import { readDs160SeedFields } from "../ds160-parity";
import { DS160_FIELD_CONTRACTS } from "../ds160-field-contract";
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

test("arrival and departure controls are a conditional single block", () => {
  for (const fieldName of [
    "arrival_flight",
    "arrival_city",
    "departure_flight",
    "departure_city",
  ]) {
    assert.equal(DS160_EXTENDED_METADATA[fieldName].condition, "has_specific_plans === yes");
    assert.equal(DS160_EXTENDED_METADATA[fieldName].repeatGroup, undefined, fieldName);
  }
});

test("former-spouse count and marriage-ended mappings use observed controls", () => {
  assert.equal(DS160_EXTENDED_MAPPINGS.number_of_former_spouses.type, "text");
  assert.match(DS160_EXTENDED_MAPPINGS.number_of_former_spouses.selector, /tbxNumberOfPrevSpouses/);
  assert.equal(DS160_EXTENDED_METADATA.former_spouse_how_marriage_ended.seedType, "textarea");
  assert.match(
    DS160_EXTENDED_MAPPINGS.former_spouse_how_marriage_ended.selector,
    /textarea[^,]*tbxHowMarriageEnded/,
  );
});

test("official explanation fields use their observed textarea controls", () => {
  const seedFields = readDs160SeedFields(readFileSync(SEED_PATH, "utf8"));
  for (const [fieldName, selectorToken] of [
    ["marital_status_other_explain", "tbxOtherMaritalStatus"],
    ["passport_document_type_explain", "tbxPptOtherExpl"],
    ["occupation_other_explain", "tbxExplainOtherPresentOccupation"],
  ] as const) {
    assert.equal(DS160_EXTENDED_METADATA[fieldName].seedType, "textarea", fieldName);
    assert.equal(seedFields.find((field) => field.name === fieldName)?.type, "textarea", fieldName);
    assert.equal(DS160_EXTENDED_METADATA[fieldName].condition !== undefined, true, fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`textarea[^,]*${selectorToken}`));
    assert.equal(DS160_FIELD_CONTRACTS[fieldName].type, "textarea", fieldName);
    assert.equal(DS160_FIELD_CONTRACTS[fieldName].required, true, fieldName);
    assert.equal(DS160_FIELD_CONTRACTS[fieldName].maxLength, 4000, fieldName);
  }
});

test("explanation textarea schema migration preserves answers and mirrors to frontend", () => {
  const backendMigration = readFileSync(join(process.cwd(), "..", "agent-backend", "drizzle", "0205_ds160_explanation_textareas.sql"), "utf8");
  const frontendMigration = readFileSync(join(process.cwd(), "..", "..", "viza-fe", "internal-website", "supabase", "migrations", "20260922020000_ds160_explanation_textareas.sql"), "utf8");
  assert.equal(frontendMigration, backendMigration);
  for (const fieldName of [
    "marital_status_other_explain",
    "passport_document_type_explain",
    "occupation_other_explain",
  ]) {
    assert.ok(backendMigration.includes(`'${fieldName}'`), fieldName);
    assert.match(backendMigration, /field_type = 'textarea'/, fieldName);
  }
  assert.doesNotMatch(backendMigration, /visa_application_answers|DELETE\s+FROM/i);
});

test("live exact tokens replace semantic candidates while preserving page and row context", () => {
  const expectations = [
    {
      fieldName: "other_surname",
      token: "tbxSURNAME",
      condition: "other_names_used === yes",
      forbidden: ["APP_OTHER_SURNAME", "OTHER_SURNAME"],
    },
    {
      fieldName: "other_given_names",
      token: "tbxGIVEN_NAME",
      condition: "other_names_used === yes",
      forbidden: ["APP_OTHER_GIVEN_NAME", "OTHER_GIVEN_NAME"],
    },
    {
      fieldName: "companion_surname",
      token: "tbxSurname",
      condition: "companion_group_travel === no",
      repeatGroup: "companions",
      forbidden: ["TRAVEL_COMPANION_SURNAME", "COMPANION_SURNAME", "tbxCompanionSurname"],
    },
    {
      fieldName: "companion_given_names",
      token: "tbxGivenName",
      condition: "companion_group_travel === no",
      repeatGroup: "companions",
      forbidden: ["TRAVEL_COMPANION_GIVEN_NAME", "COMPANION_GIVEN_NAME", "tbxCompanionGivenName"],
    },
    {
      fieldName: "companion_relationship",
      token: "ddlTCRelationship",
      condition: "companion_group_travel === no",
      repeatGroup: "companions",
      forbidden: ["TRAVEL_COMPANION_REL", "COMPANION_RELATIONSHIP", "ddlCompanionRelationship"],
    },
    {
      fieldName: "us_relative_relationship",
      token: "ddlUS_REL_TYPE",
      condition: "has_immediate_us_relatives === yes",
      repeatGroup: "us_relatives",
      forbidden: ["US_RELATIVE_REL", "US_REL_RELATIONSHIP", "ddlUS_REL_REL"],
    },
    {
      fieldName: "us_relative_status",
      token: "ddlUS_REL_STATUS",
      condition: "has_immediate_us_relatives === yes",
      repeatGroup: "us_relatives",
      forbidden: ["US_RELATIVE_STATUS", "US_REL_STATUS"],
    },
    {
      fieldName: "not_employed_explain",
      token: "tbxExplainOtherPresentOccupation",
      condition: "primary_occupation === not_employed",
      forbidden: ["WORK_EDUC_PRSNT_NOT_EMPLOYED_EXPLAIN", "NOT_EMPLOYED_EXPLAIN", "tbxNOT_EMPLOYED_EXPLAIN"],
    },
    {
      fieldName: "payer_address_street1",
      token: "tbxPayerStreetAddress1",
      condition: "payer_address_same_as_home === no",
      forbidden: ["PAYER_ADDR_LN1", "TRAVEL_PAYER_ADDR_LN1"],
    },
    {
      fieldName: "payer_address_street2",
      token: "tbxPayerStreetAddress2",
      condition: "payer_address_same_as_home === no",
      forbidden: ["PAYER_ADDR_LN2", "TRAVEL_PAYER_ADDR_LN2"],
    },
    {
      fieldName: "payer_address_city",
      token: "tbxPayerCity",
      condition: "payer_address_same_as_home === no",
      forbidden: ["PAYER_ADDR_CITY", "TRAVEL_PAYER_ADDR_CITY"],
    },
    {
      fieldName: "payer_address_state",
      token: "tbxPayerStateProvince",
      condition: "payer_address_same_as_home === no",
      forbidden: ["PAYER_ADDR_STATE", "TRAVEL_PAYER_ADDR_STATE"],
    },
    {
      fieldName: "payer_address_postal",
      token: "tbxPayerPostalZIPCode",
      condition: "payer_address_same_as_home === no",
      forbidden: ["PAYER_ADDR_POSTAL", "TRAVEL_PAYER_ADDR_POSTAL", "PAYER_ADDR_ZIP"],
    },
    {
      fieldName: "payer_address_country",
      token: "ddlPayerCountry",
      condition: "payer_address_same_as_home === no",
      forbidden: ["PAYER_ADDR_COUNTRY", "TRAVEL_PAYER_ADDR_COUNTRY"],
    },
    {
      fieldName: "payer_org_name",
      token: "tbxPayingCompany",
      condition: "trip_payer_type === other_company",
      forbidden: ["PAYER_ORG_NAME", "TRAVEL_PAYER_ORG_NAME"],
    },
    {
      fieldName: "payer_org_address_street1",
      token: "tbxPayerStreetAddress1",
      condition: "trip_payer_type === other_company",
      forbidden: ["PAYER_ORG_ADDR_LN1", "TRAVEL_PAYER_ORG_ADDR_LN1"],
    },
    {
      fieldName: "payer_org_address_street2",
      token: "tbxPayerStreetAddress2",
      condition: "trip_payer_type === other_company",
      forbidden: ["PAYER_ORG_ADDR_LN2", "TRAVEL_PAYER_ORG_ADDR_LN2"],
    },
    {
      fieldName: "payer_org_address_city",
      token: "tbxPayerCity",
      condition: "trip_payer_type === other_company",
      forbidden: ["PAYER_ORG_ADDR_CITY", "TRAVEL_PAYER_ORG_ADDR_CITY"],
    },
    {
      fieldName: "payer_org_address_state",
      token: "tbxPayerStateProvince",
      condition: "trip_payer_type === other_company",
      forbidden: ["PAYER_ORG_ADDR_STATE", "TRAVEL_PAYER_ORG_ADDR_STATE"],
    },
    {
      fieldName: "payer_org_address_postal",
      token: "tbxPayerPostalZIPCode",
      condition: "trip_payer_type === other_company",
      forbidden: ["PAYER_ORG_ADDR_POSTAL", "TRAVEL_PAYER_ORG_ADDR_POSTAL", "PAYER_ORG_ADDR_ZIP"],
    },
    {
      fieldName: "payer_org_address_country",
      token: "ddlPayerCountry",
      condition: "trip_payer_type === other_company",
      forbidden: ["PAYER_ORG_ADDR_COUNTRY", "TRAVEL_PAYER_ORG_ADDR_COUNTRY"],
    },
    {
      fieldName: "spouse_country_of_birth",
      token: "ddlSpousePOBCountry",
      condition: "marital_status === married || marital_status === legally_separated || marital_status === common_law",
      forbidden: ["SPOUSE_POB_CNTRY", "SPOUSE_COUNTRY_OF_BIRTH", "ddlSPOUSE_POB_CNTRY"],
    },
    {
      fieldName: "spouse_address_country",
      token: "ddlSPOUSE_ADDR_CNTRY",
      condition: "spouse_address_type === other",
      forbidden: ["SPOUSE_ADDR_COUNTRY", "SPOUSE_ADDRESS_COUNTRY"],
    },
    {
      fieldName: "partner_surname",
      token: "tbxSpouseSurname",
      condition: "marital_status === civil_union",
      forbidden: ["PARTNER_SURNAME", "PARTNER_SURNAMES"],
    },
    {
      fieldName: "partner_given_names",
      token: "tbxSpouseGivenName",
      condition: "marital_status === civil_union",
      forbidden: ["PARTNER_GIVEN_NAME", "PARTNER_GIVEN_NAMES"],
    },
    {
      fieldName: "partner_nationality",
      token: "ddlSpouseNatDropDownList",
      condition: "marital_status === civil_union",
      forbidden: ["PARTNER_NATL", "PARTNER_NATIONALITY"],
    },
    {
      fieldName: "partner_city_of_birth",
      token: "tbxSpousePOBCity",
      condition: "marital_status === civil_union",
      forbidden: ["PARTNER_POB_CITY", "PARTNER_CITY_OF_BIRTH"],
    },
    {
      fieldName: "partner_country_of_birth",
      token: "ddlSpousePOBCountry",
      condition: "marital_status === civil_union",
      forbidden: ["PARTNER_POB_CNTRY", "PARTNER_COUNTRY_OF_BIRTH"],
    },
    {
      fieldName: "partner_address_type",
      token: "ddlSpouseAddressType",
      condition: "marital_status === civil_union",
      forbidden: ["PARTNER_ADDR_TYPE", "PARTNER_ADDRESS_TYPE"],
    },
    {
      fieldName: "partner_address_street1",
      token: "tbxSPOUSE_ADDR_LN1",
      condition: "partner_address_type === other",
      forbidden: ["PARTNER_ADDR_LN1", "PARTNER_ADDRESS_LN1"],
    },
    {
      fieldName: "partner_address_street2",
      token: "tbxSPOUSE_ADDR_LN2",
      condition: "partner_address_type === other",
      forbidden: ["PARTNER_ADDR_LN2", "PARTNER_ADDRESS_LN2"],
    },
    {
      fieldName: "partner_address_city",
      token: "tbxSPOUSE_ADDR_CITY",
      condition: "partner_address_type === other",
      forbidden: ["PARTNER_ADDR_CITY", "PARTNER_ADDRESS_CITY"],
    },
    {
      fieldName: "partner_address_state",
      token: "tbxSPOUSE_ADDR_STATE",
      condition: "partner_address_type === other",
      forbidden: ["PARTNER_ADDR_STATE", "PARTNER_ADDRESS_STATE"],
    },
    {
      fieldName: "partner_address_zip",
      token: "tbxSPOUSE_ADDR_POSTAL_CD",
      condition: "partner_address_type === other",
      forbidden: ["PARTNER_ADDR_POSTAL", "PARTNER_ADDRESS_POSTAL", "PARTNER_ADDR_ZIP"],
    },
    {
      fieldName: "partner_address_country",
      token: "ddlSPOUSE_ADDR_CNTRY",
      condition: "partner_address_type === other",
      forbidden: ["PARTNER_ADDR_COUNTRY", "PARTNER_ADDRESS_COUNTRY"],
    },
  ] as const;

  for (const expectation of expectations) {
    const mapping = DS160_EXTENDED_MAPPINGS[expectation.fieldName];
    const metadata = DS160_EXTENDED_METADATA[expectation.fieldName];
    assert.ok(mapping, expectation.fieldName);
    assert.ok(metadata, expectation.fieldName);
    assert.equal(metadata.condition, expectation.condition, expectation.fieldName);
    assert.match(mapping.selector, new RegExp(`\\[id\\*="${expectation.token}"\\]`), expectation.fieldName);
    assert.match(mapping.selector, new RegExp(`\\[name\\*="${expectation.token}"\\]`), expectation.fieldName);
    for (const token of expectation.forbidden) {
      const escapedToken = token.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");
      assert.doesNotMatch(
        mapping.selector,
        new RegExp(`\\[(?:id|name)\\*="${escapedToken}"\\]`),
        `${expectation.fieldName} retained unproven token ${token}`,
      );
    }
    if ("repeatGroup" in expectation) {
      assert.equal(metadata.repeatGroup, expectation.repeatGroup, expectation.fieldName);
    } else {
      assert.equal(metadata.repeatGroup, undefined, expectation.fieldName);
    }
  }

  assert.equal(DS160_EXTENDED_METADATA.not_employed_explain.seedType, "textarea");
  assert.match(
    DS160_EXTENDED_MAPPINGS.not_employed_explain.selector,
    /textarea[^,]*tbxExplainOtherPresentOccupation/,
  );
});

test("partner birthday uses the observed shared spouse date controls", () => {
  for (const [part, token] of [
    ["day", "ddlDOBDay"],
    ["month", "ddlDOBMonth"],
    ["year", "tbxDOBYear"],
  ] as const) {
    const fieldName = `partner_date_of_birth_${part}`;
    assert.equal(DS160_EXTENDED_METADATA[fieldName].derivedFrom, "partner_date_of_birth");
    assert.equal(DS160_EXTENDED_METADATA[fieldName].derivedPart, part);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
  }
});

test("fresh security explanation controls stay distinct when official control names share a prefix", async () => {
  const expectations = [
    ["has_communicable_disease_explain", "tbxDisease", "has_communicable_disease"],
    ["has_physical_mental_disorder_explain", "tbxDisorder", "has_physical_mental_disorder"],
    ["is_drug_abuser_explain", "tbxDruguser", "is_drug_abuser"],
    ["has_arrest_conviction_explain", "tbxArrested", "has_arrest_conviction"],
    ["has_violated_controlled_substance_explain", "tbxControlledSubstances", "has_violated_controlled_substance"],
    ["has_prostitution_explain", "tbxProstitution", "has_prostitution"],
    ["has_money_laundering_explain", "tbxMoneyLaundering", "has_money_laundering"],
    ["has_human_trafficking_explain", "tbxHumanTrafficking", "has_human_trafficking"],
    ["has_aided_human_trafficking_explain", "tbxAssistedSevereTrafficking", "has_aided_human_trafficking"],
    ["has_trafficking_beneficiary_explain", "tbxHumanTraffickingRelated", "has_trafficking_beneficiary"],
    ["intend_illegal_activity_explain", "tbxIllegalActivity", "intend_illegal_activity"],
    ["intend_terrorist_activity_explain", "tbxTerroristActivity", "intend_terrorist_activity"],
    ["has_provided_terrorist_support_explain", "tbxTerroristSupport", "has_provided_terrorist_support"],
    ["is_terrorist_member_explain", "tbxTerroristOrg", "is_terrorist_member"],
    ["is_terrorist_family_explain", "tbxTerroristRel", "is_terrorist_family"],
    ["has_genocide_explain", "tbxGenocide", "has_genocide"],
    ["has_torture_explain", "tbxTorture", "has_torture"],
    ["has_extrajudicial_killings_explain", "tbxExViolence", "has_extrajudicial_killings"],
    ["has_child_soldier_explain", "tbxChildSoldier", "has_child_soldier"],
    ["has_religious_freedom_violation_explain", "tbxReligiousFreedom", "has_religious_freedom_violation"],
    ["has_population_control_explain", "tbxPopulationControls", "has_population_control"],
    ["has_coercive_transplant_explain", "tbxTransplant", "has_coercive_transplant"],
    ["has_immigration_fraud_explain", "tbxImmigrationFraud", "has_immigration_fraud"],
    ["has_removal_order_explain", "tbxDeport_EXPL", "has_removal_order"],
    ["has_withheld_child_custody_explain", "tbxChildCustody", "has_withheld_child_custody"],
    ["has_voted_illegally_explain", "tbxVotingViolation", "has_voted_illegally"],
    ["has_renounced_citizenship_explain", "tbxRenounceExp", "has_renounced_citizenship"],
  ] as const;

  assert.equal(expectations.length, 27);
  for (const [fieldName, token, controller] of expectations) {
    const mapping = DS160_EXTENDED_MAPPINGS[fieldName];
    const metadata = DS160_EXTENDED_METADATA[fieldName];
    assert.equal(metadata.seedType, "textarea", fieldName);
    assert.equal(metadata.condition, `${controller} === yes`, fieldName);
    assert.ok(mapping.selector.includes(`textarea[id$="${token}"]`), fieldName);
    assert.ok(mapping.selector.includes(`textarea[name$="${token}"]`), fieldName);
    assert.doesNotMatch(mapping.selector, /SECURITY_PART|_EXPLAIN/);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(expectations.map(([, token]) =>
      `<textarea id="ctl00_SiteContentPlaceHolder_FormView1_${token}" name="ctl00$SiteContentPlaceHolder$FormView1$${token}"></textarea>`,
    ).join("\n"));
    for (const [fieldName, token] of expectations) {
      const control = page.locator(DS160_EXTENDED_MAPPINGS[fieldName].selector);
      assert.equal(await control.count(), 1, `${fieldName} must select only its own explanation`);
      await control.fill(fieldName);
      assert.equal(await page.locator(`[id$="${token}"]`).inputValue(), fieldName);
    }
    // The shorter control name previously also selected this distinct question.
    assert.equal(await page.locator('[id$="tbxHumanTrafficking"]').inputValue(), "has_human_trafficking_explain");
    assert.equal(await page.locator('[id$="tbxHumanTraffickingRelated"]').inputValue(), "has_trafficking_beneficiary_explain");
  } finally {
    await browser.close();
  }
});

test("fresh deceased/former spouse controls preserve branch and repeat-row scope", () => {
  const exact = [
    ["deceased_spouse_surname", "tbxSURNAME", "marital_status === widowed", undefined],
    ["deceased_spouse_given_names", "tbxGIVEN_NAME", "marital_status === widowed", undefined],
    ["deceased_spouse_nationality", "ddlSpouseNatDropDownList", "marital_status === widowed", undefined],
    ["deceased_spouse_city_of_birth", "tbxSpousePOBCity", "marital_status === widowed", undefined],
    ["deceased_spouse_country_of_birth", "ddlSpousePOBCountry", "marital_status === widowed", undefined],
    ["former_spouse_surname", "tbxSURNAME", "marital_status === divorced", "former_spouses"],
    ["former_spouse_given_names", "tbxGIVEN_NAME", "marital_status === divorced", "former_spouses"],
    ["former_spouse_nationality", "ddlSpouseNatDropDownList", "marital_status === divorced", "former_spouses"],
    ["former_spouse_city_of_birth", "tbxSpousePOBCity", "marital_status === divorced", "former_spouses"],
    ["former_spouse_country_of_birth", "ddlSpousePOBCountry", "marital_status === divorced", "former_spouses"],
    ["former_spouse_how_marriage_ended", "tbxHowMarriageEnded", "marital_status === divorced", "former_spouses"],
    ["former_spouse_country_marriage_terminated", "ddlMarriageEnded_CNTRY", "marital_status === divorced", "former_spouses"],
  ] as const;
  for (const [fieldName, token, condition, repeatGroup] of exact) {
    const mapping = DS160_EXTENDED_MAPPINGS[fieldName];
    const metadata = DS160_EXTENDED_METADATA[fieldName];
    assert.equal(metadata.condition, condition, fieldName);
    assert.equal(metadata.repeatGroup, repeatGroup, fieldName);
    assert.match(mapping.selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(mapping.selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
  }

  assert.match(DS160_EXTENDED_MAPPINGS.number_of_former_spouses.selector, /\[id\*="tbxNumberOfPrevSpouses"\]/);
  assert.match(DS160_EXTENDED_MAPPINGS.deceased_spouse_city_of_birth_unknown.selector, /\[id\*="cbxSPOUSE_POB_CITY_NA"\]/);
  assert.match(DS160_EXTENDED_MAPPINGS.former_spouse_city_of_birth_unknown.selector, /\[id\*="cbxSPOUSE_POB_CITY_NA"\]/);
  assert.equal(DS160_EXTENDED_METADATA.former_spouse_how_marriage_ended.seedType, "textarea");
  assert.match(DS160_EXTENDED_MAPPINGS.former_spouse_how_marriage_ended.selector, /textarea[^,]*tbxHowMarriageEnded/);

  for (const [fieldName, token, repeatGroup] of [
    ["deceased_spouse_date_of_birth_day", "ddlDOBDay", undefined],
    ["deceased_spouse_date_of_birth_month", "ddlDOBMonth", undefined],
    ["deceased_spouse_date_of_birth_year", "tbxDOBYear", undefined],
    ["former_spouse_date_of_birth_day", "ddlDOBDay", "former_spouses"],
    ["former_spouse_date_of_birth_month", "ddlDOBMonth", "former_spouses"],
    ["former_spouse_date_of_birth_year", "tbxDOBYear", "former_spouses"],
    ["former_spouse_date_of_marriage_day", "ddlDomDay", "former_spouses"],
    ["former_spouse_date_of_marriage_month", "ddlDomMonth", "former_spouses"],
    ["former_spouse_date_of_marriage_year", "txtDomYear", "former_spouses"],
    ["former_spouse_date_marriage_ended_day", "ddlDomEndDay", "former_spouses"],
    ["former_spouse_date_marriage_ended_month", "ddlDomEndMonth", "former_spouses"],
    ["former_spouse_date_marriage_ended_year", "txtDomEndYear", "former_spouses"],
  ] as const) {
    assert.equal(DS160_EXTENDED_METADATA[fieldName].repeatGroup, repeatGroup, fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
  }
});

test("fresh previous-employment controls use row-scoped suffix tokens", () => {
  const exact = [
    ["prev_employer_address_street1", "tbEmployerStreetAddress1", "text"],
    ["prev_employer_address_street2", "tbEmployerStreetAddress2", "text"],
    ["prev_employer_city", "tbEmployerCity", "text"],
    ["prev_employer_state", "tbxPREV_EMPL_ADDR_STATE", "text"],
    ["prev_employer_postal", "tbxPREV_EMPL_ADDR_POSTAL_CD", "text"],
    ["prev_employer_phone", "tbEmployerPhone", "text"],
    ["prev_job_title", "tbJobTitle", "text"],
    ["prev_supervisor_surname", "tbSupervisorSurname", "text"],
    ["prev_supervisor_given_names", "tbSupervisorGivenName", "text"],
    ["prev_job_duties", "tbDescribeDuties", "textarea"],
    ["prev_employer_country", "DropDownList2", "select"],
  ] as const;
  for (const [fieldName, token, seedType] of exact) {
    const mapping = DS160_EXTENDED_MAPPINGS[fieldName];
    const metadata = DS160_EXTENDED_METADATA[fieldName];
    assert.equal(metadata.condition, "has_previous_employer === yes", fieldName);
    assert.equal(metadata.repeatGroup, "previous_employers", fieldName);
    assert.equal(metadata.seedType, seedType, fieldName);
    assert.match(mapping.selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(mapping.selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
    if (seedType === "textarea") assert.match(mapping.selector, /textarea/);
  }

  for (const [fieldName, token] of [
    ["prev_employment_start_date_day", "ddlEmpDateFromDay"],
    ["prev_employment_start_date_month", "ddlEmpDateFromMonth"],
    ["prev_employment_start_date_year", "tbxEmpDateFromYear"],
    ["prev_employment_end_date_day", "ddlEmpDateToDay"],
    ["prev_employment_end_date_month", "ddlEmpDateToMonth"],
    ["prev_employment_end_date_year", "tbxEmpDateToYear"],
  ] as const) {
    assert.equal(DS160_EXTENDED_METADATA[fieldName].repeatGroup, "previous_employers", fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
  }
});

test("fresh additional phone and email controls use repeat-row suffixes", () => {
  for (const [fieldName, token, condition, repeatGroup] of [
    ["secondary_phone", "tbxAPP_MOBILE_TEL", undefined, undefined],
    ["additional_phone", "tbxAddPhoneInfo", "has_other_phones === yes", "additional_phones"],
    ["additional_email", "tbxAddEmailInfo", "has_other_emails === yes", "additional_emails"],
    ["payer_org_phone", "tbxPayerPhone", "trip_payer_type === other_company", undefined],
  ] as const) {
    const mapping = DS160_EXTENDED_MAPPINGS[fieldName];
    const metadata = DS160_EXTENDED_METADATA[fieldName];
    assert.equal(metadata.condition, condition, fieldName);
    assert.equal(metadata.repeatGroup, repeatGroup, fieldName);
    assert.match(mapping.selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(mapping.selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
  }
});

test("remaining live controls use exact IDs with their branch and repeat scope", () => {
  const exact = [
    ["other_nationality_country", "ddlOTHER_NATL", "other_nationality === yes", "other_nationality"],
    ["other_nationality_has_passport", "rblOTHER_PPT_IND", "other_nationality === yes", "other_nationality"],
    ["other_nationality_passport_number", "tbxOTHER_PPT_NUM", "other_nationality_has_passport === yes", "other_nationality"],
    ["other_permanent_resident_country", "ddlOthPermResCntry", "permanent_resident_other_country === yes", "permanent_resident"],
    ["arrival_flight", "tbxArriveFlight", "has_specific_plans === yes", undefined],
    ["arrival_city", "tbxArriveCity", "has_specific_plans === yes", undefined],
    ["departure_flight", "tbxDepartFlight", "has_specific_plans === yes", undefined],
    ["departure_city", "tbxDepartCity", "has_specific_plans === yes", undefined],
    ["payer_address_same_as_home", "rblPayerAddrSameAsInd", "trip_payer_type === other_person", undefined],
    ["previous_visit_length_of_stay", "tbxPREV_US_VISIT_LOS", "has_been_in_us === yes", "previous_visits"],
    ["previous_visit_length_of_stay_unit", "ddlPREV_US_VISIT_LOS_CD", "has_been_in_us === yes", "previous_visits"],
    ["has_us_drivers_license", "rblPREV_US_DRIVER_LIC_IND", "has_been_in_us === yes", undefined],
    ["us_drivers_license_number", "tbxUS_DRIVER_LICENSE", "has_us_drivers_license === yes", "drivers_licenses"],
    ["us_drivers_license_state", "ddlUS_DRIVER_LICENSE_STATE", "has_us_drivers_license === yes", "drivers_licenses"],
    ["last_visa_issue_day", "ddlPREV_VISA_ISSUED_DTEDay", "has_us_visa === yes", undefined],
    ["last_visa_issue_month", "ddlPREV_VISA_ISSUED_DTEMonth", "has_us_visa === yes", undefined],
    ["last_visa_issue_year", "tbxPREV_VISA_ISSUED_DTEYear", "has_us_visa === yes", undefined],
    ["has_been_ten_printed", "rblPREV_VISA_TEN_PRINT_IND", "has_us_visa === yes", undefined],
    ["visa_lost_or_stolen_explain", "tbxPREV_VISA_LOST_EXPL", "visa_lost_or_stolen === yes", undefined],
    ["visa_cancelled_or_revoked_explain", "tbxPREV_VISA_CANCELLED_EXPL", "visa_cancelled_or_revoked === yes", undefined],
    ["refusal_explain", "tbxPREV_VISA_REFUSED_EXPL", "has_been_refused === yes", "visa_refused"],
    ["immigrant_petition_explain", "tbxIV_PETITION_EXPL", "immigrant_petition_filed === yes", "immigrant_petition"],
    ["mailing_address_line1", "tbxMAILING_ADDR_LN1", "mailing_same_as_home === no", undefined],
    ["mailing_address_line2", "tbxMAILING_ADDR_LN2", "mailing_same_as_home === no", undefined],
    ["mailing_address_city", "tbxMAILING_ADDR_CITY", "mailing_same_as_home === no", undefined],
    ["mailing_address_state", "tbxMAILING_ADDR_STATE", "mailing_same_as_home === no", undefined],
    ["mailing_address_postal", "tbxMAILING_ADDR_POSTAL_CD", "mailing_same_as_home === no", undefined],
    ["mailing_address_country", "ddlMailCountry", "mailing_same_as_home === no", undefined],
    ["other_social_media_name", "tbxAddSocialPlat", "has_other_social_media === yes", "other_social_media"],
    ["other_social_media_identifier", "tbxAddSocialHand", "has_other_social_media === yes", "other_social_media"],
    ["lost_passport_country", "ddlLOST_PPT_NATL", "lost_passport === yes", "lost_passport"],
    ["lost_passport_explain", "tbxLOST_PPT_EXPL", "lost_passport === yes", "lost_passport"],
    ["military_country", "ddlMILITARY_SVC_CNTRY", "has_served_military === yes", "military_service"],
    ["military_branch", "tbxMILITARY_SVC_BRANCH", "has_served_military === yes", "military_service"],
    ["military_rank", "tbxMILITARY_SVC_RANK", "has_served_military === yes", "military_service"],
    ["military_specialty", "tbxMILITARY_SVC_SPECIALTY", "has_served_military === yes", "military_service"],
    ["paramilitary_explain", "tbxINSURGENT_ORG_EXPL", "has_served_paramilitary === yes", undefined],
  ] as const;

  for (const [fieldName, token, condition, repeatGroup] of exact) {
    const mapping = DS160_EXTENDED_MAPPINGS[fieldName];
    const metadata = DS160_EXTENDED_METADATA[fieldName];
    assert.equal(metadata.condition, condition, fieldName);
    assert.equal(metadata.repeatGroup, repeatGroup, fieldName);
    assert.match(mapping.selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(mapping.selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
  }

  for (const [fieldName, token] of [
    ["previous_visit_date_arrived_day", "ddlPREV_US_VISIT_DTEDay"],
    ["previous_visit_date_arrived_month", "ddlPREV_US_VISIT_DTEMonth"],
    ["previous_visit_date_arrived_year", "tbxPREV_US_VISIT_DTEYear"],
  ] as const) {
    assert.equal(DS160_EXTENDED_METADATA[fieldName].repeatGroup, "previous_visits", fieldName);
    assert.equal(DS160_EXTENDED_METADATA[fieldName].derivedFrom, "previous_visit_date_arrived", fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[id\\*="${token}"\\]`), fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`\\[name\\*="${token}"\\]`), fieldName);
  }

  for (const [fieldName, token] of [
    ["visa_lost_or_stolen_explain", "tbxPREV_VISA_LOST_EXPL"],
    ["visa_cancelled_or_revoked_explain", "tbxPREV_VISA_CANCELLED_EXPL"],
    ["refusal_explain", "tbxPREV_VISA_REFUSED_EXPL"],
    ["immigrant_petition_explain", "tbxIV_PETITION_EXPL"],
    ["lost_passport_explain", "tbxLOST_PPT_EXPL"],
    ["paramilitary_explain", "tbxINSURGENT_ORG_EXPL"],
  ] as const) {
    assert.equal(DS160_EXTENDED_METADATA[fieldName].seedType, "textarea", fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`textarea[^,]*\\[id\\*="${token}"\\]`), fieldName);
    assert.match(DS160_EXTENDED_MAPPINGS[fieldName].selector, new RegExp(`textarea[^,]*\\[name\\*="${token}"\\]`), fieldName);
  }

  assert.equal(DS160_EXTENDED_METADATA.payer_org_relationship.condition, "trip_payer_type === other_company");
  assert.match(DS160_EXTENDED_MAPPINGS.payer_org_relationship.selector, /\[id\*="tbxCompanyRelation"\]/);
  assert.match(DS160_EXTENDED_MAPPINGS.payer_org_relationship.selector, /\[name\*="tbxCompanyRelation"\]/);
  assert.doesNotMatch(DS160_EXTENDED_MAPPINGS.payer_org_relationship.selector, /PAYER_ORG_REL|tbxPayingCompany/);
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
  assert.match(DS160_EXTENDED_MAPPINGS.former_spouse_city_of_birth_unknown.selector, /cbxSPOUSE_POB_CITY_NA/);

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
