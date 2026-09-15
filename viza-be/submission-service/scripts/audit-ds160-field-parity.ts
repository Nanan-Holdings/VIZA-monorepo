/**
 * DS-160 Field Parity Audit
 *
 * Compares three sources of `field_name` keys to surface drift that would
 * cause user data to be lost between the client form and CEAC autofill:
 *
 *   A) UI form definitions  — viza-be/agent-backend/scripts/seed-ds160-form-fields.ts
 *      (seeds the `visa_form_fields` table that drives /client/application/long-form)
 *   B) Test fixture         — TEST_DS160_ANSWERS in src/ceac/test-ds160-fixture.ts
 *   C) Orchestrator mappings — established ds160*Mappings plus the checked-in
 *      extended branch declarations
 *
 * The orchestrator silently skips fields without a matching answer. So if (C)
 * expects a key the form never captures (A) or the fixture omits (B), user
 * data drops on the floor with no warning.
 *
 * Exit code 0 = internal contract coverage only, never evidence of live CEAC parity.
 * Exit code 1 = missing input, unconsumed form field, or fixture coverage gap.
 *
 * Run: npx ts-node scripts/audit-ds160-field-parity.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { DS160_PREPARER_FIELD_NAMES } from "../src/ceac/signature-fields";

import { TEST_DS160_ANSWERS } from "../src/ceac/test-ds160-fixture";
import { __DERIVATION_TARGETS } from "../src/ds160-derive-answers";
import { DS160_EXTENDED_MAPPING_GROUPS, DS160_EXTENDED_METADATA } from "../src/ds160-extended-mappings";
import { DS160_FIELD_CONTRACTS } from "../src/ds160-field-contract";
import { branchInventory, consumedSourceKeys, deriveKeyCoverage, ds160ConditionMatches, readDs160SeedFields } from "../src/ds160-parity";
import type { FormFieldMapping } from "../src/form-mappings";
import {
  ds160PersonalInfoMappings,
  ds160PersonalInfo2Mappings,
  ds160TravelMappings,
  ds160TravelCompanionsMappings,
  ds160PreviousUsTravelMappings,
  ds160ContactMappings,
  ds160PassportMappings,
  ds160UsContactMappings,
  ds160FamilyRelativesMappings,
  ds160FamilySpouseMappings,
  ds160WorkMappings,
  ds160WorkPreviousMappings,
  ds160WorkAdditionalMappings,
  ds160SecurityBackground1Mappings,
  ds160SecurityBackground2Mappings,
  ds160SecurityBackground3Mappings,
  ds160SecurityBackground4Mappings,
  ds160SecurityBackground5Mappings,
} from "../src/ds160-form-mappings";

const SEED_FILE = path.resolve(
  __dirname,
  "..",
  "..",
  "agent-backend",
  "scripts",
  "seed-ds160-form-fields.ts",
);

function extractFormFieldNames(): { names: Set<string>; gates: Map<string, string> } {
  const fields = readDs160SeedFields(fs.readFileSync(SEED_FILE, "utf8"));
  return {
    names: new Set(fields.map(field => field.name)),
    gates: new Map(fields.flatMap(field => field.showIf ? [[field.name, field.showIf] as const] : [])),
  };
}


const BASE_ORCHESTRATOR_MAPPINGS = {
  personal_information_1: ds160PersonalInfoMappings,
  personal_information_2: ds160PersonalInfo2Mappings,
  travel_information: ds160TravelMappings,
  travel_companions: ds160TravelCompanionsMappings,
  previous_us_travel: ds160PreviousUsTravelMappings,
  address_and_phone: ds160ContactMappings,
  passport: ds160PassportMappings,
  us_contact: ds160UsContactMappings,
  family_relatives: ds160FamilyRelativesMappings,
  family_spouse: ds160FamilySpouseMappings,
  work_education_present: ds160WorkMappings,
  work_education_previous: ds160WorkPreviousMappings,
  work_education_additional: ds160WorkAdditionalMappings,
  security_background_1: ds160SecurityBackground1Mappings,
  security_background_2: ds160SecurityBackground2Mappings,
  security_background_3: ds160SecurityBackground3Mappings,
  security_background_4: ds160SecurityBackground4Mappings,
  security_background_5: ds160SecurityBackground5Mappings,
} as const;

// The extended branch declarations are kept separate from the established
// mapping module so the runtime wiring can be reviewed independently. The
// audit nevertheless evaluates the same page/key union and derivation
// closure, without importing or executing the runtime orchestrator.
const mappingPages = new Map<string, Record<string, FormFieldMapping>>(
  Object.entries(BASE_ORCHESTRATOR_MAPPINGS),
);
for (const group of DS160_EXTENDED_MAPPING_GROUPS) {
  mappingPages.set(group.page, {
    ...(mappingPages.get(group.page) ?? {}),
    ...group.mappings,
  });
}
const ALL_ORCHESTRATOR_MAPPINGS = Object.fromEntries(mappingPages.entries());

// Profile fields are resolved from applicant_profiles, not visa_application_answers.
// answer-loader.ts shapes profile to expose these keys; orchestrator falls back to
// profile[fieldName] when answers[fieldName] is missing. So they don't need a UI
// form question — exclude from the form-coverage gap.
const PROFILE_FALLBACK_KEYS = new Set([
  "surname",
  "given_names",
  "date_of_birth",
  "passport_number",
  "email_address",
]);

// These seed entries are intentionally retained for the internal form
// contract, but their relationship to the live CEAC social-media controls is
// not established by an official DOM capture. Keep them visible in every
// audit result so a zero-consumer gap is never mistaken for live parity.
const UNVERIFIED_SUPPLEMENT_FIELDS = [
  {
    fields: ["has_social_media", "social_media_provider", "social_media_identifier"],
    reason: "supplemental presence/provider/identifier namespace overlaps the repeat social_media_platform/social_media_handle source",
    officialVerified: false,
  },
  {
    fields: ["has_other_social_media", "other_social_media_name", "other_social_media_identifier"],
    reason: "supplemental other-website branch has no official CEAC DOM verification",
    officialVerified: false,
  },
] as const;

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((k) => !b.has(k)).sort();
}

function buildOrchestratorKeySet(): {
  union: Set<string>;
  byPage: Record<string, Set<string>>;
} {
  const union = new Set<string>();
  const byPage: Record<string, Set<string>> = {};
  for (const [page, mappings] of Object.entries(ALL_ORCHESTRATOR_MAPPINGS)) {
    const keys = new Set(Object.keys(mappings));
    byPage[page] = keys;
    for (const k of keys) union.add(k);
  }
  return { union, byPage };
}

function header(title: string): void {
  console.log("\n" + "─".repeat(70));
  console.log(`  ${title}`);
  console.log("─".repeat(70));
}

function reportList(label: string, keys: string[], indent = "  "): void {
  if (keys.length === 0) {
    console.log(`${indent}${label}: 0`);
    return;
  }
  console.log(`${indent}${label}: ${keys.length}`);
  for (const k of keys) console.log(`${indent}  - ${k}`);
}

function isOptionalSeedField(key: string): boolean {
  const contract = DS160_FIELD_CONTRACTS[key];
  if (contract) return !contract.required;
  const metadata = DS160_EXTENDED_METADATA[key];
  return metadata ? !DS160_FIELD_CONTRACTS[metadata.seedFieldName]?.required : false;
}

/**
 * Statically compute the upper bound of derivation outputs given a source
 * key set. The runtime derivation only fires when actual values match
 * (e.g. NA flags fire only when the source value is "DOES_NOT_APPLY"), so
 * a stubbed runtime simulation undercounts. Static analysis answers a
 * different question: "if a user fills the form, can derivation produce
 * key K under any input?" — which is what we need to verify orchestrator
 * coverage.
 */
function applyDerivationsToKeySet(sourceKeys: Set<string>): Set<string> {
  return deriveKeyCoverage(sourceKeys, __DERIVATION_TARGETS);
}

function main(): void {
  const { names: formKeys, gates: formGates } = extractFormFieldNames();
  const fields = readDs160SeedFields(fs.readFileSync(SEED_FILE, "utf8"));
  const fixtureKeys = new Set(Object.keys(TEST_DS160_ANSWERS));
  const { union: orchestratorKeys, byPage } = buildOrchestratorKeySet();
  const formKeysAfterDerive = applyDerivationsToKeySet(formKeys);
  // The orchestrator sees the fixture AFTER deriveDS160Answers runs in
  // answer-loader, so date splits / NA flags / aliases are all available.
  // Compare the post-derivation set, not the raw fixture.
  const fixtureKeysAfterDerive = applyDerivationsToKeySet(fixtureKeys);

  // NA-pair coverage: when the fixture sets the `_na: "Y"` companion, the
  // orchestrator never reads the source key (CEAC's NA checkbox disables
  // the input). So an orchestrator source key with a fixture-side _na flag
  // active is NOT a coverage gap. Same for parent _unknown flags.
  // Symmetrically, when the source key IS set with a real value, OR the
  // fixture provides the equivalent post-derivation outputs (e.g. split
  // date trio in lieu of a single ISO date, or the orchestrator-side alias
  // of a form-side key), the _na flag is correctly absent.
  const naCoveredKeys = new Set<string>();
  const dateSplitByPrefix = new Map(
    __DERIVATION_TARGETS.dateSplits.map((d) => [d.source, d.targetPrefix]),
  );
  const aliasMap = new Map(
    __DERIVATION_TARGETS.keyAliases.map((a) => [a.from, a.to]),
  );
  for (const { source, naKey } of __DERIVATION_TARGETS.naPairs) {
    const naValue = TEST_DS160_ANSWERS[naKey];
    if (naValue === "Y") {
      // NA active: orchestrator skips source field, _na flag drives the
      // checkbox. Both sides covered.
      naCoveredKeys.add(source);
      naCoveredKeys.add(naKey);
      continue;
    }
    // Source covered if fixture has it directly, OR has the split-date trio
    // for a date source, OR has the orchestrator-side alias.
    let sourceCovered = TEST_DS160_ANSWERS[source] !== undefined;
    const prefix = dateSplitByPrefix.get(source);
    if (!sourceCovered && prefix) {
      sourceCovered =
        TEST_DS160_ANSWERS[`${prefix}_day`] !== undefined &&
        TEST_DS160_ANSWERS[`${prefix}_month`] !== undefined &&
        TEST_DS160_ANSWERS[`${prefix}_year`] !== undefined;
    }
    const alias = aliasMap.get(source);
    if (!sourceCovered && alias) {
      sourceCovered = TEST_DS160_ANSWERS[alias] !== undefined;
    }
    if (sourceCovered) naCoveredKeys.add(naKey);
  }

  // Conditional fields whose gate is OFF in the fixture. The orchestrator's
  // mapping covers them, but the form would never render them under fixture
  // inputs — so the fixture omitting them is correct, not a gap.
  const gatedOffKeys = new Set<string>();
  for (const [name, expr] of formGates) {
    if (!ds160ConditionMatches(expr, TEST_DS160_ANSWERS)) gatedOffKeys.add(name);
  }
  // Inactive source fields also make their aliases/date splits inactive.
  const gatedOffDerivedKeys = deriveKeyCoverage(gatedOffKeys, __DERIVATION_TARGETS);
  // consular_post is consumed by session bootstrap rather than a form page.
  // has_social_media drives deriveSocialMediaPresence's NONE provider branch.
  const consumed = consumedSourceKeys(
    [...orchestratorKeys, "consular_post", "has_social_media", ...DS160_PREPARER_FIELD_NAMES],
    __DERIVATION_TARGETS,
  );
  const unconsumedFields = fields.filter(field => !consumed.has(field.name));
  const branches = branchInventory(fields, consumed);
  const repeatGroups = [...new Set(fields.flatMap(field => field.repeatGroup ? [field.repeatGroup] : []))];
  const optionalFixtureInputs = diff(orchestratorKeys, fixtureKeysAfterDerive).filter(
    (key) => isOptionalSeedField(key),
  );
  const missingFromFixture = diff(orchestratorKeys, fixtureKeysAfterDerive).filter(
    (key) => !PROFILE_FALLBACK_KEYS.has(key) && !gatedOffDerivedKeys.has(key) && !naCoveredKeys.has(key),
  ).filter((key) => !isOptionalSeedField(key));
  const optionalFixtureInputsActive = optionalFixtureInputs.filter(
    (key) => !gatedOffDerivedKeys.has(key) && !naCoveredKeys.has(key),
  );
  if (process.argv.includes("--json")) {
    const missingInputs = diff(orchestratorKeys, formKeysAfterDerive).filter(key => !PROFILE_FALLBACK_KEYS.has(key));
    const passed = missingInputs.length === 0 && missingFromFixture.length === 0 && unconsumedFields.length === 0;
    console.log(JSON.stringify({
      scope: "Internal seed-to-runner contract audit; not live CEAC parity verification",
      officialParityVerified: false,
      fieldCount: fields.length,
      mappingCount: orchestratorKeys.size,
      signatureFieldCount: DS160_PREPARER_FIELD_NAMES.length,
      conditionalBranchCount: branches.length,
      repeatGroups,
      missingRunnerInputs: missingInputs,
      missingFixtureInputs: missingFromFixture,
      optionalFixtureInputs: optionalFixtureInputsActive,
      unconsumedFields,
      unverifiedSupplementFields: UNVERIFIED_SUPPLEMENT_FIELDS,
      signatureFields: { fields: DS160_PREPARER_FIELD_NAMES, officialVerified: false },
      branches,
      passed,
    }, null, 2));
    process.exitCode = passed ? 0 : 1;
    return;
  }
  console.log("═".repeat(70));
  console.log("  DS-160 Internal Field/Branch Contract Audit");
  console.log("  Live official-field/options/branch parity: NOT VERIFIED");
  console.log("═".repeat(70));
  console.log(`  UI form fields           (seed-ds160-form-fields.ts) : ${formKeys.size}`);
  console.log(`  Test fixture keys        (TEST_DS160_ANSWERS)        : ${fixtureKeys.size}`);
  console.log(`  Orchestrator mappings    (18 page groups, union)     : ${orchestratorKeys.size}`);

  // Critical gaps: orchestrator expects a key but the form/fixture never produces it.
  // Profile-fallback keys are excluded — answer-loader resolves them from
  // applicant_profiles instead of visa_application_answers.
  const missingFromForm = diff(orchestratorKeys, formKeys).filter(
    (k) => !PROFILE_FALLBACK_KEYS.has(k),
  );
  const missingFromFormAfterDerive = diff(orchestratorKeys, formKeysAfterDerive).filter(
    (k) => !PROFILE_FALLBACK_KEYS.has(k),
  );

  // Reverse coverage is a release-blocking gap, including inactive branches.
  const orphanFormKeys = unconsumedFields.map(field => field.name);
  const orphanFixtureKeys = diff(fixtureKeys, orchestratorKeys);
  const formWithoutFixture = diff(formKeys, fixtureKeys);

  header("CRITICAL — orchestrator keys missing from UI form (raw, pre-derivation)");
  console.log("  Keys expected by CEAC autofill that the seeded form never");
  console.log("  produces directly. Some are bridged by ds160-derive-answers.ts");
  console.log("  (date splits, NA flags, key aliases) — see post-derivation");
  console.log("  result below. The remainder are real form-question gaps.");
  reportList("count", missingFromForm);

  header("CRITICAL — orchestrator keys still missing AFTER derivation");
  console.log("  Run after answer-loader applies deriveDS160Answers(). These");
  console.log("  are the real gaps that require new form questions or new");
  console.log("  derivation rules; the rest are bridged automatically.");
  reportList("count", missingFromFormAfterDerive);

  header("CRITICAL — orchestrator keys missing from test fixture");
  console.log("  These keys are expected by autofill but TEST_DS160_ANSWERS");
  console.log("  omits them. The e2e run silently skips them.");
  reportList("count", missingFromFixture);

  header("INFO — optional orchestrator keys not exercised by test fixture");
  console.log("  These seeded fields are optional and remain absent because the");
  console.log("  fixture intentionally does not invent applicant data.");
  reportList("count", optionalFixtureInputsActive);

  header("INFO — seed supplement semantics pending official CEAC verification");
  for (const supplement of UNVERIFIED_SUPPLEMENT_FIELDS) {
    console.log(`  - ${supplement.fields.join(", ")}`);
    console.log(`    ${supplement.reason}`);
    console.log(`    officialVerified: ${supplement.officialVerified}`);
  }

  header("CRITICAL — form fields with no declared runtime consumer after derivation");
  console.log("  Captured by /application but never read by autofill.");
  console.log("  Either remove from form, or add a mapping group.");
  reportList("count", orphanFormKeys);

  header("INFO — fixture entries with no orchestrator consumer");
  console.log("  Dead test data. Fixture pays storage, autofill never reads.");
  reportList("count", orphanFixtureKeys);

  header("INFO — form fields not exercised by fixture");
  console.log("  /application asks but TEST_DS160_ANSWERS doesn't seed.");
  console.log("  Autofill mapping might exist but isn't covered by the e2e.");
  reportList("count", formWithoutFixture);

  header("Conditional branches and repeat groups");
  console.log(`  Conditional expressions: ${branches.length}`);
  console.log(`  Branches with unmapped fields: ${branches.filter(branch => branch.unmappedFields.length > 0).length}`);
  console.log(`  Repeat groups requiring live add/remove/reload verification: ${repeatGroups.length}`);
  for (const group of repeatGroups) console.log(`    - ${group}`);

  // Per-page breakdown for missing-from-form AFTER derivation — the
  // actionable view, since pre-derivation gaps are bridged automatically.
  if (missingFromFormAfterDerive.length > 0) {
    header("Per-page breakdown — gaps remaining after derivation");
    for (const [page, pageKeys] of Object.entries(byPage)) {
      const gaps = [...pageKeys]
        .filter((k) => !PROFILE_FALLBACK_KEYS.has(k) && !formKeysAfterDerive.has(k))
        .sort();
      if (gaps.length === 0) continue;
      console.log(`\n  ${page}  (${gaps.length} gap${gaps.length === 1 ? "" : "s"})`);
      for (const k of gaps) console.log(`    - ${k}`);
    }
  }

  console.log("\n" + "═".repeat(70));
  // Verdict uses post-derivation form coverage. Pre-derivation count is
  // informational — derivations are a real bridge, not a workaround.
  const critical = missingFromFormAfterDerive.length + missingFromFixture.length + orphanFormKeys.length;
  if (critical === 0) {
    console.log("  PASS — internal contract coverage only; live CEAC parity remains unverified");
    console.log("═".repeat(70));
    process.exit(0);
  } else {
    console.log(
      `  FAIL — ${critical} critical gap${critical === 1 ? "" : "s"} after derivation` +
        ` (form-after-derive: ${missingFromFormAfterDerive.length}, fixture: ${missingFromFixture.length}, unconsumed: ${orphanFormKeys.length})`,
    );
    console.log(
      `         pre-derivation form gap was ${missingFromForm.length}; bridge closed ${missingFromForm.length - missingFromFormAfterDerive.length}`,
    );
    console.log("═".repeat(70));
    process.exit(1);
  }
}

main();
