import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { deriveBackfillPoolFlow } from "../backfill-flow.js";

test("backfill derives only explicit supported pool flows", () => {
  const cases = [
    ["vietnam", "VN_PREARRIVAL_DECLARATION", "vn_prearrival"],
    ["sg", "SG_ARRIVAL_CARD", "sgac"],
    ["malaysia", "MY_MDAC_ARRIVAL_CARD", "mdac"],
    ["thailand", "TH_TDAC_ARRIVAL_CARD", "tdac"],
    ["kr", "KR_E_ARRIVAL_CARD", "kr_arrival_card"],
    ["kr", "KR_C39_SHORT_TERM_VISIT", "kr_eform"],
    ["taiwan", "TW_ENTRY_PERMIT", "tw_entry_permit"],
  ] as const;
  for (const [country, visaType, flowKey] of cases) {
    assert.equal(deriveBackfillPoolFlow(country, visaType), flowKey);
  }
});

test("backfill skips sticky Vietnam eVisa and ambiguous or unsupported applications", () => {
  const skipped = [
    ["vietnam", "VN_E_VISA"],
    ["vietnam", "VN_C39_SHORT_TERM_VISIT"],
    ["malaysia", "MY_TOURIST_E_VISA"],
    ["kr", "KR_C39"],
    ["atlantis", "SG_ARRIVAL_CARD"],
    ["singapore", null],
    ["taiwan", "TW_ENTRY_PERMIT_DRY_RUN"],
  ] as const;
  for (const [country, visaType] of skipped) {
    assert.equal(deriveBackfillPoolFlow(country, visaType), null, `${country}/${visaType}`);
  }
});

test("paid-order backfill selects visa type and writes an explicit flow key", () => {
  const scriptPath = path.resolve(
    __dirname,
    "../../../scripts/queue/backfill-paid-orders.ts",
  );
  const source = fs.readFileSync(scriptPath, "utf8");
  assert.match(source, /select\("country, visa_type"\)/);
  assert.match(source, /deriveBackfillPoolFlow\(app\.country/);
  assert.match(source, /flow_key:\s*flowKey/);
  assert.match(source, /if \(!flowKey\)/);
});
