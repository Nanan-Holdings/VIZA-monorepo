import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVnFieldFallback,
  getVnDependentFieldFallbackValue,
  getVnPortalOptionText,
  getVnFieldFallbackValue,
  normalizeVnProvinceKey,
  VN_FIELD_MAPPINGS,
} from "../field-mappings.js";

test("vn.field-fallbacks: known fields expose portal-safe defaults", () => {
  assert.equal(getVnFieldFallbackValue("religion"), null);
  assert.equal(getVnFieldFallbackValue("occupation_info"), null);
  assert.equal(getVnFieldFallbackValue("intended_ward_commune"), null);
});

test("vn.field-fallbacks: ward fallback is disabled even when province is known", () => {
  assert.equal(normalizeVnProvinceKey("TAY NINH"), "tay_ninh");
  assert.equal(normalizeVnProvinceKey("HA NOI City"), "ha_noi_city");
  assert.equal(
    getVnDependentFieldFallbackValue("intended_ward_commune", {
      intended_province_city: "tay_ninh",
    }),
    null,
  );
  assert.equal(
    getVnDependentFieldFallbackValue("intended_ward_commune", {
      intended_province_city: "ha_noi_city",
    }),
    null,
  );
});

test("vn.field-fallbacks: fallback records are not emitted", () => {
  const fallback = buildVnFieldFallback({
    fieldName: "religion",
    domId: "basic_ttcnTonGiao",
    type: "text",
    userValue: "无",
    errorMessage: "Portal rejected non-Latin characters",
  });

  assert.equal(fallback, null);
});

test("vn.field-fallbacks: dependent fallback records are not emitted", () => {
  const fallback = buildVnFieldFallback({
    fieldName: "intended_ward_commune",
    domId: "basic_ttcdPhuongXa",
    type: "select",
    userValue: "Changsha",
    fallbackValue: "AN TINH WARD",
    errorMessage: "Portal rejected a ward outside the selected province",
  });

  assert.equal(fallback, null);
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
  assert.equal(getVnPortalOptionText("intended_province_city", "da_nang_city"), "DA NANG City");
  assert.equal(getVnPortalOptionText("intended_ward_commune", "ngu_hanh_son_ward"), "NGU HANH SON WARD");
});

test("vn.field-mappings: expense payment method is submitted to the official portal", () => {
  assert.equal(VN_FIELD_MAPPINGS.expense_payment_method.domId, "basic_kpbhHinhThuc");
  assert.equal(getVnPortalOptionText("expense_payment_method", "cash"), "Cash");
  assert.equal(getVnPortalOptionText("expense_payment_method", "credit_card"), "Credit card");
  assert.equal(
    getVnPortalOptionText("expense_payment_method", "travellers_cheques"),
    "Traveller's cheques",
  );
});
