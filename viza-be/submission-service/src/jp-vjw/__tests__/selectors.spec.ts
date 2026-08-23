import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { fillJpVjwVerificationCode } from "../live-adapter";
import {
  JP_VJW_ACCOUNT_CREATED_NAME,
  JP_VJW_CREATE_ACCOUNT_NAME,
  JP_VJW_GO_TO_LOGIN_NAME,
  JP_VJW_MFA_NO_NAME,
  JP_VJW_OPTIONAL_MFA_HEADING,
  JP_VJW_YOUR_DETAILS_NAME,
  hasOfficialJpVjwQrEvidence,
  isJpVjwCloudfrontAccessGate,
  isOfficialJpVjwUrl,
  resolveJpVjwUserAgent,
} from "../selectors";

test("Visit Japan Web account selector accepts the observed production label", () => {
  assert.match("Create an account", JP_VJW_CREATE_ACCOUNT_NAME);
  assert.match("Create new account", JP_VJW_CREATE_ACCOUNT_NAME);
  assert.match("新規アカウント作成", JP_VJW_CREATE_ACCOUNT_NAME);
});

test("Visit Japan Web account-success selectors accept the observed production dialog", () => {
  assert.match("Your account has been successfully created", JP_VJW_ACCOUNT_CREATED_NAME);
  assert.match("Go To Login Screen", JP_VJW_GO_TO_LOGIN_NAME);
});

test("Visit Japan Web profile-entry selector accepts the observed production dashboard", () => {
  assert.match("Your details", JP_VJW_YOUR_DETAILS_NAME);
});

test("Visit Japan Web optional MFA selectors accept the observed production onboarding", () => {
  assert.match("Setting up Multi-Factor Authentication", JP_VJW_OPTIONAL_MFA_HEADING);
  assert.match("Setting up Multi‑Factor Authentication", JP_VJW_OPTIONAL_MFA_HEADING);
  assert.match("No", JP_VJW_MFA_NO_NAME);
  assert.doesNotMatch("Not registered", JP_VJW_MFA_NO_NAME);
});

test("Visit Japan Web verification code uses keyboard events required by the production OTP widget", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <ng-otp-input>
        ${Array.from({ length: 6 }, (_, index) => `<input maxlength="1" data-index="${index}">`).join("")}
      </ng-otp-input>
      <script>
        const inputs = [...document.querySelectorAll('ng-otp-input input')];
        window.keyboardEvents = 0;
        inputs.forEach((input, index) => {
          input.addEventListener('keydown', () => { window.keyboardEvents += 1; });
          input.addEventListener('input', () => {
            if (input.value && inputs[index + 1]) inputs[index + 1].focus();
          });
        });
      </script>
    `);
    assert.equal(await fillJpVjwVerificationCode(page, "671508"), true);
    assert.deepEqual(await page.locator("ng-otp-input input").evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    ), ["6", "7", "1", "5", "0", "8"]);
    assert.equal(await page.evaluate(() =>
      (window as unknown as Window & { keyboardEvents: number }).keyboardEvents >= 6,
    ), true);
  } finally {
    await browser.close();
  }
});

test("Visit Japan Web QR gate requires official host, visible QR and artifact", () => {
  assert.equal(isOfficialJpVjwUrl("https://www.vjw.digital.go.jp/"), true);
  assert.equal(isOfficialJpVjwUrl("https://example.com/vjw"), false);
  assert.equal(hasOfficialJpVjwQrEvidence({
    portalUrl: "https://www.vjw.digital.go.jp/qr",
    bodyText: "Visit Japan Web QR Code",
    qrElementVisible: true,
    qrArtifactPath: "/tmp/official-qr.png",
  }), true);
  assert.equal(hasOfficialJpVjwQrEvidence({
    portalUrl: "https://www.vjw.digital.go.jp/qr",
    bodyText: "Visit Japan Web QR Code",
    qrElementVisible: true,
    qrArtifactPath: null,
  }), false);
  assert.equal(isJpVjwCloudfrontAccessGate(404, "The request could not be satisfied. CloudFront"), true);
  assert.equal(isJpVjwCloudfrontAccessGate(200, "Visit Japan Web QR Code"), false);
  assert.match(resolveJpVjwUserAgent({}), /Windows NT 10\.0/);
});

test("Visit Japan Web QR gate accepts the official simplified-Chinese QR heading", () => {
  assert.equal(hasOfficialJpVjwQrEvidence({
    portalUrl: "https://www.vjw.digital.go.jp/main/#/vjwpic026",
    bodyText: "入境审查及海关申报的QR码",
    qrElementVisible: true,
    qrArtifactPath: "C:/evidence/official-qr.png",
  }), true);
});
