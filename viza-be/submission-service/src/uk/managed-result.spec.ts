import assert from "node:assert/strict";
import test from "node:test";
import { mapUkResumeResult, ukSafePendingResult } from "./managed-result.js";
import { UK_PAGE_ORDER } from "./page-bindings.js";

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
    checkpoint: "payment",
    paymentStatus: "funding_required",
    paymentStateCode: "allocation_missing",
    applicationReference: "GWF123456789",
    prefillProgress: { pagesFilled: 2, pagesSkipped: 1, totalPages: UK_PAGE_ORDER.length },
  });
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /portalUrl|portalUsername|password|cipher/i);
});

test("UK progress and mapping use the verified payment boundary only", () => {
  const mapped = mapUkResumeResult({
    status: "stopped_at_pay",
    portalUrl: "https://example.test/resume",
    portalUsername: "redacted@example.test",
    pagesFilled: ["passport"],
    pagesSkipped: [],
    finalUrl: "https://visas-immigration.service.gov.uk/pay",
  });
  assert.equal(mapped.handoffReady, true);
  assert.equal(mapped.reachedStep, "payment");
  assert.equal(mapped.payload.checkpoint, "payment");
  assert.equal(mapped.payload.prefillProgress?.totalPages, UK_PAGE_ORDER.length);
});

test("UK incomplete form is never persisted as a payment handoff", () => {
  const mapped = mapUkResumeResult({
    status: "halted_before_pay",
    portalUrl: "https://example.test/resume",
    portalUsername: "redacted@example.test",
    pagesFilled: ["passport"],
    finalUrl: "https://visas-immigration.service.gov.uk/edit/application",
    reason: "save did not navigate",
    checkpoint: "form_incomplete",
  });
  assert.equal(mapped.handoffReady, false);
  assert.equal(mapped.reachedStep, "form_incomplete");
  assert.equal(mapped.payload.status, "needs_attention");
  assert.equal(mapped.payload.paymentStatus, undefined);
});

test("UK declaration checkpoint remains a user handoff without auto-accepting terms", () => {
  const mapped = mapUkResumeResult({
    status: "halted_before_pay",
    portalUrl: "https://example.test/resume",
    portalUsername: "redacted@example.test",
    pagesFilled: ["passport"],
    finalUrl: "https://visas-immigration.service.gov.uk/edit/declaration.standardDeclaration",
    reason: "Applicant must review and accept the official declaration",
    checkpoint: "declaration",
  });
  assert.equal(mapped.handoffReady, true);
  assert.equal(mapped.payload.checkpoint, "declaration");
  assert.equal(mapped.payload.status, "needs_attention");
  assert.equal(mapped.payload.paymentStatus, undefined);
});

test("historical payment variants cannot masquerade as a verified handoff", () => {
  const mapped = mapUkResumeResult({
    status: "payment_review_required",
    pagesFilled: [],
    pagesSkipped: [],
    finalUrl: "https://visas-immigration.service.gov.uk/pay",
    reason: "legacy payment result",
  });
  assert.equal(mapped.handoffReady, false);
  assert.equal(mapped.reachedStep, "payment_review_required");
  assert.equal(mapped.payload.status, "needs_attention");
});
