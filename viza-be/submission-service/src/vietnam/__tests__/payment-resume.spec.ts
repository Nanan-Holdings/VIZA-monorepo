import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import {
  advanceOfficialFormToPayment,
  followVietnamSearchPaymentEntry,
  isVietnamSearchCaptchaAnswerUsable,
  normalizeVietnamSearchCaptchaAnswer,
  registerVietnamSearchCaptchaChallenge,
  refreshVietnamSearchCaptchaChallenge,
  retryFreshVietnamSearchPage,
  retryVietnamSearchCaptchaInFreshContexts,
  solveVietnamPaymentSearchCaptcha,
  shouldRetryVietnamSearchAfterCriticalAssetFailure,
  VIETNAM_SEARCH_CAPTCHA_TASK_OPTIONS,
  waitForVietnamSearchSubmissionOutcome,
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

test("vn.payment-resume: never sends a previously-seen search challenge to the solver again", () => {
  const knownFingerprints = new Set<string>();

  assert.equal(registerVietnamSearchCaptchaChallenge(knownFingerprints, "challenge-a"), true);
  assert.equal(registerVietnamSearchCaptchaChallenge(knownFingerprints, "challenge-b"), true);
  assert.equal(registerVietnamSearchCaptchaChallenge(knownFingerprints, "challenge-a"), false);
  assert.deepEqual([...knownFingerprints], ["challenge-a", "challenge-b"]);
});

test("vn.payment-resume: reloads a repeated fresh-context challenge before solving", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const firstChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">111111</text></svg>',
    );
    const secondChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">222222</text></svg>',
    );
    await page.setContent(`
      <input id="basic_captcha" />
      <img alt="captcha img" src="${firstChallenge}" />
      <button aria-label="reload captcha" type="button">Reload</button>
      <script>
        document.querySelector('[aria-label="reload captcha"]').addEventListener('click', () => {
          document.querySelector('img[alt="captcha img"]').setAttribute('src', ${JSON.stringify(secondChallenge)});
        });
      </script>
    `);
    const firstFingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);
    assert.ok(firstFingerprint);
    const knownFingerprints = new Set([firstFingerprint]);
    let solveCalls = 0;

    const result = await solveVietnamPaymentSearchCaptcha(page, 8_000, {
      maxAttempts: 1,
      knownChallengeFingerprints: knownFingerprints,
      solveCaptcha: async () => {
        solveCalls += 1;
        return { text: "222222", solveId: "fixture-solve", durationMs: 10 };
      },
    });

    assert.equal(solveCalls, 1);
    assert.equal(await page.locator("#basic_captcha").inputValue(), "222222");
    assert.equal(knownFingerprints.size, 2);
    assert.equal(result.diagnostics.at(-1)?.outcome, "solved");
    assert.equal(result.diagnostics.at(-1)?.refreshConfirmed, true);
    assert.equal(result.diagnostics.at(-1)?.refreshStrategy, "search_reload_control");
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: never solves a repeated challenge when reload is a no-op", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const challenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">111111</text></svg>',
    );
    await page.setContent(`
      <input id="basic_captcha" />
      <img alt="captcha img" src="${challenge}" />
      <button aria-label="reload captcha" type="button">Reload</button>
    `);
    const fingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);
    assert.ok(fingerprint);
    let solveCalls = 0;

    await assert.rejects(
      solveVietnamPaymentSearchCaptcha(page, 2_500, {
        maxAttempts: 1,
        knownChallengeFingerprints: new Set([fingerprint]),
        solveCaptcha: async () => {
          solveCalls += 1;
          return { text: "111111", solveId: "fixture-solve", durationMs: 10 };
        },
      }),
      (error: unknown) => {
        const diagnostics = (error as { diagnostics?: Array<{ outcome?: string }> }).diagnostics ?? [];
        assert.equal(diagnostics.at(-1)?.outcome, "stale_challenge");
        return true;
      },
    );

    assert.equal(solveCalls, 0);
    assert.equal(await page.locator("#basic_captcha").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: abandons an answer when the portal changes the challenge during solving", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const firstChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">123456</text></svg>',
    );
    const secondChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">654321</text></svg>',
    );
    await page.setContent(`<input id="basic_captcha" /><img alt="captcha img" src="${firstChallenge}" />`);
    let badReports = 0;

    await assert.rejects(
      solveVietnamPaymentSearchCaptcha(page, 5_000, {
        maxAttempts: 1,
        knownChallengeFingerprints: new Set(),
        solveCaptcha: async () => {
          await page.locator('img[alt="captcha img"]').evaluate(
            (element, nextSource) => element.setAttribute("src", nextSource),
            secondChallenge,
          );
          return { text: "123456", solveId: "fixture-solve", durationMs: 10 };
        },
        reportBad: async () => { badReports += 1; },
      }),
      (error: unknown) => {
        const diagnostics = (error as { diagnostics?: Array<{ outcome?: string }> }).diagnostics ?? [];
        assert.equal(diagnostics.at(-1)?.outcome, "stale_challenge");
        return true;
      },
    );

    assert.equal(await page.locator("#basic_captcha").inputValue(), "");
    assert.equal(badReports, 0);
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: abandons a redrawn CAPTCHA input instead of submitting", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const challenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">123456</text></svg>',
    );
    await page.setContent(`<input id="basic_captcha" /><img alt="captcha img" src="${challenge}" />`);

    await assert.rejects(
      solveVietnamPaymentSearchCaptcha(page, 5_000, {
        maxAttempts: 1,
        solveCaptcha: async () => {
          await page.locator("#basic_captcha").evaluate((element) => element.remove());
          return { text: "123456", solveId: "fixture-solve", durationMs: 10 };
        },
      }),
      (error: unknown) => {
        const diagnostics = (error as { diagnostics?: Array<{ outcome?: string }> }).diagnostics ?? [];
        assert.equal(diagnostics.at(-1)?.outcome, "input_unconfirmed");
        return true;
      },
    );
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: enforces one shared CAPTCHA deadline before filling the answer", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const challenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">123456</text></svg>',
    );
    await page.setContent(`<input id="basic_captcha" /><img alt="captcha img" src="${challenge}" />`);
    const deadlineAt = Date.now() + 20;

    await assert.rejects(
      solveVietnamPaymentSearchCaptcha(page, 5_000, {
        deadlineAt,
        maxAttempts: 1,
        solveCaptcha: async () => {
          await new Promise((resolve) => setTimeout(resolve, 40));
          return { text: "123456", solveId: "fixture-solve", durationMs: 40 };
        },
      }),
      /deadline was exhausted/,
    );

    assert.equal(await page.locator("#basic_captcha").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: distinguishes an official CAPTCHA rejection from a valid search result", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const rejectedPage = await browser.newPage();
    await rejectedPage.setContent(`
      <div class="ant-form-item">
        <input id="basic_captcha" />
        <div class="ant-form-item-explain-error">Security code is invalid</div>
      </div>
    `);
    assert.equal(
      await waitForVietnamSearchSubmissionOutcome(rejectedPage, undefined, 1_000),
      "captcha_rejected",
    );

    const resultPage = await browser.newPage();
    await resultPage.setContent('<table><tbody><tr><td>Application result</td></tr></tbody></table>');
    assert.equal(
      await waitForVietnamSearchSubmissionOutcome(resultPage, undefined, 1_000),
      "accepted",
    );

    const noResultPage = await browser.newPage();
    await noResultPage.setContent('<p>No result found</p>');
    assert.equal(
      await waitForVietnamSearchSubmissionOutcome(noResultPage, undefined, 1_000),
      "accepted",
    );
  } finally {
    await browser.close();
  }
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

test("vn.payment-resume: re-resolves a Vue-replaced CAPTCHA image and waits for its stable bitmap", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const firstChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">111111</text></svg>',
    );
    const transientChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">333333</text></svg>',
    );
    const stableChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">222222</text></svg>',
    );
    await page.setContent(`
      <input id="basic_captcha" />
      <div id="captcha-slot"><img alt="captcha img" src="${firstChallenge}" /></div>
      <img alt="reload" src="${firstChallenge}" />
      <script>
        document.querySelector('img[alt="reload"]').addEventListener("click", () => {
          document.querySelector('#captcha-slot').innerHTML = '<img alt="captcha img" src="${transientChallenge}" />';
          setTimeout(() => {
            document.querySelector('#captcha-slot').innerHTML = '<img alt="captcha img" src="${stableChallenge}" />';
          }, 300);
        });
      </script>
    `);
    const previousFingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);
    assert.ok(previousFingerprint);
    let solveCalls = 0;

    const result = await solveVietnamPaymentSearchCaptcha(page, 8_000, {
      maxAttempts: 1,
      knownChallengeFingerprints: new Set([previousFingerprint]),
      solveCaptcha: async () => {
        solveCalls += 1;
        return { text: "222222", solveId: "fixture-solve", durationMs: 10 };
      },
    });

    assert.equal(solveCalls, 1);
    assert.equal(await page.locator("#basic_captcha").inputValue(), "222222");
    assert.equal(result.diagnostics.at(-1)?.outcome, "solved");
    assert.equal(result.diagnostics.at(-1)?.refreshConfirmed, true);
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: retries the one live reload control when its first trusted click is a no-op", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const firstChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">111111</text></svg>',
    );
    const secondChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">222222</text></svg>',
    );
    await page.setContent(`
      <input id="basic_captcha" />
      <img alt="captcha img" src="${firstChallenge}" />
      <img alt="reload" src="${firstChallenge}" />
      <script>
        window.reloadClicks = 0;
        document.querySelector('img[alt="reload"]').addEventListener("click", (event) => {
          if (!event.isTrusted) return;
          window.reloadClicks += 1;
          if (window.reloadClicks >= 2) {
            document.querySelector('img[alt="captcha img"]').src = ${JSON.stringify(secondChallenge)};
          }
        });
      </script>
    `);
    const previousFingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);
    assert.ok(previousFingerprint);

    const strategy = await refreshVietnamSearchCaptchaChallenge(page, previousFingerprint, 7_000);

    assert.equal(strategy, "search_reload_control");
    assert.equal(await page.evaluate(() => (window as typeof window & { reloadClicks?: number }).reloadClicks ?? 0), 2);
    assert.notEqual(await captureVietnamCaptchaFingerprint(page, 2_000), previousFingerprint);
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: falls back to the Vue click handler when pointer clicks do not rotate the challenge", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const firstChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">111111</text></svg>',
    );
    const secondChallenge = "data:image/svg+xml," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="100"><text x="20" y="65" font-size="48">222222</text></svg>',
    );
    await page.setContent(`
      <form>
        <input id="basic_captcha" />
        <img alt="captcha img" src="${firstChallenge}" />
        <img alt="reload" src="${firstChallenge}" />
      </form>
      <script>
        const reload = document.querySelector('img[alt="reload"]');
        reload.addEventListener("click", (event) => {
          if (event.isTrusted) return;
          document.querySelector('img[alt="captcha img"]').src = ${JSON.stringify(secondChallenge)};
        });
      </script>
    `);
    const previousFingerprint = await captureVietnamCaptchaFingerprint(page, 2_000);
    assert.ok(previousFingerprint);

    const strategy = await refreshVietnamSearchCaptchaChallenge(page, previousFingerprint, 8_000);

    assert.equal(strategy, "search_reload_control");
    assert.notEqual(await captureVietnamCaptchaFingerprint(page, 2_000), previousFingerprint);
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

test("vn.payment-resume: replaces an unrefreshable CAPTCHA page with a fresh context", async () => {
  const opened: string[] = [];
  const closed: string[] = [];
  const retried: number[] = [];

  const result = await retryVietnamSearchCaptchaInFreshContexts({
    attempts: 3,
    openContext: async (attempt) => {
      const context = `context-${attempt}`;
      opened.push(context);
      return context;
    },
    runContext: async (context, attempt) => {
      if (attempt === 1) throw new Error("refresh_unconfirmed");
      return `${context}:completed`;
    },
    closeContext: async (context) => {
      closed.push(context);
    },
    shouldRetry: (error) => error instanceof Error && error.message === "refresh_unconfirmed",
    onRetry: async (_error, attempt) => {
      retried.push(attempt);
    },
  });

  assert.deepEqual(opened, ["context-1", "context-2"]);
  assert.deepEqual(closed, ["context-1"]);
  assert.deepEqual(retried, [1]);
  assert.equal(result.context, "context-2");
  assert.equal(result.result, "context-2:completed");
});

test("vn.payment-resume: does not recycle a context after a non-retryable CAPTCHA error", async () => {
  const opened: string[] = [];
  const closed: string[] = [];

  await assert.rejects(
    retryVietnamSearchCaptchaInFreshContexts({
      attempts: 3,
      openContext: async (attempt) => {
        const context = `context-${attempt}`;
        opened.push(context);
        return context;
      },
      runContext: async () => {
        throw new Error("configuration_error");
      },
      closeContext: async (context) => {
        closed.push(context);
      },
      shouldRetry: () => false,
    }),
    /configuration_error/,
  );

  assert.deepEqual(opened, ["context-1"]);
  assert.deepEqual(closed, []);
});

for (const label of ["Payment", "Thanh toán", "支付", "支払い"]) {
  test(`vn.payment-resume: follows the official two-step payment handoff in locale ${label}`, async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent(`
        <button id="payment-action">${label}</button>
        <div id="dialog" role="dialog" hidden>
          <p>Are you sure you want to pay for the selected applications?</p>
          <button id="confirm">Confirm</button>
        </div>
        <script>
          document.querySelector('#payment-action').addEventListener('click', () => {
            document.querySelector('#dialog').hidden = false;
          });
          document.querySelector('#confirm').addEventListener('click', () => {
            document.body.innerHTML = '<h1>PAYMENT’S INFORMATION</h1><label>I agree to pay</label>';
          });
        </script>
      `);

      const result = await followVietnamSearchPaymentEntry(page, 3_000);

      assert.equal(result.outcome, "advanced");
      assert.equal(result.matchedActionLabel, label);
      assert.equal(result.confirmationObserved, true);
    } finally {
      await browser.close();
    }
  });
}

test("vn.payment-resume: follows the individual application detail handoff without expecting a modal", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route("https://fixture.invalid/e-visa/search", async (route) => {
      await route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" });
    });
    await page.goto("https://fixture.invalid/e-visa/search");
    await page.setContent(`
      <button id="payment-action">Thanh toán</button>
      <script>
        document.querySelector('#payment-action').addEventListener('click', () => {
          history.pushState({}, '', '/e-visa/foreigners/test-record?email=managed%40example.invalid');
        });
      </script>
    `);

    const result = await followVietnamSearchPaymentEntry(page, 3_000);

    assert.equal(result.outcome, "advanced");
    assert.equal(result.matchedActionLabel, "Thanh toán");
    assert.equal(result.confirmationObserved, undefined);
    assert.equal(result.finalRoute, "applicant_detail");
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: waits for the Vue result action instead of racing a delayed response", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div id="result"></div>
      <script>
        setTimeout(() => {
          document.querySelector('#result').innerHTML = '<button id="payment-action">Payment</button><div role="dialog" hidden><p>Are you sure you want to pay for the selected applications?</p><button id="confirm">Confirm</button></div>';
          document.querySelector('#payment-action').addEventListener('click', () => {
            document.querySelector('[role="dialog"]').hidden = false;
          });
          document.querySelector('#confirm').addEventListener('click', () => {
            document.body.innerHTML = '<h1>PAYMENT INFORMATION</h1>';
          });
        }, 600);
      </script>
    `);

    const result = await followVietnamSearchPaymentEntry(page, 3_000);

    assert.equal(result.outcome, "advanced");
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: does not click unrelated pay-like actions", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<button id="unrelated">Pay to edit</button><p>Download payment receipt</p>');

    const result = await followVietnamSearchPaymentEntry(page, 600);

    assert.equal(result.outcome, "not_found");
    assert.equal(await page.locator('#unrelated').isVisible(), true);
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: reports a disabled official payment action", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<button disabled>Thanh toán</button>');

    const result = await followVietnamSearchPaymentEntry(page, 600);

    assert.equal(result.outcome, "disabled");
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: does not report success when the first click has no confirmation", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<button>Payment</button>');

    const result = await followVietnamSearchPaymentEntry(page, 700);

    assert.equal(result.outcome, "confirmation_missing");
    assert.equal(result.confirmationObserved, false);
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: advances the default Vietnamese detail and payment steps", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <h1>Khai thông tin đề nghị</h1>
      <button id="next">Tiếp tục</button>
      <script>
        document.querySelector('#next').addEventListener('click', () => {
          document.body.innerHTML = '<label><input type="checkbox" /> Tôi đồng ý thanh toán</label><button id="pay">Thanh toán</button>';
          document.querySelector('#pay').addEventListener('click', () => {
            document.body.innerHTML = '<h1>Payment gateway</h1><label>Card number</label>';
          });
        });
      </script>
    `);

    await advanceOfficialFormToPayment(page, 10_000);

    assert.match(await page.locator('body').innerText(), /Payment gateway/);
    assert.equal(await page.locator('input[type="checkbox"]').count(), 0);
  } finally {
    await browser.close();
  }
});

test("vn.payment-resume: waits for the applicant detail SPA after the route changes", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div class="skeleton">Loading</div>
      <script>
        setTimeout(() => {
          document.body.innerHTML = '<h1>Khai thông tin đề nghị</h1><button id="next">Tiếp tục</button>';
          document.querySelector('#next').addEventListener('click', () => {
            document.body.innerHTML = '<label><input type="checkbox" /> Tôi đồng ý thanh toán</label><button id="pay">Thanh toán</button>';
            document.querySelector('#pay').addEventListener('click', () => {
              document.body.innerHTML = '<h1>Payment gateway</h1><label>Card number</label>';
            });
          });
        }, 700);
      </script>
    `);

    await advanceOfficialFormToPayment(page, 10_000);

    assert.match(await page.locator('body').innerText(), /Payment gateway/);
  } finally {
    await browser.close();
  }
});
