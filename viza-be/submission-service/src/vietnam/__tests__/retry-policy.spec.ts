import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVietnamBrowserAttempts,
  finalizeVietnamResultAfterRetries,
  isRetryableVietnamResult,
} from "../retry-policy.js";
import type { FillVietnamResult } from "../run.js";

test("vn.retry-policy: builds bounded bundled/Edge/Chrome attempts", () => {
  assert.deepEqual(buildVietnamBrowserAttempts("bundled,msedge,chrome", 3), [
    undefined,
    "msedge",
    "chrome",
  ]);
  assert.deepEqual(buildVietnamBrowserAttempts("bundled,msedge,chrome", 2), [undefined, "msedge"]);
  assert.deepEqual(buildVietnamBrowserAttempts("bundled", 3), [
    undefined,
    undefined,
    undefined,
  ]);
  assert.equal(buildVietnamBrowserAttempts("bundled", 99).length, 3);
});

test("vn.retry-policy: retries portal hydration and navigation failures", () => {
  const layoutResult: FillVietnamResult = {
    status: "action_required",
    actionType: "layout_changed",
    checkpoint: "apply_now_visible",
    instruction: "form did not hydrate",
    url: "https://evisa.gov.vn/e-visa/foreigners",
  };
  const contextFailure: FillVietnamResult = {
    status: "failed",
    failedStep: "bootstrap",
    error: { message: "Target page, context or browser has been closed" },
    url: "https://evisa.gov.vn/e-visa/foreigners",
  };

  assert.equal(isRetryableVietnamResult(layoutResult), true);
  assert.equal(isRetryableVietnamResult(contextFailure), true);
});

test("vn.retry-policy: does not retry user data validation or payment checkpoints", () => {
  const validationResult: FillVietnamResult = {
    status: "scaffolded_pending_walk",
    reason: "portal validation blocked submission",
    checkpoint: "application_form_visible",
    url: "https://evisa.gov.vn/e-visa/foreigners",
  };
  const paymentResult: FillVietnamResult = {
    status: "action_required",
    actionType: "payment_required",
    checkpoint: "payment_page_visible",
    instruction: "payment reached",
    url: "https://evisa.gov.vn/payment",
  };

  assert.equal(isRetryableVietnamResult(validationResult), false);
  assert.equal(isRetryableVietnamResult(paymentResult), false);
});

test("vn.retry-policy: reports temporary portal outage after three attempts", () => {
  const transientError: FillVietnamResult = {
    status: "action_required",
    actionType: "layout_changed",
    checkpoint: "layout_changed",
    instruction: "layout changed",
    url: "https://evisa.gov.vn/",
    diagnostics: {
      consoleErrors: ["Failed to load resource: the server responded with a status of 502 (Bad Gateway)"],
      failedRequests: ["GET https://evisa.gov.vn/assets/app.js - net::ERR_ABORTED"],
      lastSnapshot: {
        url: "https://evisa.gov.vn/",
        title: "Error",
        bodyText: "An unexpected error occurred.",
        bodyHtmlLength: 3_000,
        buttonTexts: [],
        linkHrefs: [],
        antFormItemCount: 0,
        inputCount: 0,
        hasBody: true,
        hasVisibleModal: false,
        modalText: "",
        hasApplyEntry: false,
        hasLanguageSwitch: false,
        hasCaptcha: false,
        hasPassportUpload: false,
        hasPortraitUpload: false,
        hasPayment: false,
        hasFinalSubmit: false,
        registrationCode: null,
        failedRequestCount: 18,
        mainRequestFailed: false,
      },
    },
  };

  const finalized = finalizeVietnamResultAfterRetries(transientError, 3);

  assert.equal(finalized.status, "failed");
  if (finalized.status !== "failed") return;
  assert.equal(finalized.error?.code, "official_portal_unavailable_after_retries");
  assert.match(String(finalized.error?.message), /after 3 attempts/i);
  assert.match(String(finalized.error?.message), /did not attempt payment/i);
  assert.equal(finalized.checkpoint, "portal_error");
});

test("vn.retry-policy: preserves a genuine layout change after retries", () => {
  const layoutResult: FillVietnamResult = {
    status: "action_required",
    actionType: "layout_changed",
    checkpoint: "layout_changed",
    instruction: "new official form markup",
    url: "https://evisa.gov.vn/e-visa/foreigners",
  };

  assert.equal(finalizeVietnamResultAfterRetries(layoutResult, 3), layoutResult);
});
