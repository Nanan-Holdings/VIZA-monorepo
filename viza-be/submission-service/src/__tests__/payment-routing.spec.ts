/**
 * payment-routing parity test (PAY-003).
 *
 * Asserts the runtime routing map covers every package in the FE
 * pricing config. The two are independent declarations (server-side
 * vs FE-side) and we want to fail loudly when they drift.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { GOVT_FEE_ROUTING, routingFor } from "../payment-routing.js";

// Minimal mirror of viza-fe/internal-website/lib/pricing.ts. Synced by
// hand for test purposes — when pricing.ts changes, update this array.
const PRICING_PACKAGES: Array<{ country: string; visaType: string }> = [
  { country: "indonesia", visaType: "B211A" },
  { country: "united_states", visaType: "B1_B2" },
  { country: "united_kingdom", visaType: "UK_STANDARD_VISITOR" },
  { country: "european_union", visaType: "EU_SCHENGEN_C_SHORT_STAY" },
  { country: "vietnam", visaType: "VN_E_VISA" },
  { country: "australia", visaType: "AU_VISITOR_600" },
  { country: "japan", visaType: "JP_TOURIST" },
  { country: "indonesia", visaType: "ID_C1_TOURIST" },
  { country: "south_korea", visaType: "KR_C39_SHORT_TERM_VISIT" },
  { country: "thailand", visaType: "TH_TOURIST_E_VISA" },
  { country: "malaysia", visaType: "MY_TOURIST_E_VISA" },
  { country: "singapore", visaType: "SG_VISITOR_VISA" },
  { country: "hong_kong", visaType: "HK_VISIT_VISA" },
  { country: "macau", visaType: "MO_VISIT_VISA" },
  { country: "new_zealand", visaType: "NZ_VISITOR_VISA" },
  { country: "philippines", visaType: "PH_TEMPORARY_VISITOR_VISA" },
  { country: "cambodia", visaType: "KH_TOURIST_E_VISA" },
  { country: "laos", visaType: "LA_TOURIST_E_VISA" },
  { country: "sri_lanka", visaType: "LK_ETA" },
  { country: "india", visaType: "IN_E_VISA" },
  { country: "maldives", visaType: "MV_IMUGA" },
  { country: "egypt", visaType: "EG_E_VISA" },
  { country: "russia", visaType: "RU_E_VISA" },
  { country: "turkey", visaType: "TR_E_VISA" },
  { country: "united_arab_emirates", visaType: "AE_TOURIST_VISA" },
  { country: "canada", visaType: "CA_TRV" },
  { country: "south_africa", visaType: "ZA_VISITOR_VISA" },
];

test("every pricing package has a routing entry", () => {
  for (const p of PRICING_PACKAGES) {
    const r = routingFor(p.country, p.visaType);
    assert.equal(r.country, p.country);
    assert.equal(r.visaType, p.visaType);
  }
});

test("routing covers no extra packages beyond the pricing set", () => {
  const pricingKeys = new Set(
    PRICING_PACKAGES.map((p) => `${p.country}|${p.visaType}`),
  );
  for (const r of GOVT_FEE_ROUTING) {
    const k = `${r.country}|${r.visaType}`;
    assert.ok(pricingKeys.has(k), `routing has unknown pricing pair ${k}`);
  }
});

test("Vietnam mechanism is runner_escrow_card", () => {
  assert.equal(routingFor("vietnam", "VN_E_VISA").mechanism, "runner_escrow_card");
});

test("UK mechanism is client_in_portal", () => {
  assert.equal(
    routingFor("united_kingdom", "UK_STANDARD_VISITOR").mechanism,
    "client_in_portal",
  );
});

test("Maldives + Hong Kong + Macau + Japan are paper_only_no_fee", () => {
  for (const [c, v] of [
    ["maldives", "MV_IMUGA"],
    ["hong_kong", "HK_VISIT_VISA"],
    ["macau", "MO_VISIT_VISA"],
    ["japan", "JP_TOURIST"],
  ]) {
    assert.equal(routingFor(c, v).mechanism, "paper_only_no_fee");
  }
});
