import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import {
  isVietnamSearchCaptchaAnswerUsable,
  normalizeVietnamSearchCaptchaAnswer,
  refreshVietnamSearchCaptchaChallenge,
  retryFreshVietnamSearchPage,
  shouldRetryVietnamSearchAfterCriticalAssetFailure,
  VIETNAM_SEARCH_CAPTCHA_TASK_OPTIONS,
} from "../payment-resume";
import { captureVietnamCaptchaFingerprint } from "../captcha";

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

test("vn.payment-resume: uses the live search reload image with a trusted click and confirms a new challenge", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const firstChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><rect width="240" height="100" fill="white"/><text x="20" y="65" font-size="48">123456</text></svg>',
    );
    const secondChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><rect width="240" height="100" fill="yellow"/><text x="20" y="65" font-size="48">654321</text></svg>',
    );
    await page.setContent(`
      <input id="basic_captcha" />
      <img alt="captcha img" src="${firstChallenge}" />
      <img alt="reload" src="${firstChallenge}" />
      <script>
        document.querySelector('img[alt="reload"]').addEventListener("click", (event) => {
          if (event.isTrusted) document.querySelector('img[alt="captcha img"]').src = ${JSON.stringify(secondChallenge)};
        });
      </script>
    `);
    const previousFingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);
    assert.ok(previousFingerprint);

    const strategy = await refreshVietnamSearchCaptchaChallenge(page, previousFingerprint, 5_000);
    const currentFingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);

    assert.equal(strategy, "search_reload_control");
    assert.ok(currentFingerprint);
    assert.notEqual(currentFingerprint, previousFingerprint);
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: rejects an unchanged search challenge after the reload control is clicked", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const challenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><rect width="240" height="100" fill="white"/><text x="20" y="65" font-size="48">123456</text></svg>',
    );
    await page.setContent(`
      <input id="basic_captcha" />
      <img alt="captcha img" src="${challenge}" />
      <img alt="reload" src="${challenge}" />
    `);
    const previousFingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);
    assert.ok(previousFingerprint);

    const strategy = await refreshVietnamSearchCaptchaChallenge(page, previousFingerprint, 1_000);

    assert.equal(strategy, null);
    assert.equal(await captureVietnamCaptchaFingerprint(page, 2_000), previousFingerprint);
  } finally {
    await browser.close();
  }
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
