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

  assert.equal(consumers.length, 177);
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
