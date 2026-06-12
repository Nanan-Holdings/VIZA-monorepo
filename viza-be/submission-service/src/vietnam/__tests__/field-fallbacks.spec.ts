import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVnFieldFallback,
  getVnFieldFallbackValue,
} from "../field-mappings.js";

test("vn.field-fallbacks: known fields expose portal-safe defaults", () => {
  assert.equal(getVnFieldFallbackValue("religion"), "NONE");
  assert.equal(getVnFieldFallbackValue("occupation_info"), "NOT APPLICABLE");
  assert.equal(getVnFieldFallbackValue("intended_ward_commune"), "PHUONG MY BINH");
});

test("vn.field-fallbacks: fallback records capture schema feedback", () => {
  const fallback = buildVnFieldFallback({
    fieldName: "religion",
    domId: "basic_ttcnTonGiao",
    type: "text",
    userValue: "无",
    errorMessage: "Portal rejected non-Latin characters",
  });

  assert.deepEqual(fallback, {
    fieldName: "religion",
    domId: "basic_ttcnTonGiao",
    type: "text",
    userValue: "无",
    fallbackValue: "NONE",
    reason: "Portal rejected non-Latin characters",
    schemaRuleSuggestion: {
      pattern: "^[A-Za-z0-9 .,'()/-]+$",
      maxLength: 120,
      fallbackDefault: "NONE",
      normalizeToUppercase: true,
    },
  });
});

test("vn.field-fallbacks: unmapped fields do not invent defaults", () => {
  assert.equal(getVnFieldFallbackValue("passport_number"), null);
});
