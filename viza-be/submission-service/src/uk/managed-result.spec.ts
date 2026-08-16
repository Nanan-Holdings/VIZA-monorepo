import assert from "node:assert/strict";
import test from "node:test";
import { ukSafePendingResult } from "./managed-result.js";

test("UK funding result is customer-safe and contains no portal credentials", () => {
  const result = ukSafePendingResult(
    { kind: "funding_required", code: "allocation_missing" },
    {
      pagesFilled: ["passport", "travel-history"],
      pagesSkipped: ["dependants"],
      applicationReference: "GWF123456789",
    },
  );
  assert.deepEqual(result, {
    country: "UK",
    status: "stopped_at_pay",
    paymentStatus: "funding_required",
    paymentStateCode: "allocation_missing",
    applicationReference: "GWF123456789",
    prefillProgress: { pagesFilled: 2, pagesSkipped: 1, totalPages: 44 },
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /portalUrl|portalUsername|password|cipher/i);
});
