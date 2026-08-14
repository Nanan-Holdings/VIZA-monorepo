import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import {
  extractVietnamPaymentReceiptReference,
  getVietnamBankAppWaitMs,
  isStandardCharteredBankAppChallenge,
  loadVietnamFixedCardFromEnv,
  payVietnamPortalWithFixedCard,
  parseVietnamFixedCardInput,
  redactVietnamFixedCard,
  waitForStandardCharteredBankAppChallenge,
  vietnamPaymentNeedsHuman,
} from "../fixed-card-payment";
import { RunnerJobOwnershipLostError, type RunnerExecutionContext } from "../../queue/execution-context.js";

test("vn.fixed-card-payment: disabled unless both fixed card and autopay flags are enabled", () => {
  assert.equal(loadVietnamFixedCardFromEnv({}), null);
  assert.equal(loadVietnamFixedCardFromEnv({ VN_FIXED_CARD_ENABLED: "true" }), null);
  assert.equal(loadVietnamFixedCardFromEnv({ VN_OFFICIAL_PAYMENT_AUTOPAY: "true" }), null);
});

test("vn.fixed-card-payment: loads and normalizes a fixed card from env", () => {
  const card = loadVietnamFixedCardFromEnv({
    VN_FIXED_CARD_ENABLED: "true",
    VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
    VN_FIXED_CARD_PAN: "4111 1111 1111 1111",
    VN_FIXED_CARD_EXPIRY: "1/31",
    VN_FIXED_CARD_CVV: "123",
    VN_FIXED_CARD_HOLDER_NAME: "VIZA TEST",
  });

  assert.deepEqual(card, {
    pan: "4111111111111111",
    expiryMonth: "01",
    expiryYear: "2031",
    cvv: "123",
    holderName: "VIZA TEST",
  });
});

test("vn.fixed-card-payment: redaction never returns PAN or CVV", () => {
  const card = loadVietnamFixedCardFromEnv({
    VN_FIXED_CARD_ENABLED: "true",
    VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
    VN_FIXED_CARD_PAN: "4111111111111111",
    VN_FIXED_CARD_EXPIRY: "02/2032",
    VN_FIXED_CARD_CVV: "123",
  });

  assert.deepEqual(redactVietnamFixedCard(card), {
    enabled: true,
    last4: "1111",
    expiryMonth: "02",
    expiryYear: "2032",
    holderNamePresent: true,
  });
  assert.equal(JSON.stringify(redactVietnamFixedCard(card)).includes("4111111111111111"), false);
  assert.equal(JSON.stringify(redactVietnamFixedCard(card)).includes("123"), false);
});

test("vn.fixed-card-payment: parses one-time frontend card input", () => {
  const card = parseVietnamFixedCardInput({
    pan: "4111 1111 1111 1111",
    expiry: "1/2031",
    cvv: "321",
    holderName: "Applicant",
  });

  assert.deepEqual(card, {
    pan: "4111111111111111",
    expiryMonth: "01",
    expiryYear: "2031",
    cvv: "321",
    holderName: "Applicant",
  });
});

test("vn.fixed-card-payment: rejects malformed sensitive fields", () => {
  assert.throws(
    () => loadVietnamFixedCardFromEnv({
      VN_FIXED_CARD_ENABLED: "true",
      VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
      VN_FIXED_CARD_PAN: "not-a-card",
      VN_FIXED_CARD_EXPIRY: "02/32",
      VN_FIXED_CARD_CVV: "123",
    }),
    /VN_FIXED_CARD_PAN/,
  );
  assert.throws(
    () => loadVietnamFixedCardFromEnv({
      VN_FIXED_CARD_ENABLED: "true",
      VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
      VN_FIXED_CARD_PAN: "4111111111111111",
      VN_FIXED_CARD_EXPIRY: "13/31",
      VN_FIXED_CARD_CVV: "123",
    }),
    /VN_FIXED_CARD_EXPIRY/,
  );
  assert.throws(
    () => loadVietnamFixedCardFromEnv({
      VN_FIXED_CARD_ENABLED: "true",
      VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
      VN_FIXED_CARD_PAN: "4111111111111111",
      VN_FIXED_CARD_EXPIRY: "02/32",
      VN_FIXED_CARD_CVV: "12",
    }),
    /VN_FIXED_CARD_CVV/,
  );
});

test("vn.fixed-card-payment: detects human-only payment challenges", () => {
  assert.equal(vietnamPaymentNeedsHuman("Please complete 3D Secure authentication"), true);
  assert.equal(vietnamPaymentNeedsHuman("Enter one-time password from your bank"), true);
  assert.equal(vietnamPaymentNeedsHuman("Payment amount 25 USD"), false);
});

test("vn.fixed-card-payment: detects Standard Chartered bank-app out-of-band challenge", () => {
  assert.equal(
    isStandardCharteredBankAppChallenge(
      "Authenticate with your SC Mobile Banking App. Tap the push notification to approve this transaction.",
    ),
    true,
  );
  assert.equal(isStandardCharteredBankAppChallenge("Click here to complete your purchase"), true);
  assert.equal(isStandardCharteredBankAppChallenge("Payment amount 25 USD"), false);
});

test("vn.fixed-card-payment: clamps bank-app wait timeout", () => {
  assert.equal(getVietnamBankAppWaitMs({}), 115_000);
  assert.equal(getVietnamBankAppWaitMs({ VN_BANK_APP_3DS_WAIT_MS: "120000" }), 120_000);
  assert.equal(getVietnamBankAppWaitMs({ VN_BANK_APP_3DS_WAIT_MS: "1000" }), 10_000);
  assert.equal(getVietnamBankAppWaitMs({ VN_BANK_APP_3DS_WAIT_MS: "999999" }), 180_000);
  assert.equal(getVietnamBankAppWaitMs({ VN_BANK_APP_3DS_WAIT_MS: "invalid" }), 115_000);
});

test("vn.fixed-card-payment: keeps the issuer page alive and follows its completion control", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <form id="ValidateOutOfBandCredentialForm">
        <p>Authenticate with your SC Mobile Banking App and approve this transaction.</p>
        <button type="button" id="OOBValidateButton" onclick="window.completionClicked = true; this.closest('form').remove()">Click here to complete your purchase</button>
      </form>
    `);
    await page.locator("#OOBValidateButton").waitFor();
    let progressEmitted = false;

    const result = await waitForStandardCharteredBankAppChallenge({
      page,
      timeoutMs: 10_000,
      onBankAuthenticationRequired: () => {
        progressEmitted = true;
      },
    });

    assert.equal(result, "settled");
    assert.equal(progressEmitted, true);
    assert.equal(await page.evaluate(() => Boolean((window as typeof window & { completionClicked?: boolean }).completionClicked)), true);
    assert.equal(await page.locator("#ValidateOutOfBandCredentialForm").count(), 0);
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: waits for a delayed issuer bank-app challenge", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="gateway-status">Contacting card issuer...</main>');
    await page.evaluate(() => {
      window.setTimeout(() => {
        document.body.innerHTML = `
          <form id="ValidateOutOfBandCredentialForm">
            <p>Authenticate with your SC Mobile Banking App and approve this transaction.</p>
            <button type="button" id="OOBValidateButton" onclick="this.closest('form').remove()">
              Click here to complete your purchase
            </button>
          </form>
        `;
      }, 750);
    });
    let progressEmitted = false;

    const startedAt = Date.now();
    const result = await waitForStandardCharteredBankAppChallenge({
      page,
      timeoutMs: 5_000,
      appearanceTimeoutMs: 3_000,
      onBankAuthenticationRequired: () => {
        progressEmitted = true;
      },
    });

    assert.equal(result, "settled");
    assert.equal(progressEmitted, true);
    assert.ok(Date.now() - startedAt >= 500);
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: stops waiting when a receipt appears before a bank challenge", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main id="gateway-status">Contacting card issuer...</main>');
    await page.evaluate(() => {
      window.setTimeout(() => {
        document.body.innerHTML = '<p>Receipt: VN-SYNTH67890</p>';
      }, 250);
    });

    const startedAt = Date.now();
    const result = await waitForStandardCharteredBankAppChallenge({
      page,
      timeoutMs: 5_000,
      appearanceTimeoutMs: 3_000,
    });

    assert.equal(result, "not_present");
    assert.ok(Date.now() - startedAt < 2_500);
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: bounds issuer challenge discovery when no challenge arrives", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<main>Contacting card issuer...</main>');

    const startedAt = Date.now();
    const result = await waitForStandardCharteredBankAppChallenge({
      page,
      timeoutMs: 5_000,
      appearanceTimeoutMs: 750,
    });

    assert.equal(result, "not_present");
    assert.ok(Date.now() - startedAt >= 500);
    assert.ok(Date.now() - startedAt < 2_500);
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: extracts receipt references", () => {
  assert.equal(extractVietnamPaymentReceiptReference("Receipt: VN-ABC12345"), "VN-ABC12345");
  assert.equal(extractVietnamPaymentReceiptReference("Transaction reference # TX998877"), "TX998877");
  assert.equal(extractVietnamPaymentReceiptReference("No payment reference yet"), null);
});

test("vn.fixed-card-payment: fills VNPAY cardExpire and uses the managed contact alias", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway</h1>
        <label>Card number <input id="cardNumber" /></label>
        <label>Expiry <input id="cardExpire" placeholder="MM/YY" /></label>
        <label>CVV <input id="cardCVV" /></label>
        <label>Email <input id="paymentEmail" type="email" /></label>
        <button type="button" id="btnContinue" onclick="document.querySelector('#btnAgree').hidden = false">Pay</button>
        <button type="button" id="btnAgree" hidden onclick="
          window.submittedPayment = {
            expiry: document.querySelector('#cardExpire').value,
            email: document.querySelector('#paymentEmail').value
          };
          document.querySelector('main').innerHTML = '<p>Receipt: VN-SYNTH12345</p>';
        ">Agree</button>
      </main>
    `);

    const result = await payVietnamPortalWithFixedCard({
      page,
      card: parseVietnamFixedCardInput({
        pan: "4111111111111111",
        expiry: "01/31",
        cvv: "123",
        holderName: "Synthetic Applicant",
      }),
      contactEmail: "appl-synthetic@viza.it.com",
      paymentTransitionTimeoutMs: 2_000,
    });

    assert.equal(result.status, "paid");
    assert.equal(result.receiptReference, "VN-SYNTH12345");
    assert.deepEqual(
      await page.evaluate(() => (window as typeof window & {
        submittedPayment?: { expiry: string; email: string };
      }).submittedPayment),
      { expiry: "01/31", email: "appl-synthetic@viza.it.com" },
    );
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: completes when the issuer challenge appears after the VNPAY transition", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway</h1>
        <input id="cardNumber" />
        <input id="cardExpire" placeholder="MM/YY" />
        <input id="cardCVV" />
        <button type="button" id="btnContinue">Pay</button>
        <button type="button" id="btnAgree" hidden>Agree</button>
      </main>
    `);
    await page.evaluate(() => {
      document.querySelector("#btnContinue")?.addEventListener("click", () => {
        const agree = document.querySelector<HTMLButtonElement>("#btnAgree");
        if (agree) agree.hidden = false;
      });
      document.querySelector("#btnAgree")?.addEventListener("click", () => {
        document.body.innerHTML = "<main>Contacting card issuer...</main>";
        window.setTimeout(() => {
          document.body.innerHTML = `
            <form id="ValidateOutOfBandCredentialForm">
              <p>Authenticate with your SC Mobile Banking App and approve this transaction.</p>
              <button type="button" id="OOBValidateButton">Click here to complete your purchase</button>
            </form>
          `;
          document.querySelector("#OOBValidateButton")?.addEventListener("click", () => {
            document.body.innerHTML = "<p>Receipt: VN-DELAYED123</p>";
          });
        }, 750);
      });
    });
    let progressEmitted = false;

    const result = await payVietnamPortalWithFixedCard({
      page,
      card: parseVietnamFixedCardInput({
        pan: "4111111111111111",
        expiry: "01/31",
        cvv: "123",
        holderName: "Synthetic Applicant",
      }),
      contactEmail: "appl-synthetic@viza.it.com",
      paymentTransitionTimeoutMs: 2_000,
      onBankAuthenticationRequired: () => {
        progressEmitted = true;
      },
    });

    assert.equal(result.status, "paid");
    assert.equal(result.receiptReference, "VN-DELAYED123");
    assert.equal(progressEmitted, true);
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: does not report a submission when VNPAY remains on the card form", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway</h1>
        <input id="cardNumber" />
        <input id="cardExpire" placeholder="MM/YY" />
        <input id="cardCVV" />
        <button type="button" id="btnContinue">Pay</button>
      </main>
    `);

    const result = await payVietnamPortalWithFixedCard({
      page,
      card: parseVietnamFixedCardInput({
        pan: "4111111111111111",
        expiry: "01/31",
        cvv: "123",
        holderName: "Synthetic Applicant",
      }),
      contactEmail: "appl-synthetic@viza.it.com",
      paymentTransitionTimeoutMs: 1_000,
    });

    assert.equal(result.status, "needs_human");
    assert.match(result.reason ?? "", /no bank authentication was initiated/i);
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: ownership loss blocks the first Payment action", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment information</h1>
        <input type="checkbox" id="terms" />
        <button type="button" id="payment" onclick="window.paymentClicked = true">Payment</button>
      </main>
    `);
    const ownershipLost = new RunnerJobOwnershipLostError("lease lost before payment");
    const execution: RunnerExecutionContext = {
      signal: new AbortController().signal,
      assertOwned: () => {
        throw ownershipLost;
      },
      checkpoint: () => {
        throw ownershipLost;
      },
    };
    const paymentInput = {
      page,
      card: parseVietnamFixedCardInput({
        pan: "4111111111111111",
        expiry: "01/31",
        cvv: "123",
        holderName: "Synthetic Applicant",
      }),
      executionContext: execution,
    };

    await assert.rejects(
      () => payVietnamPortalWithFixedCard(paymentInput as never),
      (error: unknown) => error === ownershipLost,
    );
    assert.equal(
      await page.evaluate(() => Boolean((window as typeof window & { paymentClicked?: boolean }).paymentClicked)),
      false,
    );
  } finally {
    await browser.close();
  }
});
