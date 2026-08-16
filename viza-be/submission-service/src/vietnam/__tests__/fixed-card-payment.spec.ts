import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import {
  advanceVietnamPortalToCardEntry,
  extractVietnamPaymentReceiptReference,
  getVietnamBankAppWaitMs,
  hasVietnamPaymentPageEvidence,
  isStandardCharteredBankAppChallenge,
  loadVietnamFixedCardFromEnv,
  payVietnamPortalWithFixedCard,
  parseVietnamFixedCardInput,
  redactVietnamFixedCard,
  waitForStandardCharteredBankAppChallenge,
  vietnamPaymentNeedsHuman,
  verifyVietnamOfficialFeeText,
} from "../fixed-card-payment";

test("vn.fixed-card-payment: trip expense credit-card text is not payment-page evidence", () => {
  assert.equal(
    hasVietnamPaymentPageEvidence(
      "https://evisa.gov.vn/e-visa/foreigners/example",
      "Fill out the application form\nPayment method\nCredit card",
    ),
    false,
  );
  assert.equal(
    hasVietnamPaymentPageEvidence(
      "https://gateway.example.invalid/checkout",
      "Payment gateway\nCard number\nExpiry\nCVV",
    ),
    true,
  );
});

test("vn.fixed-card-payment: pre-payment QA stops at an empty card field", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway</h1>
        <label>Card number <input id="cardNumber" /></label>
        <label>Expiry <input id="cardExpire" placeholder="MM/YY" /></label>
        <label>CVV <input id="cardCVV" /></label>
        <button type="button" id="btnContinue" onclick="window.paymentSubmitted = true">Pay</button>
      </main>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, timeoutMs: 2_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator("#cardNumber").inputValue(), "");
    assert.equal(await page.locator("#cardExpire").inputValue(), "");
    assert.equal(await page.locator("#cardCVV").inputValue(), "");
    assert.equal(
      await page.evaluate(() => Boolean((window as typeof window & { paymentSubmitted?: boolean }).paymentSubmitted)),
      false,
    );
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: selects a visible VISA logo before continuing from the current VNPAY method page", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <section>International payment cards</section>
        <div class="brand-card"><img alt="VISA" src="/assets/visa.svg" width="120" height="60" /></div>
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
      </main>
      <script>
        window.selectedBrand = '';
        const button = document.querySelector('#continueBtn');
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const update = () => {
          button.classList.toggle('disabled', !(window.selectedBrand === 'visa' && terms.checked));
        };
        document.querySelector('.brand-card').addEventListener('click', () => {
          window.selectedBrand = 'visa';
          update();
        });
        terms.addEventListener('change', update);
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
    assert.equal(
      await page.evaluate(() => (window as typeof window & { selectedBrand?: string }).selectedBrand),
      "visa",
    );
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: ignores a hidden duplicate Continue control on the VNPAY method page", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <section>International payment cards</section>
        <img alt="VISA" src="/assets/visa.svg" width="120" height="60" />
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled" style="display:none">Continue</button>
        <button class="visible-continue">Continue</button>
      </main>
      <script>
        document.querySelector('.visible-continue').addEventListener('click', () => {
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: selects the real international-card radio instead of only its text", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="qr" /> VNPAY supported payment apps</label>
        <label><input type="radio" name="method" value="domestic" /> Domestic payment cards</label>
        <label><input type="radio" name="method" value="international" /> International payment cards
          <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        </label>
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
      </main>
      <script>
        const method = document.querySelector('input[value="international"]');
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(method.checked && terms.checked));
        document.querySelectorAll('input').forEach((input) => input.addEventListener('change', update));
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: replays a trusted terms toggle when only the checkmark was painted", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <label><input name="checkbox-terms" type="checkbox" checked /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
      </main>
      <script>
        let trustedTermsModel = false;
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const button = document.querySelector('#continueBtn');
        terms.addEventListener('change', () => {
          trustedTermsModel = terms.checked;
          button.classList.toggle('disabled', !trustedTermsModel);
        });
        button.addEventListener('click', () => {
          if (!trustedTermsModel) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: trusted-clicks an external label associated with the hidden terms input", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="gateway-terms" name="checkbox-terms" type="checkbox" style="position:absolute;opacity:0" />
        <label for="gateway-terms" id="visible-terms-label"><span class="terms-square"></span> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
      </main>
      <script>
        let labelPointerSeen = false;
        const label = document.querySelector('#visible-terms-label');
        const terms = document.querySelector('#gateway-terms');
        const button = document.querySelector('#continueBtn');
        label.addEventListener('pointerdown', event => { labelPointerSeen = event.isTrusted; });
        terms.addEventListener('change', () => {
          if (labelPointerSeen && terms.checked) button.classList.remove('disabled');
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 5_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: accepts an exact Agree overlay even when its heading changed", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="regulations-modal" class="modal" role="dialog" hidden>
          <h2>Important policy</h2>
          <div id="regulations-agree">Agree</div>
        </div>
      </main>
      <script>
        let accepted = false;
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const modal = document.querySelector('#regulations-modal');
        const button = document.querySelector('#continueBtn');
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) {
            terms.checked = false;
            modal.hidden = false;
          }
          button.classList.toggle('disabled', !(terms.checked && accepted));
        });
        document.querySelector('#regulations-agree').addEventListener('click', () => {
          accepted = true;
          modal.hidden = true;
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 20_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: clicks the visible regulations action when a hidden duplicate is mounted later", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="live-regulations" class="modal" role="dialog" hidden>
          <h2>SERVICE REGULATIONS</h2>
          <button id="live-agree" type="button"><span>Agree</span></button>
        </div>
        <div class="modal" role="dialog" hidden>
          <button type="button">Agree</button>
        </div>
      </main>
      <script>
        let accepted = false;
        let trustedPointerSeen = false;
        const terms = document.querySelector('#live-terms');
        const modal = document.querySelector('#live-regulations');
        const agree = document.querySelector('#live-agree');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(terms.checked && accepted));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) modal.hidden = false;
          update();
        });
        agree.addEventListener('pointerdown', event => { trustedPointerSeen = event.isTrusted; });
        agree.addEventListener('click', () => {
          if (!trustedPointerSeen) return;
          accepted = true;
          modal.hidden = true;
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: clicks the live VNPAY custom wrapper rather than its bold Agree text", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and <b id="inline-agree">Agree</b> to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="live-regulations" class="modal v-modal" role="dialog" hidden>
          <h2>SERVICE REGULATIONS</h2>
          <div id="live-agree" style="width:320px;height:44px;display:flex;align-items:center;justify-content:center"><b>Agree</b></div>
        </div>
      </main>
      <script>
        let accepted = false;
        window.inlineAgreeClicks = 0;
        const terms = document.querySelector('#live-terms');
        const modal = document.querySelector('#live-regulations');
        const agree = document.querySelector('#live-agree');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(terms.checked && accepted));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) modal.hidden = false;
          update();
        });
        agree.addEventListener('click', event => {
          if (event.target !== agree) return;
          accepted = true;
          modal.hidden = true;
          terms.checked = true;
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: scrolls service regulations to the bottom before agreeing", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="live-regulations" class="modal v-modal" role="dialog" hidden>
          <h2>SERVICE REGULATIONS</h2>
          <div id="regulations-copy" style="height:80px;overflow:auto">
            <div style="height:600px">Official regulations</div>
          </div>
          <div id="live-agree" style="width:320px;height:44px;display:flex;align-items:center;justify-content:center"><b>Agree</b></div>
        </div>
      </main>
      <script>
        let accepted = false;
        const terms = document.querySelector('#live-terms');
        const modal = document.querySelector('#live-regulations');
        const copy = document.querySelector('#regulations-copy');
        const agree = document.querySelector('#live-agree');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(terms.checked && accepted));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) modal.hidden = false;
          update();
        });
        agree.addEventListener('click', () => {
          if (copy.scrollTop + copy.clientHeight < copy.scrollHeight - 1) return;
          accepted = true;
          modal.hidden = true;
          terms.checked = true;
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: uses the regulations footer action when Agree text is not its ancestor", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="live-regulations" class="modal v-modal" role="dialog" hidden style="position:fixed;left:100px;top:50px;width:600px;height:400px;background:white">
          <h2>SERVICE REGULATIONS</h2>
          <b style="position:absolute;right:105px;bottom:42px;pointer-events:none">Agree</b>
          <button id="disagree" style="position:absolute;left:40px;bottom:25px;width:250px;height:55px">Disagree</button>
          <button id="real-agree" aria-label="Agree" style="position:absolute;right:40px;bottom:25px;width:250px;height:55px;color:transparent">.</button>
        </div>
      </main>
      <script>
        let accepted = false;
        const terms = document.querySelector('#live-terms');
        const modal = document.querySelector('#live-regulations');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(terms.checked && accepted));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) modal.hidden = false;
          update();
        });
        document.querySelector('#real-agree').addEventListener('click', () => {
          accepted = true;
          modal.hidden = true;
          terms.checked = true;
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: dispatches the covered footer control from the point layer stack", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="live-regulations" class="modal v-modal" role="dialog" hidden style="position:fixed;left:100px;top:50px;width:600px;height:400px;background:white">
          <h2>SERVICE REGULATIONS</h2>
          <button id="covered-agree" aria-label="Confirm regulations" style="position:absolute;right:40px;bottom:25px;width:250px;height:55px;color:transparent">.</button>
          <div style="position:absolute;right:40px;bottom:25px;width:250px;height:55px;background:white;pointer-events:none"><b>Agree</b></div>
        </div>
      </main>
      <script>
        let accepted = false;
        const terms = document.querySelector('#live-terms');
        const modal = document.querySelector('#live-regulations');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(terms.checked && accepted));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) modal.hidden = false;
          update();
        });
        document.querySelector('#covered-agree').addEventListener('click', event => {
          if (event.isTrusted) return;
          accepted = true;
          modal.hidden = true;
          terms.checked = true;
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: scopes a role-less regulations action to the modal root", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="live-regulations" class="modal v-modal" hidden style="position:fixed;left:100px;top:50px;width:600px;height:400px;background:white">
          <div class="modal-card-body" style="height:280px"><h2>SERVICE REGULATIONS</h2></div>
          <div class="modal-card-foot" style="position:absolute;left:0;right:0;bottom:0;height:90px">
            <div style="position:absolute;left:40px;bottom:20px;width:240px;height:50px">Disagree</div>
            <div id="real-agree" style="position:absolute;right:40px;bottom:20px;width:240px;height:50px"><b>Agree</b></div>
          </div>
        </div>
      </main>
      <script>
        let accepted = false;
        const terms = document.querySelector('#live-terms');
        const modal = document.querySelector('#live-regulations');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(terms.checked && accepted));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) modal.hidden = false;
          update();
        });
        document.querySelector('#real-agree').addEventListener('click', () => {
          accepted = true;
          modal.hidden = true;
          terms.checked = true;
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: accepts regulations inside a payment iframe instead of the page Agree copy", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and <b>Agree</b> to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <iframe id="gateway-frame"></iframe>
      </main>
      <script>
        const terms = document.querySelector('#live-terms');
        const button = document.querySelector('#continueBtn');
        const frame = document.querySelector('#gateway-frame');
        frame.srcdoc = '<div class="modal v-modal" style="position:fixed;left:40px;top:20px;width:600px;height:400px;background:white"><div class="modal-card-body"><h2>SERVICE REGULATIONS</h2></div><div class="modal-card-foot" style="position:absolute;left:0;right:0;bottom:0;height:90px"><div style="position:absolute;left:40px;bottom:20px;width:240px;height:50px">Disagree</div><div id="frame-agree" style="position:absolute;right:40px;bottom:20px;width:240px;height:50px"><b>Agree</b></div></div></div><script>document.querySelector("#frame-agree").addEventListener("click", () => { parent.document.querySelector("#live-terms").checked = true; parent.document.querySelector("#continueBtn").classList.remove("disabled"); document.querySelector(".modal").remove(); });<\\/script>';
        terms.addEventListener('change', () => {
          if (terms.checked) button.classList.remove('disabled');
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);
    await page.frameLocator('#gateway-frame').locator('.modal.v-modal').waitFor({ state: 'visible' });

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: rechecks terms after the regulations commit asynchronously resets them", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="live-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-terms">I have read and <b id="inline-agree-reset">Agree</b> to the Terms and Conditions</label>
        <button id="continueBtn" class="ubtn disabled">Continue</button>
        <div id="live-regulations" class="modal v-modal" hidden style="position:fixed;left:100px;top:50px;width:600px;height:400px;background:white">
          <h2>SERVICE REGULATIONS</h2>
          <div id="real-agree" style="position:absolute;right:40px;bottom:25px;width:250px;height:55px"><b>Agree</b></div>
        </div>
      </main>
      <script>
        let accepted = false;
        window.inlineAgreeClicks = 0;
        const terms = document.querySelector('#live-terms');
        const modal = document.querySelector('#live-regulations');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(accepted && terms.checked));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) {
            terms.checked = false;
            modal.hidden = false;
          }
          update();
        });
        document.querySelector('#real-agree').addEventListener('click', () => {
          accepted = true;
          modal.hidden = true;
          terms.checked = true;
          update();
          setTimeout(() => {
            terms.checked = false;
            update();
          }, 250);
        });
        document.querySelector('#inline-agree-reset').addEventListener('click', () => { window.inlineAgreeClicks += 1; });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
    assert.equal(
      await page.evaluate(() => (window as typeof window & { inlineAgreeClicks: number }).inlineAgreeClicks),
      0,
    );
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: finds a regulations action appended after a large payment-page DOM", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="large-terms" name="checkbox-terms" type="checkbox" />
        <label for="large-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="filler"></div>
        <div id="large-regulations" class="modal v-modal" role="dialog" hidden>
          <h2>SERVICE REGULATIONS</h2>
          <button id="large-agree" type="button"><span>Agree</span></button>
        </div>
      </main>
      <script>
        document.querySelector('#filler').innerHTML = Array.from({ length: 450 }, (_, index) => '<div><span>Gateway row ' + index + '</span></div>').join('');
        let accepted = false;
        const terms = document.querySelector('#large-terms');
        const modal = document.querySelector('#large-regulations');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(terms.checked && accepted));
        terms.addEventListener('change', () => {
          if (terms.checked && !accepted) modal.hidden = false;
          update();
        });
        document.querySelector('#large-agree').addEventListener('click', () => {
          accepted = true;
          modal.hidden = true;
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: waits for the gateway to commit Agree before toggling terms again", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="international" checked /> International payment cards</label>
        <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        <input id="async-terms" name="checkbox-terms" type="checkbox" />
        <label for="async-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div id="async-regulations" class="modal v-modal" role="dialog" hidden>
          <h2>SERVICE REGULATIONS</h2>
          <button id="async-agree" type="button">Agree</button>
        </div>
      </main>
      <script>
        let agreementPending = false;
        const terms = document.querySelector('#async-terms');
        const modal = document.querySelector('#async-regulations');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !terms.checked);
        terms.addEventListener('change', () => {
          if (terms.checked && !agreementPending) {
            terms.checked = false;
            modal.hidden = false;
          }
          update();
        });
        document.querySelector('#async-agree').addEventListener('click', () => {
          agreementPending = true;
          modal.hidden = true;
          setTimeout(() => {
            terms.checked = true;
            terms.dispatchEvent(new Event('change', { bubbles: true }));
            update();
          }, 600);
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 10_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: replays the payment method when only its radio was painted", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="qr" /> VNPAY supported payment apps</label>
        <label><input type="radio" name="method" value="international" checked /> International payment cards
          <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        </label>
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
      </main>
      <script>
        let trustedMethodModel = false;
        const method = document.querySelector('input[value="international"]');
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const button = document.querySelector('#continueBtn');
        const update = () => button.classList.toggle('disabled', !(trustedMethodModel && terms.checked));
        document.querySelectorAll('input[name="method"]').forEach((input) => input.addEventListener('change', () => {
          trustedMethodModel = method.checked;
          update();
        }));
        terms.addEventListener('change', update);
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: replays the exact bank-code item after regulations commit", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>VNPAY Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="payment-method" value="QR" /> VNPAY supported payment apps</label>
        <label><input type="radio" name="payment-method" value="INTERNATIONAL_CARD" checked /> International payment cards</label>
        <div id="accordionList3" class="show">
          <div class="list-bank-item" bank-code="VISA"><img alt="VISA" src="/assets/visa.svg" width="40" height="20" /></div>
        </div>
        <input id="live-bank-terms" name="checkbox-terms" type="checkbox" />
        <label for="live-bank-terms">I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="ubtn disabled">Continue</button>
        <div class="modal v-modal" style="display:none">
          <div class="modal-card-body"><h2>SERVICE REGULATIONS</h2></div>
          <div class="modal-card-foot"><a id="live-bank-agree">Agree</a></div>
        </div>
      </main>
      <script>
        const international = document.querySelector('input[value="INTERNATIONAL_CARD"]');
        const terms = document.querySelector('#live-bank-terms');
        const bank = document.querySelector('[bank-code="VISA"]');
        const button = document.querySelector('#continueBtn');
        const modal = document.querySelector('.modal.v-modal');
        let trustedMethodModel = false;
        let trustedBankModel = false;
        let regulationsAccepted = false;
        const update = () => button.classList.toggle(
          'disabled',
          !(trustedMethodModel && trustedBankModel && regulationsAccepted && terms.checked),
        );
        document.querySelectorAll('input[name="payment-method"]').forEach((input) => {
          input.addEventListener('change', () => {
            trustedMethodModel = international.checked;
            update();
          });
        });
        bank.addEventListener('click', () => {
          if (!regulationsAccepted) return;
          trustedBankModel = true;
          bank.classList.add('active');
          update();
        });
        terms.addEventListener('change', () => {
          if (terms.checked && !regulationsAccepted) {
            terms.checked = false;
            modal.style.display = 'block';
          }
          update();
        });
        document.querySelector('#live-bank-agree').addEventListener('click', () => {
          regulationsAccepted = true;
          terms.checked = true;
          modal.style.display = 'none';
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 30_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: accepts service regulations before enabling Continue", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="qr" /> VNPAY supported payment apps</label>
        <label><input type="radio" name="method" value="international" /> International payment cards
          <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        </label>
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div class="modal" style="display:none">
          <h2>SERVICE REGULATIONS</h2>
          <div id="regulations-agree">Agree</div>
        </div>
      </main>
      <script>
        const method = document.querySelector('input[value="international"]');
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const button = document.querySelector('#continueBtn');
        const modal = document.querySelector('.modal');
        let regulationsAccepted = false;
        const update = () => button.classList.toggle('disabled', !(method.checked && terms.checked && regulationsAccepted));
        document.querySelectorAll('input[name="method"]').forEach((input) => input.addEventListener('change', update));
        terms.addEventListener('change', () => {
          if (terms.checked && !regulationsAccepted) {
            terms.checked = false;
            modal.style.display = 'block';
          }
          update();
        });
        document.querySelector('#regulations-agree').addEventListener('click', () => {
          regulationsAccepted = true;
          modal.style.display = 'none';
          update();
        });
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: accepts service regulations opened by Continue", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="qr" /> VNPAY supported payment apps</label>
        <label><input type="radio" name="method" value="international" /> International payment cards
          <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        </label>
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div class="regulations" style="display:none">
          <h2>SERVICE REGULATIONS</h2>
          <div id="continue-regulations-agree">Agree</div>
        </div>
      </main>
      <script>
        const method = document.querySelector('input[value="international"]');
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const button = document.querySelector('#continueBtn');
        const regulations = document.querySelector('.regulations');
        const update = () => button.classList.toggle('disabled', !(method.checked && terms.checked));
        document.querySelectorAll('input').forEach((input) => input.addEventListener('change', update));
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          regulations.style.display = 'block';
        });
        document.querySelector('#continue-regulations-agree').addEventListener('click', () => {
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: rechecks terms after regulations reset the checkbox", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <h1>Payment gateway - Select payment method</h1>
        <p>Vietcombank</p>
        <label><input type="radio" name="method" value="qr" /> VNPAY supported payment apps</label>
        <label><input type="radio" name="method" value="international" /> International payment cards
          <img alt="VISA" src="/assets/visa.svg" width="40" height="20" />
        </label>
        <label><input name="checkbox-terms" type="checkbox" /> I have read and Agree to the Terms and Conditions</label>
        <button id="continueBtn" class="disabled">Continue</button>
        <div class="regulations" style="display:none">
          <h2>SERVICE REGULATIONS</h2>
          <div id="reset-regulations-agree">Agree</div>
        </div>
      </main>
      <script>
        const method = document.querySelector('input[value="international"]');
        const terms = document.querySelector('input[name="checkbox-terms"]');
        const button = document.querySelector('#continueBtn');
        const regulations = document.querySelector('.regulations');
        let regulationsAccepted = false;
        const update = () => button.classList.toggle('disabled', !(method.checked && terms.checked));
        document.querySelectorAll('input').forEach((input) => input.addEventListener('change', update));
        button.addEventListener('click', () => {
          if (button.classList.contains('disabled')) return;
          if (!regulationsAccepted) {
            regulations.style.display = 'block';
            return;
          }
          document.body.innerHTML = '<h1>Card number</h1><input autocomplete="cc-number" />';
        });
        document.querySelector('#reset-regulations-agree').addEventListener('click', () => {
          regulationsAccepted = true;
          regulations.style.display = 'none';
          terms.checked = false;
          terms.dispatchEvent(new Event('change', { bubbles: true }));
        });
      </script>
    `);

    const result = await advanceVietnamPortalToCardEntry({ page, cardBrand: "visa", timeoutMs: 3_000 });

    assert.deepEqual(result, { status: "ready" });
    assert.equal(await page.locator('input[autocomplete="cc-number"]').inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("vn.fixed-card-payment: disabled unless both fixed card and autopay flags are enabled", () => {
  assert.equal(loadVietnamFixedCardFromEnv({}), null);
  assert.equal(loadVietnamFixedCardFromEnv({ VN_FIXED_CARD_ENABLED: "true" }), null);
  assert.equal(loadVietnamFixedCardFromEnv({ VN_OFFICIAL_PAYMENT_AUTOPAY: "true" }), null);
});

test("vn.fixed-card-payment: loads and normalizes a fixed card from env", () => {
  const card = loadVietnamFixedCardFromEnv({
    NODE_ENV: "test",
    VN_LOCAL_CARD_SESSION_ENABLED: "true",
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
    NODE_ENV: "test",
    VN_LOCAL_CARD_SESSION_ENABLED: "true",
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

test("vn.fixed-card-payment: rejects process-wide card secrets in production", () => {
  assert.equal(loadVietnamFixedCardFromEnv({
    NODE_ENV: "production",
    VN_LOCAL_CARD_SESSION_ENABLED: "true",
    VN_FIXED_CARD_ENABLED: "true",
    VN_OFFICIAL_PAYMENT_AUTOPAY: "true",
    VN_FIXED_CARD_PAN: "4111111111111111",
    VN_FIXED_CARD_EXPIRY: "01/31",
    VN_FIXED_CARD_CVV: "123",
  }), null);
});

test("vn.fixed-card-payment: verifies visible amount and currency exactly", () => {
  assert.deepEqual(
    verifyVietnamOfficialFeeText({
      bodyText: "Payment information Amount paid (USD): 25.00 I agree to pay",
      expectedAmountCents: 2_500,
      expectedCurrency: "USD",
    }),
    { verified: true, amountCents: 2_500, currency: "USD" },
  );
  assert.deepEqual(
    verifyVietnamOfficialFeeText({
      bodyText: "Amount paid (USD): 26.00",
      expectedAmountCents: 2_500,
      expectedCurrency: "USD",
    }),
    { verified: false, reason: "amount_mismatch" },
  );
  assert.deepEqual(
    verifyVietnamOfficialFeeText({ bodyText: "Payment", expectedAmountCents: null, expectedCurrency: "USD" }),
    { verified: false, reason: "expectation_missing" },
  );
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
      NODE_ENV: "test",
      VN_LOCAL_CARD_SESSION_ENABLED: "true",
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
      NODE_ENV: "test",
      VN_LOCAL_CARD_SESSION_ENABLED: "true",
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
      NODE_ENV: "test",
      VN_LOCAL_CARD_SESSION_ENABLED: "true",
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
