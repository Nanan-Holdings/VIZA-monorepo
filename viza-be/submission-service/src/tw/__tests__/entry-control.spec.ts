import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

const START_URL = "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china";
const APPLY_URL = "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply";
const VERIFY_URL = "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply/verify";

let browser: Browser;
let clickEnterApplication: typeof import("../apply").clickEnterApplication;
let TwUnexpectedPageError: typeof import("../errors").TwUnexpectedPageError;

before(async () => {
  const apply = await import("../apply");
  const errors = await import("../errors");
  clickEnterApplication = apply.clickEnterApplication;
  TwUnexpectedPageError = errors.TwUnexpectedPageError;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function newOfficialPage(entryHtml: string): Promise<Page> {
  const page = await browser.newPage();
  await page.route(START_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><body>${entryHtml}</body></html>`,
    });
  });
  await page.route(APPLY_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><html><body><select name="continent"></select></body></html>',
    });
  });
  await page.route(VERIFY_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><html><body><input name="email"><input name="captchaToken"><input name="verifyCode"></body></html>',
    });
  });
  await page.goto(START_URL);
  return page;
}

describe("Taiwan official entry control", () => {
  it("clicks the current English entry link", async () => {
    const page = await newOfficialPage('<a href="/coa-frontend/overseas-foreign-china/apply">I want to apply</a>');

    await clickEnterApplication(page);

    assert.equal(page.url(), APPLY_URL);
  });

  it("clicks the traditional Chinese entry button", async () => {
    const page = await newOfficialPage(`
      <button type="button" onclick="location.href='/coa-frontend/overseas-foreign-china/apply'">我要申請</button>
    `);

    await clickEnterApplication(page);

    assert.equal(page.url(), APPLY_URL);
  });

  it("clicks the simplified Chinese entry button", async () => {
    const page = await newOfficialPage(`
      <button type="button" onclick="location.href='/coa-frontend/overseas-foreign-china/apply'">我要申请</button>
    `);

    await clickEnterApplication(page);

    assert.equal(page.url(), APPLY_URL);
  });

  it("skips idempotently when already on the exact official /apply URL", async () => {
    const page = await newOfficialPage('<button type="button">Unknown</button>');
    await page.goto(APPLY_URL);

    await clickEnterApplication(page);

    assert.equal(page.url(), APPLY_URL);
  });

  it("fails closed when the official entry control is unknown", async () => {
    const page = await newOfficialPage('<a href="/coa-frontend/overseas-foreign-china/apply">Start</a>');

    await assert.rejects(
      () => clickEnterApplication(page),
      (error) => error instanceof TwUnexpectedPageError && /I want to apply/.test(error.message),
    );
    assert.equal(page.url(), START_URL);
  });

  it("fails fast when the official entry lands on the email verification boundary", async () => {
    const page = await newOfficialPage('<a href="/coa-frontend/overseas-foreign-china/apply/verify">I want to apply</a>');

    await assert.rejects(
      () => clickEnterApplication(page),
      (error) => error instanceof TwUnexpectedPageError && /email verification boundary/.test(error.message),
    );
    assert.equal(page.url(), VERIFY_URL);
  });

  it("formal fillTwEntryPermitApplication uses the compatible entry helper", async () => {
    const source = await readFile(join(process.cwd(), "src", "tw", "apply.ts"), "utf8");
    assert.match(source, /export async function clickEnterApplication/);
    assert.match(source, /"I want to apply"/);
    assert.match(source, /await clickEnterApplication\(page,\s*\{\s*allowEmailVerifyBoundary:\s*true\s*\}\)/);
    assert.ok(
      source.indexOf("await clickEnterApplication(page, { allowEmailVerifyBoundary: true })") <
        source.indexOf("await acceptTermsModal(page)"),
    );
  });
});
