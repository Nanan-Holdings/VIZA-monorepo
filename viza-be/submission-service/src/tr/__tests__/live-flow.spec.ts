import { test } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "@playwright/test";
import { TwoCaptchaApiError } from "../../captcha/index.js";
import {
  bindTrLiveFlowPage,
  classifyTrArrivalEligibility,
  classifyTrPaymentCheckpoint,
  classifyTrStage,
  extractTrApplicationReference,
  isTrustedTrOfficialUrl,
  prerequisiteAnswerKey,
  redactedTrVerificationNavigationFailure,
  requireTrustedTrOfficialUrl,
  shouldRetryTrCaptchaSolve,
  toTrPortalDate,
} from "../live-flow.js";

test("Türkiye stage classifier recognizes official eligibility and later steps", () => {
  assert.equal(
    classifyTrStage({
      url: "https://evisa.gov.tr/en/apply/",
      bodyText: "Country/Region",
      selectorIds: ["vizeturuList", "recaptcha_response_field"],
    }),
    "eligibility",
  );
  assert.equal(
    classifyTrStage({
      url: "https://evisa.gov.tr/en/",
      bodyText: "02. Date of Arrival - Arrival Date in Türkiye",
    }),
    "arrival_date",
  );
  assert.equal(
    classifyTrStage({
      url: "https://evisa.gov.tr/en/",
      bodyText: "03. Prerequisites - You must meet all requirements",
    }),
    "prerequisites",
  );
  assert.equal(
    classifyTrStage({
      url: "https://evisa.gov.tr/en/",
      bodyText: "04. Personal Information - Given/First Name",
    }),
    "personal_information",
  );
});

test("Türkiye verification navigation errors never retain bearer URLs", () => {
  const secret = "opaque-verification-token-should-not-appear";
  const message = redactedTrVerificationNavigationFailure(
    new Error(`page.goto: https://evisa.gov.tr/en/email/${secret}?signature=secret`),
  );
  assert.equal(
    message,
    "Türkiye verification navigation failed before the unpaid payment checkpoint",
  );
  assert.equal(message.includes(secret), false);
  assert.equal(message.includes("signature"), false);
});

test("Türkiye prerequisite labels map only to explicit truthful answers", () => {
  assert.equal(
    prerequisiteAnswerKey("My passport covers the period that I will be staying in Türkiye"),
    "confirm_passport_covers_stay",
  );
  assert.equal(
    prerequisiteAnswerKey("I can prove that I hold a return ticket, hotel reservation and at least 50 USD per day"),
    "confirm_return_ticket_accommodation_funds",
  );
  assert.equal(
    prerequisiteAnswerKey("I have a valid Supporting Document and it is not an e-visa"),
    "confirm_supporting_document_valid",
  );
  assert.equal(prerequisiteAnswerKey("An unknown new official condition"), null);
});

test("Türkiye payment checkpoint requires official host, USD amount, and payment controls", () => {
  assert.deepEqual(
    classifyTrPaymentCheckpoint({
      url: "https://evisa.gov.tr/en/payment/opaque-session",
      bodyText: "Payment - Total e-Visa fee: USD 60.00",
      hasPaymentAction: true,
      hasCardControl: false,
    }),
    {
      ready: true,
      amountCents: 6_000,
      currency: "USD",
      reason: "verified official unpaid USD payment checkpoint",
    },
  );

  assert.equal(
    classifyTrPaymentCheckpoint({
      url: "https://evisa.gov.tr.evil.example/payment",
      bodyText: "Payment - USD 60.00",
      hasPaymentAction: true,
      hasCardControl: true,
    }).ready,
    false,
  );
  assert.equal(
    classifyTrPaymentCheckpoint({
      url: "https://evisa.gov.tr/en/payment/opaque-session",
      bodyText: "Payment - USD 60.00",
      hasPaymentAction: false,
      hasCardControl: false,
    }).ready,
    false,
  );
  assert.equal(
    classifyTrPaymentCheckpoint({
      url: "https://evisa.gov.tr/en/payment/opaque-session",
      bodyText: "Payment completed successfully - USD 60.00",
      hasPaymentAction: true,
      hasCardControl: true,
    }).ready,
    false,
  );
});

test("Türkiye URL and date normalization are strict", () => {
  assert.equal(isTrustedTrOfficialUrl("https://evisa.gov.tr/en/email/token"), true);
  assert.equal(isTrustedTrOfficialUrl("http://evisa.gov.tr/en/email/token"), false);
  assert.equal(isTrustedTrOfficialUrl("https://evisa.gov.tr.attacker.test/token"), false);
  assert.equal(isTrustedTrOfficialUrl("https://evisa.gov.tr@attacker.test/token"), false);
  assert.throws(
    () => requireTrustedTrOfficialUrl("https://evisa.gov.tr.attacker.test/verify", "verification approval"),
    /left the verified official e-Visa host/,
  );
  assert.equal(toTrPortalDate("2026-10-20"), "20/10/2026");
  assert.equal(toTrPortalDate("20/10/2026"), "20/10/2026");
  assert.equal(
    extractTrApplicationReference("Application reference number: TR-ABC123"),
    "TR-ABC123",
  );
  assert.equal(extractTrApplicationReference("Check your email to continue"), null);
});

test("Türkiye retries only a solver-declared unsolvable image challenge", () => {
  assert.equal(
    shouldRetryTrCaptchaSolve(new TwoCaptchaApiError("ERROR_CAPTCHA_UNSOLVABLE")),
    true,
  );
  assert.equal(
    shouldRetryTrCaptchaSolve(new TwoCaptchaApiError("ERROR_ZERO_BALANCE")),
    false,
  );
  assert.equal(shouldRetryTrCaptchaSolve(new Error("CAPTCHA failed")), false);
});

test("Türkiye stops when the official arrival page declares the applicant visa-exempt", () => {
  assert.equal(
    classifyTrArrivalEligibility(
      "You are exempt from visa for tourist visits of up to 90 days within 180 days",
    ),
    "visa_exempt",
  );
  assert.equal(
    classifyTrArrivalEligibility("Select an arrival date and save to continue"),
    "continue",
  );
});

test("Türkiye page binding preserves the guarded creation and inbox callbacks", () => {
  const page = {} as Page;
  const waitForVerificationUrl = async () => "https://evisa.gov.tr/en/verify/test";
  const input = bindTrLiveFlowPage(page, {
    answers: { travel_document_country: "CHN" },
    entryUrl: "https://evisa.gov.tr/en/apply/",
    allowOfficialApplicationCreation: true,
    waitForVerificationUrl,
  });

  assert.equal(input.page, page);
  assert.equal(input.allowOfficialApplicationCreation, true);
  assert.equal(input.waitForVerificationUrl, waitForVerificationUrl);
});
