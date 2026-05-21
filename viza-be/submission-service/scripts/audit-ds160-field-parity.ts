/**
 * DS-160 Field Parity Audit
 *
 * Compares three sources of `field_name` keys to surface drift that would
 * cause user data to be lost between the client form and CEAC autofill:
 *
 *   A) UI form definitions  — viza-be/agent-backend/scripts/seed-ds160-form-fields.ts
 *      (seeds the `visa_form_fields` table that drives /client/application/long-form)
 *   B) Test fixture         — TEST_DS160_ANSWERS in src/ceac/test-ds160-fixture.ts
 *   C) Orchestrator mappings — every ds160*Mappings export in src/ds160-form-mappings.ts
 *
 * The orchestrator silently skips fields without a matching answer. So if (C)
 * expects a key the form never captures (A) or the fixture omits (B), user
 * data drops on the floor with no warning.
 *
 * Exit code 0 = parity OK (orchestrator fully covered by both form + fixture).
 * Exit code 1 = critical gap (orchestrator key missing from form or fixture).
 *
 * Run: npx ts-node scripts/audit-ds160-field-parity.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { TEST_DS160_ANSWERS } from "../src/ceac/test-ds160-fixture";
import { __DERIVATION_TARGETS } from "../src/ds160-derive-answers";
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
  const text = fs.readFileSync(SEED_FILE, "utf8");
  const names = new Set<string>();
  // field_name -> showIf expression (e.g. "has_telecode === yes")
  const gates = new Map<string, string>();

  // Find every `field_name: "..."` position, then look ahead within that
  // field's object literal scope (up to the next `field_name:` or 4kb,
  // whichever comes first) for the optional `showIf` clause.
  const directRe = /field_name:\s*"([^"]+)"/g;
  const matches: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = directRe.exec(text)) !== null) {
    matches.push({ name: m[1], index: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const { name, index } = matches[i];
    names.add(name);
    const scopeEnd = Math.min(
      i + 1 < matches.length ? matches[i + 1].index : text.length,
      index + 4000,
    );
    const scope = text.slice(index, scopeEnd);
    const showIfMatch = /showIf:\s*"([^"]+)"/.exec(scope);
    if (showIfMatch) gates.set(name, showIfMatch[1]);
  }

  // Steps 17–21 (Security and Background Parts 1–5) declare fields via a
  // flatMap over destructured tuples like ["has_communicable_disease", "Do
  // you ..."]. The flatMap body also generates a paired `${fn}_explain`
  // textarea for each Y/N gate. Match tuples whose first slot looks like a
  // snake_case identifier and emit both the bare key and the explain alias.
  // The explain alias is gated on the bare key being === yes (the flatMap
  // wires it that way uniformly), so register the gate here.
  const tupleRe = /\[\s*"([a-z][a-z0-9_]+)"\s*,\s*"/g;
  while ((m = tupleRe.exec(text)) !== null) {
    const name = m[1];
    if (name.length < 6 || !name.includes("_")) continue;
    names.add(name);
    names.add(`${name}_explain`);
    gates.set(`${name}_explain`, `${name} === yes`);
  }

  return { names, gates };
}

/**
 * Evaluate a `showIf` expression against the fixture. The seed grammar is
 * limited to `key === value` joined by `||`, so we support exactly that.
 * Fixture values use CEAC-side tokens (Y/N, M/F, S/M, ...) while showIf uses
 * form-side tokens (yes/no, male/female, single/married, ...) — we normalize
 * Y→yes, N→no since that's the only mismatch this audit hits today.
 *
 * Returns true (gate active, field expected) only when an alternative
 * explicitly matches a fixture value. If no alternative matches — including
 * the case where the gate's source key isn't set in the fixture at all —
 * the gate is treated as OFF. The fixture is a deliberate test scenario;
 * a missing gate field signals "this branch isn't being exercised."
 */
function evalShowIf(expr: string, fixture: Record<string, string>): boolean {
  const alternatives = expr.split("||").map((s) => s.trim());
  for (const alt of alternatives) {
    const m = /^([a-z_][a-z0-9_]*)\s*===\s*([a-z_][a-z0-9_]*)$/.exec(alt);
    if (!m) return true; // unparseable — assume gate active to be safe
    const [, key, expected] = m;
    const actual = fixture[key];
    if (actual === undefined) continue;
    const normalized = actual === "Y" ? "yes" : actual === "N" ? "no" : actual;
    if (normalized === expected) return true;
  }
  return false;
}

const ALL_ORCHESTRATOR_MAPPINGS = {
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
  const out = new Set(sourceKeys);
  const { dateSplits, naPairs, keyAliases, customDerivations } = __DERIVATION_TARGETS;
  for (const { from, to } of keyAliases) {
    if (out.has(from)) out.add(to);
  }
  for (const { source, targetPrefix } of dateSplits) {
    if (!out.has(source)) continue;
    out.add(`${targetPrefix}_day`);
    out.add(`${targetPrefix}_month`);
    out.add(`${targetPrefix}_year`);
  }
  for (const { source, naKey } of naPairs) {
    if (out.has(source)) out.add(naKey);
  }
  for (const { requires, produces } of customDerivations) {
    if (requires.every((k) => out.has(k))) {
      for (const k of produces) out.add(k);
    }
  }
  return out;
}

function main(): void {
  const { names: formKeys, gates: formGates } = extractFormFieldNames();
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
    if (!evalShowIf(expr, TEST_DS160_ANSWERS)) gatedOffKeys.add(name);
  }
  console.log("═".repeat(70));
  console.log("  DS-160 Field Parity Audit");
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
  const missingFromFixture = diff(orchestratorKeys, fixtureKeysAfterDerive).filter(
    (k) =>
      !PROFILE_FALLBACK_KEYS.has(k) &&
      !gatedOffKeys.has(k) &&
      !naCoveredKeys.has(k),
  );

  // Soft gaps: keys captured/seeded but no autofill consumer.
  const orphanFormKeys = diff(formKeys, orchestratorKeys);
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

  header("INFO — form fields with no orchestrator consumer");
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
  const critical = missingFromFormAfterDerive.length + missingFromFixture.length;
  if (critical === 0) {
    console.log("  PASS — orchestrator fully covered by form + fixture (post-derivation)");
    console.log("═".repeat(70));
    process.exit(0);
  } else {
    console.log(
      `  FAIL — ${critical} critical gap${critical === 1 ? "" : "s"} after derivation` +
        ` (form-after-derive: ${missingFromFormAfterDerive.length}, fixture: ${missingFromFixture.length})`,
    );
    console.log(
      `         pre-derivation form gap was ${missingFromForm.length}; bridge closed ${missingFromForm.length - missingFromFormAfterDerive.length}`,
    );
    console.log("═".repeat(70));
    process.exit(1);
  }
}

main();
