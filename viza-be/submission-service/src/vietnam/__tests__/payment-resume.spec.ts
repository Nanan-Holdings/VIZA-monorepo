import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isVietnamSearchCaptchaAnswerUsable,
  normalizeVietnamSearchCaptchaAnswer,
  retryFreshVietnamSearchPage,
  shouldRetryVietnamSearchAfterCriticalAssetFailure,
  VIETNAM_SEARCH_CAPTCHA_TASK_OPTIONS,
} from "../payment-resume";

test("vn.payment-resume: constrains the search CAPTCHA to exactly six digits", () => {
  assert.deepEqual(VIETNAM_SEARCH_CAPTCHA_TASK_OPTIONS, {
    case: false,
    numeric: 1,
    minLength: 6,
    maxLength: 6,
    comment: "Vietnam e-Visa search CAPTCHA. Enter exactly the six visible digits.",
  });
  assert.equal(normalizeVietnamSearchCaptchaAnswer(" 898 309 "), "898309");
  assert.equal(isVietnamSearchCaptchaAnswerUsable("898309"), true);
  assert.equal(isVietnamSearchCaptchaAnswerUsable("89830"), false);
  assert.equal(isVietnamSearchCaptchaAnswerUsable("89830O"), false);
});

test("vn.payment-resume: retries a blank SPA promptly after a critical asset failure", () => {
  assert.equal(shouldRetryVietnamSearchAfterCriticalAssetFailure({
    elapsedMs: 3_000,
    bodyTextLength: 0,
    criticalAssetFailureDetected: true,
  }), true);
  assert.equal(shouldRetryVietnamSearchAfterCriticalAssetFailure({
    elapsedMs: 2_999,
    bodyTextLength: 0,
    criticalAssetFailureDetected: true,
  }), false);
  assert.equal(shouldRetryVietnamSearchAfterCriticalAssetFailure({
    elapsedMs: 3_000,
    bodyTextLength: 671,
    criticalAssetFailureDetected: true,
  }), false);
});

test("vn.payment-resume: retries a blank SPA in a fresh page", async () => {
  const opened: string[] = [];
  const closed: string[] = [];
  const waits: number[] = [];

  const result = await retryFreshVietnamSearchPage({
    attempts: 3,
    openPage: async (attempt) => {
      const page = `page-${attempt}`;
      opened.push(page);
      return page;
    },
    isReady: async (_page, attempt) => attempt === 2,
    closePage: async (page) => {
      closed.push(page);
    },
    waitBeforeRetry: async (attempt) => {
      waits.push(attempt);
    },
  });

  assert.deepEqual(opened, ["page-1", "page-2"]);
  assert.deepEqual(closed, ["page-1"]);
  assert.deepEqual(waits, [2]);
  assert.equal(result.ready, true);
  assert.equal(result.page, "page-2");
});

test("vn.payment-resume: retains only the last failed page for diagnostics", async () => {
  const closed: number[] = [];

  const result = await retryFreshVietnamSearchPage({
    attempts: 3,
    openPage: async (attempt) => attempt,
    isReady: async () => false,
    closePage: async (page) => {
      closed.push(page);
    },
  });

  assert.deepEqual(closed, [1, 2]);
  assert.equal(result.ready, false);
  assert.equal(result.page, 3);
});

test("vn.payment-resume: recovers when opening the first browser context fails", async () => {
  const result = await retryFreshVietnamSearchPage({
    attempts: 2,
    openPage: async (attempt) => {
      if (attempt === 1) throw new Error("transient asset load failure");
      return "recovered";
    },
    isReady: async () => true,
    closePage: async () => undefined,
  });

  assert.equal(result.ready, true);
  assert.equal(result.page, "recovered");
  assert.equal(result.lastError, undefined);
});
