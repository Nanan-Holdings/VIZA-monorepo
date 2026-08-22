import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  IN_AFFIRMATIVE_CONFIRMATIONS,
  IN_CONDITIONAL_REQUIRED_FIELDS,
  IN_UNCONDITIONAL_REQUIRED_FIELDS,
} from "../in/preflight.js";
import {
  TR_AFFIRMATIVE_CONFIRMATIONS,
  TR_CONDITIONAL_REQUIRED_FIELDS,
  TR_UNCONDITIONAL_REQUIRED_FIELDS,
} from "../tr/preflight.js";

interface SeedFieldContract {
  required: boolean;
  conditional: boolean;
}

function parseSeedFields(relativePath: string): Map<string, SeedFieldContract> {
  const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
  const starts = [...source.matchAll(/field_name:\s*"([^"]+)"/g)];
  return new Map(starts.map((match, index) => {
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? source.length;
    const block = source.slice(start, end);
    const required = block.match(/required:\s*(true|false)/)?.[1] === "true";
    return [match[1], { required, conditional: /conditional_logic\s*:/.test(block) }];
  }));
}

function assertRequiredFields(
  schema: Map<string, SeedFieldContract>,
  fields: readonly string[],
  conditional: boolean,
) {
  for (const field of fields) {
    assert.ok(schema.has(field), `seed is missing runner field ${field}`);
    assert.equal(schema.get(field)?.required, true, `${field} must be required in the seed`);
    assert.equal(schema.get(field)?.conditional, conditional, `${field} conditional parity drifted`);
  }
}

test("Türkiye and India answer schemas stay in parity with live preflight", () => {
  const tr = parseSeedFields("../agent-backend/scripts/seed-tr-e-visa-form-fields.ts");
  const india = parseSeedFields("../agent-backend/scripts/seed-in-e-visa-form-fields.ts");

  assertRequiredFields(tr, TR_UNCONDITIONAL_REQUIRED_FIELDS, false);
  assertRequiredFields(tr, TR_AFFIRMATIVE_CONFIRMATIONS, false);
  assertRequiredFields(tr, TR_CONDITIONAL_REQUIRED_FIELDS.visa, true);
  assertRequiredFields(tr, TR_CONDITIONAL_REQUIRED_FIELDS.residence_permit, true);

  assertRequiredFields(india, IN_UNCONDITIONAL_REQUIRED_FIELDS, false);
  assertRequiredFields(india, IN_AFFIRMATIVE_CONFIRMATIONS, false);
  for (const [, , fields] of IN_CONDITIONAL_REQUIRED_FIELDS) {
    assertRequiredFields(india, fields, true);
  }

  assert.equal(tr.has("confirm_turkiye_official_application_creation"), false);
  assert.equal(india.has("confirm_india_official_application_creation"), false);
});
