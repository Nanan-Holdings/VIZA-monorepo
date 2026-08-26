import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import {
  clickImmigrationAndCustoms,
  chooseJpVjwAutocomplete,
  confirmJpVjwDeclarationSave,
  fillJpVjwVerificationCode,
  openJpVjwQrView,
  resolveJpVjwNativeOptionValue,
  type JpVjwLiveAdapterContext,
} from "../live-adapter";
import {
  JP_VJW_ACCOUNT_CREATED_NAME,
  JP_VJW_CONFIRM_ENTERED_DETAILS_NAME,
  JP_VJW_CREATE_ACCOUNT_NAME,
  JP_VJW_GO_TO_LOGIN_NAME,
  JP_VJW_JAPANESE_PASSPORT_QUESTION,
  JP_VJW_MANUAL_PASSPORT_NAME,
  JP_VJW_NEW_TRIP_NAME,
  JP_VJW_NO_COPY_TRIP_NAME,
  JP_VJW_MFA_NO_NAME,
  JP_VJW_OPTIONAL_MFA_HEADING,
  JP_VJW_OPTIONAL_MFA_QUESTION,
  JP_VJW_PROFILE_COMPLETE_NAME,
  JP_VJW_REENTRY_PERMISSION_QUESTION,
  JP_VJW_TAX_FREE_QR_QUESTION,
  JP_VJW_TO_ENTRY_PROCEDURE_NAME,
  JP_VJW_TRIP_REGISTERED_NAME,
  JP_VJW_YOUR_DETAILS_NAME,
  hasOfficialJpVjwQrEvidence,
  isJpVjwDeclarationRegistered,
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
  assert.match("Do you want to set up multi-factor authentication?", JP_VJW_OPTIONAL_MFA_QUESTION);
  assert.match("No", JP_VJW_MFA_NO_NAME);
  assert.doesNotMatch("Not registered", JP_VJW_MFA_NO_NAME);
});

test("Visit Japan Web profile selectors accept the observed production wizard", () => {
  assert.match("Do you have a passport issued by the Japanese government?", JP_VJW_JAPANESE_PASSPORT_QUESTION);
  assert.match("Will you enter Japan with re-entry permission?", JP_VJW_REENTRY_PERMISSION_QUESTION);
  assert.match("Will you use the Tax-free QR Code?", JP_VJW_TAX_FREE_QR_QUESTION);
  assert.match("Enter information yourself", JP_VJW_MANUAL_PASSPORT_NAME);
  assert.match("Registration complete", JP_VJW_PROFILE_COMPLETE_NAME);
  assert.match("Confirm entered details", JP_VJW_CONFIRM_ENTERED_DETAILS_NAME);
  assert.match("Register new planned entry/return", JP_VJW_NEW_TRIP_NAME);
  assert.match("Proceed to registration without copying details", JP_VJW_NO_COPY_TRIP_NAME);
  assert.match("Registered planned entry/return", JP_VJW_TRIP_REGISTERED_NAME);
  assert.match("To entry/return procedure", JP_VJW_TO_ENTRY_PROCEDURE_NAME);
  assert.match("入国・帰国予定を登録しました", JP_VJW_TRIP_REGISTERED_NAME);
  assert.match("入国・帰国手続へ", JP_VJW_TO_ENTRY_PROCEDURE_NAME);
});

test("Visit Japan Web native option matching skips the empty placeholder", () => {
  assert.equal(resolveJpVjwNativeOptionValue([
    { label: "-", value: "" },
    { label: "CHINA (PEOPLE'S REP.)", value: "156" },
  ], ["CHN", "China", "中国"]), "156");
});

test("Visit Japan Web accepts a free-text embarkation point when the official form enables Next", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <input id="textboxDeparture">
      <button class="button-primary" type="button">Next</button>
    `);
    const outcome = await chooseJpVjwAutocomplete(
      { page } as unknown as JpVjwLiveAdapterContext,
      page.locator("#textboxDeparture"),
      "SINGAPORE",
      "departure point",
    );
    assert.equal(outcome, "selected");
    assert.equal(await page.locator("#textboxDeparture").inputValue(), "SINGAPORE");
  } finally {
    await browser.close();
  }
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

test("Visit Japan Web QR action falls back to the verified Angular control when an overlay intercepts pointer clicks", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs: string[] = [];
  try {
    await page.setContent(`
      <a id="qr" role="button" onclick="window.location.hash = '#/vjwpic026'">Display QR</a>
      <div style="position: fixed; inset: 0; z-index: 2"></div>
    `);
    await page.evaluate(() => {
      window.location.hash = "#/vjwpti006";
    });
    await openJpVjwQrView(
      { page, logs } as unknown as JpVjwLiveAdapterContext,
      page.getByRole("button", { name: "Display QR" }),
    );
    assert.match(page.url(), /vjwpic026/u);
    assert.deepEqual(logs, ["jpvjw_qr_action_dom_fallback"]);
  } finally {
    await browser.close();
  }
});

test("Visit Japan Web confirms the observed procedure guide before displaying the official QR route", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs: string[] = [];
  try {
    await page.setContent(`
      <button id="display">Display QR code</button>
      <div id="guide" role="dialog" hidden>
        <h2>Procedure Guide</h2>
        <button id="agree">Agree and display the QR code</button>
        <button>Confirm the contents of the declaration</button>
      </div>
      <script>
        document.querySelector('#display').addEventListener('click', () => {
          document.querySelector('#guide').hidden = false;
        });
        document.querySelector('#agree').addEventListener('click', () => {
          window.location.hash = '#/vjwpic026';
        });
      </script>
    `);
    await page.evaluate(() => {
      window.location.hash = "#/vjwpti006";
    });
    await openJpVjwQrView(
      { page, logs } as unknown as JpVjwLiveAdapterContext,
      page.getByRole("button", { name: "Display QR code" }),
    );
    assert.match(page.url(), /vjwpic026/u);
    assert.deepEqual(logs, ["jpvjw_qr_procedure_guide_confirmed"]);
  } finally {
    await browser.close();
  }
});

test("Visit Japan Web confirms the observed immigration and customs introduction dialog before waiting for the form route", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs: string[] = [];
  try {
    await page.setContent(`
      <button id="declaration">Immigration clearance and Customs declaration Not registered</button>
      <div id="intro" role="dialog" hidden>
        <h2>Immigration clearance and Customs declaration</h2>
        <button id="next">Next</button>
        <button>Back</button>
      </div>
      <script>
        document.querySelector('#declaration').addEventListener('click', () => {
          document.querySelector('#intro').hidden = false;
        });
        document.querySelector('#next').addEventListener('click', () => {
          window.location.hash = '#/vjwpic004';
        });
      </script>
    `);
    await page.evaluate(() => {
      window.location.hash = "#/vjwpti006";
    });
    await clickImmigrationAndCustoms({ page, logs } as unknown as JpVjwLiveAdapterContext);
    assert.match(page.url(), /vjwpic004/u);
    assert.deepEqual(logs, ["jpvjw_immigration_customs_intro_confirmed"]);
  } finally {
    await browser.close();
  }
});

test("Visit Japan Web accepts the observed definitive declaration success dialog before returning for QR evidence", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs: string[] = [];
  try {
    await page.setContent(`
      <div role="dialog">
        <h2>Registration complete</h2>
        <button id="back">Back to Entry/Return Procedure</button>
      </div>
      <script>
        document.querySelector('#back').addEventListener('click', () => {
          window.location.hash = '#/vjwpti006';
        });
      </script>
    `);
    await page.evaluate(() => {
      window.location.hash = "#/vjwpic019";
    });
    await confirmJpVjwDeclarationSave({ page, logs } as unknown as JpVjwLiveAdapterContext);
    assert.match(page.url(), /vjwpti006/u);
    assert.deepEqual(logs, ["jpvjw_declaration_registered_modal_confirmed"]);
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

test("Visit Japan Web declaration state never treats the disabled Not registered card as reusable QR evidence", () => {
  assert.equal(isJpVjwDeclarationRegistered("Immigration clearance and Customs declaration Not registered"), false);
  assert.equal(isJpVjwDeclarationRegistered("Immigration clearance and Customs declaration Registered"), true);
  assert.equal(isJpVjwDeclarationRegistered("入境审查及海关申报 未登记"), false);
  assert.equal(isJpVjwDeclarationRegistered("入国審査及び税関申告 登録済み"), true);
  assert.equal(isJpVjwDeclarationRegistered("Immigration clearance and Customs declaration"), false);
});
