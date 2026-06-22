import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildVietnamBrowserAttempts,
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
