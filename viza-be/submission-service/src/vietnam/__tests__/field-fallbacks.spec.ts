import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVnFieldFallback,
  getVnPortalOptionText,
  getVnFieldFallbackValue,
} from "../field-mappings.js";

test("vn.field-fallbacks: known fields expose portal-safe defaults", () => {
  assert.equal(getVnFieldFallbackValue("religion"), "NONE");
  assert.equal(getVnFieldFallbackValue("occupation_info"), "NOT APPLICABLE");
  assert.equal(getVnFieldFallbackValue("intended_ward_commune"), "BA DINH WARD");
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

test("vn.field-mappings: common portal option aliases match Vietnam labels", () => {
  assert.equal(getVnPortalOptionText("sex", "M"), "Male");
  assert.equal(getVnPortalOptionText("nationality", "CHN"), "China");
  assert.equal(getVnPortalOptionText("intended_province_city", "ha_noi_city"), "HA NOI City");
  assert.equal(
    getVnPortalOptionText("intended_border_gate_of_entry", "noi_bai_int_airport_ha_noi"),
    "Noi Bai Int Airport",
  );
});
