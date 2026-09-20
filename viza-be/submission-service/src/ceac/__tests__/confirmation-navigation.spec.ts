import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { installCeacPostbackMonitor } from "../aspnet";
import {
  prepareConfirmationContinuation,
  waitForDs160SubmissionConfirmation,
  type ConfirmationContinuation,
} from "../confirmation-navigation";

const APPLICATION_ID = "AA00TEST1234";
const OTHER_APPLICATION_ID = "AA00OTHER123";
const SIGN_URL = "https://ceac.state.gov/GenNIV/General/signtheapplication.aspx?node=SignCertify";
const CONFIRMATION_URL = "https://ceac.state.gov/GenNIV/General/confirmation.aspx?node=Confirmation";
const UNTRUSTED_SIGN_URL = "https://example.test/GenNIV/General/signtheapplication.aspx?node=SignCertify";
const SIGN_BUTTON_ID = "ctl00_SiteContentPlaceHolder_btnSignApp";
const NEXT_BUTTON_ID = "ctl00_SiteContentPlaceHolder_UpdateButton3";

type NextMode = "enable" | "stay-disabled" | "change-id";

interface SignFixtureOptions {
  applicationId?: string;
  nextMode?: NextMode;
  nextInitiallyDisabled?: boolean;
  confirmOnNext?: boolean;
  duplicateNext?: boolean;
}

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser.close();
});

function confirmationMarkup(applicationId: string): string {
  return `
    <h2>Confirmation</h2>
    <p>Application ID: ${applicationId}</p>
    <button type="button">Print Confirmation</button>
    <button type="button">Print Application</button>
    <button type="button">Email Confirmation</button>
  `;
}

function signMarkup(options: SignFixtureOptions = {}): string {
  const applicationId = options.applicationId ?? APPLICATION_ID;
  const nextMode = options.nextMode ?? "enable";
  const nextDisabled = options.nextInitiallyDisabled === false ? "" : " disabled";
  const duplicateNext = options.duplicateNext
    ? `<input id="ctl00_SiteContentPlaceHolder_UpdateButton4" type="submit" value="NEXT: CONFIRMATION" disabled>`
    : "";
  const confirmation = JSON.stringify(confirmationMarkup(applicationId));

  return `<!doctype html>
    <html><body>
      <h2>Sign and Submit Application</h2>
      <span id="ctl00_SiteContentPlaceHolder_lblAppID">Application ID ${applicationId}</span>
      <form id="sign-form">
        <input id="ctl00_SiteContentPlaceHolder_FormView3_rblPREP_IND_0" type="radio" name="preparer" value="Yes">
        <input id="ctl00_SiteContentPlaceHolder_FormView3_rblPREP_IND_1" type="radio" name="preparer" value="No">
        <input id="ctl00_SiteContentPlaceHolder_PPTNumTbx" type="text">
        <input id="ctl00_SiteContentPlaceHolder_CodeTextBox" type="text">
        <img id="c_general_esign_signtheapplication_ctl00_sitecontentplaceholder_defaultcaptcha_CaptchaImage" alt="CAPTCHA">
        <input id="${SIGN_BUTTON_ID}" type="submit" value="Sign and Submit Application">
        <input id="ctl00_SiteContentPlaceHolder_UpdateButton1" type="submit" value="Back: REVIEW">
        <input id="ctl00_SiteContentPlaceHolder_UpdateButton2" type="submit" value="Save">
        <input id="${NEXT_BUTTON_ID}" type="submit" value="Next: Confirmation"${nextDisabled}>
        ${duplicateNext}
      </form>
      <script>
        window.__ceacCounts = { sign: 0, next: 0 };
        const sign = document.getElementById(${JSON.stringify(SIGN_BUTTON_ID)});
        const next = document.getElementById(${JSON.stringify(NEXT_BUTTON_ID)});
        sign.addEventListener("click", (event) => {
          event.preventDefault();
          window.__ceacCounts.sign += 1;
          const mode = ${JSON.stringify(nextMode)};
          if (mode === "enable") setTimeout(() => { next.disabled = false; }, 35);
          if (mode === "change-id") setTimeout(() => {
            next.id = "tampered-confirmation-next";
            next.disabled = false;
          }, 35);
        });
        next.addEventListener("click", (event) => {
          event.preventDefault();
          window.__ceacCounts.next += 1;
          if (${Boolean(options.confirmOnNext)}) {
            history.replaceState({}, "", "/GenNIV/General/confirmation.aspx?node=Confirmation");
            document.body.innerHTML = ${confirmation};
          }
        });
      </script>
    </body></html>`;
}

async function openFixture(page: Page, url: string, body: string): Promise<void> {
  const origin = new URL(url).origin;
  await page.route(`${origin}/**`, route => route.fulfill({
    status: 200,
    contentType: "text/html",
    body,
  }));
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

async function openSignFixture(page: Page, options: SignFixtureOptions = {}, url = SIGN_URL): Promise<void> {
  await openFixture(page, url, signMarkup(options));
}

async function openConfirmationFixture(page: Page, applicationId = APPLICATION_ID): Promise<void> {
  await openFixture(page, CONFIRMATION_URL, confirmationMarkup(applicationId));
}

async function count(page: Page, key: "sign" | "next"): Promise<number> {
  return page.evaluate((name) => {
    const counts = (window as unknown as { __ceacCounts?: Record<string, number> }).__ceacCounts;
    return counts?.[name] ?? 0;
  }, key);
}

async function expectBlocked(action: () => Promise<boolean>): Promise<void> {
  let rejected = false;
  let result: boolean | undefined;
  try {
    result = await action();
  } catch {
    rejected = true;
  }
  if (!rejected) assert.equal(result, false);
}

test("captures the observed disabled Next control and advances once after it enables", async () => {
  const page = await browser.newPage();
  try {
    await openSignFixture(page, { confirmOnNext: true });
    const continuation = await prepareConfirmationContinuation(page);
    assert.deepEqual(continuation, { controlId: NEXT_BUTTON_ID });

    await page.locator(`#${SIGN_BUTTON_ID}`).click();
    const result = await waitForDs160SubmissionConfirmation(page, APPLICATION_ID, 5_000, continuation);

    assert.equal(result, true);
    assert.equal(await count(page, "sign"), 1);
    assert.equal(await count(page, "next"), 1);
    assert.match(page.url(), /confirmation/i);
  } finally {
    await page.close();
  }
});

test("accepts a direct official confirmation when no continuation is present", async () => {
  const page = await browser.newPage();
  try {
    await openConfirmationFixture(page);
    assert.equal(
      await waitForDs160SubmissionConfirmation(page, APPLICATION_ID, 1_000, null),
      true,
    );
  } finally {
    await page.close();
  }
});

test("rejects an initially enabled or duplicate visible Next control", async () => {
  const enabledPage = await browser.newPage();
  const duplicatePage = await browser.newPage();
  try {
    await openSignFixture(enabledPage, { nextInitiallyDisabled: false });
    await assert.rejects(() => prepareConfirmationContinuation(enabledPage));

    await openSignFixture(duplicatePage, { duplicateNext: true });
    await assert.rejects(() => prepareConfirmationContinuation(duplicatePage));
  } finally {
    await enabledPage.close();
    await duplicatePage.close();
  }
});

test("blocks a mismatched Application ID before clicking Next", async () => {
  const page = await browser.newPage();
  try {
    await openSignFixture(page, { applicationId: OTHER_APPLICATION_ID, nextMode: "enable" });
    const continuation = await prepareConfirmationContinuation(page);
    await page.locator(`#${SIGN_BUTTON_ID}`).click();

    await expectBlocked(() => waitForDs160SubmissionConfirmation(page, APPLICATION_ID, 2_000, continuation));
    assert.equal(await count(page, "sign"), 1);
    assert.equal(await count(page, "next"), 0);
  } finally {
    await page.close();
  }
});

test("does not click a captured continuation after leaving the official origin", async () => {
  const page = await browser.newPage();
  try {
    await openSignFixture(page, { nextMode: "enable" }, UNTRUSTED_SIGN_URL);
    const continuation: ConfirmationContinuation = { controlId: NEXT_BUTTON_ID };
    await page.locator(`#${SIGN_BUTTON_ID}`).click();

    await expectBlocked(() => waitForDs160SubmissionConfirmation(page, APPLICATION_ID, 1_000, continuation));
    assert.equal(await count(page, "sign"), 1);
    assert.equal(await count(page, "next"), 0);
  } finally {
    await page.close();
  }
});

test("returns false without acting when Next remains disabled", async () => {
  const page = await browser.newPage();
  try {
    await openSignFixture(page, { nextMode: "stay-disabled" });
    const continuation = await prepareConfirmationContinuation(page);
    await page.locator(`#${SIGN_BUTTON_ID}`).click();

    await expectBlocked(() => waitForDs160SubmissionConfirmation(page, APPLICATION_ID, 350, continuation));
    assert.equal(await count(page, "next"), 0);
  } finally {
    await page.close();
  }
});

test("blocks a continuation whose exact control ID changes after signing", async () => {
  const page = await browser.newPage();
  try {
    await openSignFixture(page, { nextMode: "change-id" });
    const continuation = await prepareConfirmationContinuation(page);
    await page.locator(`#${SIGN_BUTTON_ID}`).click();

    await expectBlocked(() => waitForDs160SubmissionConfirmation(page, APPLICATION_ID, 2_000, continuation));
    assert.equal(await count(page, "next"), 0);
  } finally {
    await page.close();
  }
});

test("preserves a latched postback gate before any continuation click", async () => {
  const page = await browser.newPage();
  try {
    await openSignFixture(page, { nextMode: "enable" });
    const continuation = await prepareConfirmationContinuation(page);
    installCeacPostbackMonitor(page);
    await page.route("https://ceac.state.gov/GenNIV/General/postback.aspx", route => route.fulfill({
      status: 403,
      contentType: "text/plain",
      body: "fixture gate",
    }));
    await page.evaluate(async () => {
      await fetch("/GenNIV/General/postback.aspx", { method: "POST", body: "__EVENTTARGET=fixture" });
    });
    await page.locator(`#${SIGN_BUTTON_ID}`).click();

    await expectBlocked(() => waitForDs160SubmissionConfirmation(page, APPLICATION_ID, 1_000, continuation));
    assert.equal(await count(page, "next"), 0);
  } finally {
    await page.close();
  }
});
