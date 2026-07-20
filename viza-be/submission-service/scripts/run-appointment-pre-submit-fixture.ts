import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  chromium,
  type Locator,
  type Page,
} from "@playwright/test";
import { FRANCE_TLS_SELECTORS } from "../src/france-tls/selectors";
import { US_VISA_SCHEDULING_SELECTORS } from "../src/us-appointment/usvisascheduling-portal";

const OUTPUT_DIR = join(
  process.cwd(),
  "output",
  "playwright",
  "appointment-pre-submit-fixture",
);

const PLACEHOLDER = {
  email: "applicant@example.invalid",
  password: "FixtureOnly-Password-2026!",
  givenName: "Test",
  surname: "Applicant",
  verificationCode: "000000",
  passportNumber: "P0000000",
  ds160Code: "AA00PLACEHOLDER",
  franceReference: "FRA1-PLACEHOLDER",
} as const;

async function firstVisible(page: Page, selector: string): Promise<Locator> {
  const matches = page.locator(selector);
  const count = await matches.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = matches.nth(index);
    if (await candidate.isVisible()) return candidate;
  }
  throw new Error(`Fixture selector did not resolve to a visible control: ${selector}`);
}

async function fillVisible(page: Page, selector: string, value: string) {
  await (await firstVisible(page, selector)).fill(value);
}

function fixtureStyles() {
  return `
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #f7f7fb; color: #1f2937; }
    main { width: min(920px, calc(100% - 48px)); margin: 40px auto; }
    .shell { border: 1px solid #dfe3ee; border-radius: 16px; background: white; box-shadow: 0 16px 50px rgba(31, 41, 55, .08); overflow: hidden; }
    header { padding: 22px 28px; background: linear-gradient(120deg, #ede9fe, #eef2ff); border-bottom: 1px solid #ddd6fe; }
    header p { margin: 6px 0 0; color: #5b6473; }
    section { padding: 28px; }
    .step[hidden] { display: none; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    label { display: grid; gap: 7px; font-size: 13px; font-weight: 650; }
    input { border: 1px solid #cfd5e1; border-radius: 9px; padding: 11px 12px; font: inherit; }
    button, a.action { border: 0; border-radius: 9px; background: #6d28d9; color: white; padding: 11px 16px; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-flex; }
    button.secondary { background: #fff; color: #5b21b6; border: 1px solid #c4b5fd; }
    .actions { display: flex; gap: 10px; margin-top: 22px; }
    .slot { display: flex; align-items: center; justify-content: space-between; border: 1px solid #d8dee9; border-radius: 11px; padding: 15px; }
    .notice { margin-top: 18px; border: 1px solid #f4c96b; border-radius: 10px; background: #fff8e8; padding: 14px; color: #7c4a03; }
    .review { display: grid; gap: 10px; border: 1px solid #d8dee9; border-radius: 11px; padding: 18px; background: #fafbff; }
    .review strong { color: #4c1d95; }
    #official-final-submit, #tls-final-confirm { background: #b91c1c; }
  `;
}

async function runUsFixture(page: Page) {
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>US appointment fixture</title><style>${fixtureStyles()}</style></head>
      <body>
        <main>
          <div class="shell">
            <header><h1>USVisaScheduling pre-submit fixture</h1><p>Offline placeholder flow — no official site or account is used.</p></header>
            <section>
              <div class="step" id="registration">
                <h2>Create account</h2>
                <div class="grid">
                  <label>Username<input id="signInName"></label>
                  <label>Email<input id="email" type="email"></label>
                  <label>Given name<input id="givenName"></label>
                  <label>Surname<input id="surname"></label>
                  <label>New password<input id="newPassword" type="password"></label>
                  <label>Confirm password<input id="reenterPassword" type="password"></label>
                </div>
                <div class="actions"><button id="send-code" onclick="document.querySelector('#verification').hidden=false">Send Verification Code</button></div>
                <div id="verification" hidden>
                  <label style="margin-top:16px">Verification code<input id="email_ver_input"></label>
                  <div class="actions">
                    <button id="verify-code">Verify Code</button>
                    <button id="create-account" onclick="showStep('profile')">Create Account</button>
                  </div>
                </div>
              </div>
              <div class="step" id="profile" hidden>
                <h2>Applicant profile</h2>
                <div class="grid">
                  <label>Passport number<input id="passport-number"></label>
                  <label>DS-160 confirmation<input id="ds160-code"></label>
                </div>
                <div class="actions"><button onclick="showStep('calendar')">Continue to calendar</button></div>
              </div>
              <div class="step" id="calendar" hidden>
                <h2>Observed appointment slots</h2>
                <div class="slot"><span>Beijing · 28 August 2026 · 09:30</span><button data-viza-appointment-slot="fixture-us-1" onclick="showStep('review')">Select</button></div>
              </div>
              <div class="step" id="review" hidden>
                <h2>Review appointment</h2>
                <div class="review">
                  <span>Applicant <strong>Test Applicant</strong></span>
                  <span>Post <strong>Beijing</strong></span>
                  <span>Time <strong>28 August 2026 · 09:30</strong></span>
                </div>
                <div class="notice">Safety stop reached. The final official-style button is visible but must remain unclicked.</div>
                <div class="actions"><button id="official-final-submit" data-clicked="false" onclick="this.dataset.clicked='true'">Confirm appointment</button></div>
              </div>
            </section>
          </div>
        </main>
        <script>
          function showStep(id) {
            document.querySelectorAll('.step').forEach((step) => { step.hidden = step.id !== id; });
          }
        </script>
      </body>
    </html>
  `);

  await fillVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationUsernameInputs, "viza-fixture-user");
  await fillVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationEmailInputs, PLACEHOLDER.email);
  await fillVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationGivenNameInputs, PLACEHOLDER.givenName);
  await fillVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationSurnameInputs, PLACEHOLDER.surname);
  await fillVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationNewPasswordInputs, PLACEHOLDER.password);
  await fillVisible(page, US_VISA_SCHEDULING_SELECTORS.registrationConfirmPasswordInputs, PLACEHOLDER.password);
  await page.getByRole("button", { name: "Send Verification Code" }).click();
  await fillVisible(page, US_VISA_SCHEDULING_SELECTORS.verificationCodeInputs, PLACEHOLDER.verificationCode);
  await page.getByRole("button", { name: "Verify Code" }).click();
  await page.getByRole("button", { name: "Create Account" }).click();
  await page.locator("#passport-number").fill(PLACEHOLDER.passportNumber);
  await page.locator("#ds160-code").fill(PLACEHOLDER.ds160Code);
  await page.getByRole("button", { name: "Continue to calendar" }).click();
  const mappedSlotCandidates = page.locator(
    US_VISA_SCHEDULING_SELECTORS.slotCandidates,
  );
  if ((await mappedSlotCandidates.count()) < 1) {
    throw new Error("US production slot selector did not match the fixture.");
  }
  await page.locator("[data-viza-appointment-slot]").click();

  const finalButton = page.locator("#official-final-submit");
  await finalButton.waitFor({ state: "visible" });
  if ((await finalButton.getAttribute("data-clicked")) !== "false") {
    throw new Error("US fixture crossed the final-submit safety boundary.");
  }
  const screenshotPath = join(OUTPUT_DIR, "us-before-final-submit.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function runFranceFixture(page: Page) {
  await page.setContent(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>France TLS fixture</title><style>${fixtureStyles()}</style></head>
      <body>
        <main>
          <div class="shell">
            <header><h1>TLScontact pre-submit fixture</h1><p>Offline placeholder flow — no official site or account is used.</p></header>
            <section>
              <div class="step" id="login">
                <h2>Sign in</h2>
                <div class="grid">
                  <label>Email<input type="email" name="email"></label>
                  <label>Password<input type="password" name="password"></label>
                </div>
                <div class="actions"><button onclick="showStep('reference')">Sign in</button></div>
              </div>
              <div class="step" id="reference" hidden>
                <h2>Application reference</h2>
                <label>France-Visas reference<input name="applicationReference"></label>
                <div class="actions"><a class="action" href="#center" onclick="showStep('center'); return false">Continue</a></div>
              </div>
              <div class="step" id="center" hidden>
                <h2>Visa application centre</h2>
                <a class="action" data-testid="vac-shanghai" href="/vac/shanghai" onclick="showStep('calendar'); return false">Shanghai centre</a>
              </div>
              <div class="step" id="calendar" hidden>
                <h2>Observed TLS slots</h2>
                <div class="slot"><span>Shanghai · 31 August 2026 · 10:15</span><button data-testid="slot-fixture-fr-1" onclick="showStep('authorization')">Select</button></div>
              </div>
              <div class="step" id="authorization" hidden>
                <h2>Service-fee authorization</h2>
                <label><span><input id="payment-authorized" type="checkbox"> Placeholder authorization recorded (no card data)</span></label>
                <div class="actions"><button onclick="showStep('review')">Review appointment</button></div>
              </div>
              <div class="step" id="review" hidden>
                <h2>Review appointment</h2>
                <div class="review">
                  <span>Applicant <strong>Test Applicant</strong></span>
                  <span>Centre <strong>Shanghai</strong></span>
                  <span>Time <strong>31 August 2026 · 10:15</strong></span>
                </div>
                <div class="notice">Safety stop reached. The final official-style button is visible but must remain unclicked.</div>
                <div class="actions"><button id="tls-final-confirm" data-clicked="false" onclick="this.dataset.clicked='true'">Confirm booking</button></div>
              </div>
            </section>
          </div>
        </main>
        <script>
          function showStep(id) {
            document.querySelectorAll('.step').forEach((step) => { step.hidden = step.id !== id; });
          }
        </script>
      </body>
    </html>
  `);

  await fillVisible(page, FRANCE_TLS_SELECTORS.loginEmail, PLACEHOLDER.email);
  await fillVisible(page, FRANCE_TLS_SELECTORS.loginPassword, PLACEHOLDER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await fillVisible(
    page,
    FRANCE_TLS_SELECTORS.applicationReferenceInput,
    PLACEHOLDER.franceReference,
  );
  await page.getByRole("link", { name: "Continue" }).click();
  await (await firstVisible(page, FRANCE_TLS_SELECTORS.centerCards)).click();
  await (await firstVisible(page, FRANCE_TLS_SELECTORS.slotButtons)).click();
  await page.locator("#payment-authorized").check();
  await page.getByRole("button", { name: "Review appointment" }).click();

  const finalButton = page.locator("#tls-final-confirm");
  await finalButton.waitFor({ state: "visible" });
  if ((await finalButton.getAttribute("data-clicked")) !== "false") {
    throw new Error("France fixture crossed the final-submit safety boundary.");
  }
  const screenshotPath = join(OUTPUT_DIR, "france-before-final-submit.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const usPage = await context.newPage();
    const usScreenshot = await runUsFixture(usPage);
    await usPage.close();

    const francePage = await context.newPage();
    const franceScreenshot = await runFranceFixture(francePage);
    await francePage.close();

    process.stdout.write(`${JSON.stringify({
      ok: true,
      mode: "offline_placeholder_fixture",
      officialNetworkRequests: 0,
      finalSubmitClicks: 0,
      results: {
        unitedStates: {
          reachedFinalButton: true,
          screenshot: usScreenshot,
        },
        france: {
          reachedFinalButton: true,
          screenshot: franceScreenshot,
        },
      },
    }, null, 2)}\n`);
  } finally {
    await browser.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown fixture failure";
  process.stderr.write(`${JSON.stringify({
    ok: false,
    mode: "offline_placeholder_fixture",
    error: message,
  })}\n`);
  process.exitCode = 1;
});
