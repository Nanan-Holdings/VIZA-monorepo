import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVnFieldFallback,
  getVnDependentFieldFallbackValue,
  getVnPortalOptionText,
  getVnFieldFallbackValue,
  normalizeVnProvinceKey,
} from "../field-mappings.js";

test("vn.field-fallbacks: known fields expose portal-safe defaults", () => {
  assert.equal(getVnFieldFallbackValue("religion"), "NONE");
  assert.equal(getVnFieldFallbackValue("occupation_info"), "NOT APPLICABLE");
  assert.equal(getVnFieldFallbackValue("intended_ward_commune"), "BA DINH WARD");
});

test("vn.field-fallbacks: ward fallback follows the selected province", () => {
  assert.equal(normalizeVnProvinceKey("TAY NINH"), "tay_ninh");
  assert.equal(normalizeVnProvinceKey("HA NOI City"), "ha_noi_city");
  assert.equal(
    getVnDependentFieldFallbackValue("intended_ward_commune", {
      intended_province_city: "tay_ninh",
    }),
    "AN TINH WARD",
  );
  assert.equal(
    getVnDependentFieldFallbackValue("intended_ward_commune", {
      intended_province_city: "ha_noi_city",
    }),
    "BA DINH WARD",
  );
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

test("vn.field-fallbacks: fallback records keep dependent fallback evidence", () => {
  const fallback = buildVnFieldFallback({
    fieldName: "intended_ward_commune",
    domId: "basic_ttcdPhuongXa",
    type: "select",
    userValue: "Changsha",
    fallbackValue: "AN TINH WARD",
    errorMessage: "Portal rejected a ward outside the selected province",
  });

  assert.equal(fallback?.fallbackValue, "AN TINH WARD");
  assert.equal(fallback?.schemaRuleSuggestion.fallbackDefault, "AN TINH WARD");
});

test("vn.field-fallbacks: unmapped fields do not invent defaults", () => {
  assert.equal(getVnFieldFallbackValue("passport_number"), null);
});

test("vn.field-mappings: common portal option aliases match Vietnam labels", () => {
  assert.equal(getVnPortalOptionText("sex", "M"), "Male");
  assert.equal(getVnPortalOptionText("nationality", "CHN"), "China");
  assert.equal(getVnPortalOptionText("visa_type_requested", "single_entry"), "Single-entry");
  assert.equal(getVnPortalOptionText("purpose_of_entry", "Tourism"), "Tourist");
  assert.equal(getVnPortalOptionText("intended_province_city", "ha_noi_city"), "HA NOI City");
  assert.equal(
    getVnPortalOptionText("intended_border_gate_of_entry", "noi_bai_int_airport_ha_noi"),
    "Noi Bai Int Airport",
  );
  assert.equal(
    getVnPortalOptionText("intended_border_gate_of_entry", "Noi bai international airport"),
    "Noi Bai Int Airport",
  );
});
