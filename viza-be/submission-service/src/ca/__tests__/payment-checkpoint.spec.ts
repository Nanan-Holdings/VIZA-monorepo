import assert from "node:assert/strict";
import { test } from "node:test";
import { assessCanadaPaymentEvidence } from "../payment-checkpoint.js";

test("CA payment evidence rejects explanatory fee copy", () => {
  assert.deepEqual(
    assessCanadaPaymentEvidence({
      url: "https://tr-rt.apps.cic.gc.ca/application",
      headingTexts: ["Your fees"],
      buttonTexts: ["Save and continue"],
      cardFieldCount: 0,
    }),
    {
      reached: false,
      entryReady: false,
      reason: "payment_heading_not_observed",
    },
  );
});

test("CA payment evidence requires an official IRCC host and exact action", () => {
  assert.equal(
    assessCanadaPaymentEvidence({
      url: "https://example.test/pay",
      headingTexts: ["Payment"],
      buttonTexts: ["Pay"],
      cardFieldCount: 3,
    }).reason,
    "unofficial_host",
  );
  assert.equal(
    assessCanadaPaymentEvidence({
      url: "http://tr-rt.apps.cic.gc.ca/pay",
      headingTexts: ["Payment"],
      buttonTexts: ["Pay"],
      cardFieldCount: 3,
    }).reason,
    "unofficial_host",
  );
  assert.equal(
    assessCanadaPaymentEvidence({
      url: "https://tr-rt.apps.cic.gc.ca.evil.example/pay",
      headingTexts: ["Payment"],
      buttonTexts: ["Pay"],
      cardFieldCount: 3,
    }).reason,
    "unofficial_host",
  );
  assert.equal(
    assessCanadaPaymentEvidence({
      url: "https://tr-rt.apps.cic.gc.ca/pay",
      headingTexts: ["Payment"],
      buttonTexts: ["Read about fees"],
      cardFieldCount: 0,
    }).reason,
    "payment_action_not_observed",
  );
});

test("CA payment evidence can distinguish checkpoint from card-entry readiness", () => {
  assert.deepEqual(
    assessCanadaPaymentEvidence({
      url: "https://tr-rt.apps.cic.gc.ca/pay",
      headingTexts: ["Pay your fees"],
      buttonTexts: ["Continue to payment"],
      cardFieldCount: 0,
    }),
    { reached: true, entryReady: false, reason: "official_payment_checkpoint" },
  );
  assert.equal(
    assessCanadaPaymentEvidence({
      url: "https://tr-rt.apps.cic.gc.ca/pay",
      headingTexts: ["Payment"],
      buttonTexts: ["Pay"],
      cardFieldCount: 1,
    }).entryReady,
    true,
  );
});
