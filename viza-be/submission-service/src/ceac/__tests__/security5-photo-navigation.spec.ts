import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { NavigationError, ValidationFailedError } from "../errors";
import { navigateSecurityFiveToPhoto } from "../navigator";

const SECURITY_FIVE_URL =
  "https://ceac.state.gov/GenNIV/General/complete/complete_securityandbackground5.aspx?node=SecurityBackground5";
const SECURITY_FOUR_PATH =
  "/GenNIV/General/complete/complete_securityandbackground4.aspx?node=SecurityBackground4";
const PHOTO_PATH =
  "/GenNIV/General/photo/photo_uploadthephoto.aspx?node=UploadPhoto";

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser.close();
});

interface FixtureOptions {
  nextEnabled?: boolean;
  nextValue?: string;
  backValidation?: boolean;
  photoHref?: string;
}

function partFourMarkup(options: FixtureOptions): string {
  const href = options.photoHref ?? PHOTO_PATH;
  return `
    <h2>Security and Background: Part 4</h2>
    <a id="PHOTO" href="${href}" onclick="window.__recordEvent('photo')">PHOTO</a>
  `;
}

function securityFiveMarkup(options: FixtureOptions = {}): string {
  const nextDisabled = options.nextEnabled ? "" : " disabled";
  const nextValue = options.nextValue ?? "Next: PHOTO";
  const partFour = JSON.stringify(partFourMarkup(options));
  return `<!doctype html>
    <html><body>
      <h2>Security and Background: Part 5</h2>
      <form id="security-five-form">
        <input id="next" class="next" type="submit" value="${nextValue}"${nextDisabled}>
        <input id="back" type="submit" value="Back: Security and Background: Part 4">
      </form>
      <div id="error" class="error"></div>
      <a id="PHOTO" href="${options.photoHref ?? PHOTO_PATH}" onclick="window.__recordEvent('photo')">PHOTO</a>
      <script>
        localStorage.setItem('security-five-events', '[]');
        window.__events = [];
        window.__recordEvent = value => {
          window.__events.push(value);
          localStorage.setItem('security-five-events', JSON.stringify(window.__events));
        };
        const back = document.getElementById('back');
        back.addEventListener('click', event => {
          event.preventDefault();
          window.__recordEvent('back');
          if (${Boolean(options.backValidation)}) {
            document.getElementById('error').textContent = 'Explain has not been completed';
            return;
          }
          history.replaceState({}, '', ${JSON.stringify(SECURITY_FOUR_PATH)});
          document.body.innerHTML = ${partFour};
        });
      </script>
    </body></html>`;
}

async function openFixture(page: Page, options: FixtureOptions = {}): Promise<void> {
  await page.route("https://ceac.state.gov/**", route => {
    const requestPath = new URL(route.request().url()).pathname.toLowerCase();
    if (requestPath.endsWith("photo_uploadthephoto.aspx")) {
      return route.fulfill({
        contentType: "text/html",
        body: "<h2>Upload Photo</h2>",
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: securityFiveMarkup(options),
    });
  });
  await page.goto(SECURITY_FIVE_URL, { waitUntil: "domcontentloaded" });
}

async function events(page: Page): Promise<string[]> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("security-five-events") ?? "[]"));
}

test("does not use the photo fallback when Next: PHOTO is enabled", async () => {
  const page = await browser.newPage();
  try {
    await openFixture(page, { nextEnabled: true });
    assert.equal(await navigateSecurityFiveToPhoto(page, { timeoutMs: 2_000, pollIntervalMs: 20 }), false);
    assert.deepEqual(await events(page), []);
    assert.match(page.url(), /complete_securityandbackground5\.aspx/i);
  } finally {
    await page.close();
  }
});

test("does not use the photo fallback for a different disabled Next action", async () => {
  const page = await browser.newPage();
  try {
    await openFixture(page, { nextValue: "Next: Review" });
    assert.equal(await navigateSecurityFiveToPhoto(page, { timeoutMs: 2_000, pollIntervalMs: 20 }), false);
    assert.deepEqual(await events(page), []);
    assert.match(page.url(), /complete_securityandbackground5\.aspx/i);
  } finally {
    await page.close();
  }
});

test("rejects an off-origin or wrong-path PHOTO link after Back saves", async () => {
  const page = await browser.newPage();
  try {
    await openFixture(page, { photoHref: "https://evil.example/photo_uploadthephoto.aspx" });
    await assert.rejects(
      () => navigateSecurityFiveToPhoto(page, { timeoutMs: 2_000, pollIntervalMs: 20 }),
      error => error instanceof NavigationError,
    );
    assert.deepEqual(await events(page), ["back"]);
    assert.match(page.url(), /complete_securityandbackground4\.aspx/i);
    assert.doesNotMatch(page.url(), /photo_uploadthephoto/i);
  } finally {
    await page.close();
  }
});

test("rejects a same-origin PHOTO link with the wrong path after Back saves", async () => {
  const page = await browser.newPage();
  try {
    await openFixture(page, { photoHref: "/GenNIV/General/review/review_personal.aspx" });
    await assert.rejects(
      () => navigateSecurityFiveToPhoto(page, { timeoutMs: 2_000, pollIntervalMs: 20 }),
      error => error instanceof NavigationError,
    );
    assert.deepEqual(await events(page), ["back"]);
    assert.match(page.url(), /complete_securityandbackground4\.aspx/i);
    assert.doesNotMatch(page.url(), /review_personal/i);
  } finally {
    await page.close();
  }
});

test("does not enter photo when the Back save is rejected by CEAC validation", async () => {
  const page = await browser.newPage();
  try {
    await openFixture(page, { backValidation: true });
    await assert.rejects(
      () => navigateSecurityFiveToPhoto(page, { timeoutMs: 2_000, pollIntervalMs: 20 }),
      error => error instanceof ValidationFailedError,
    );
    assert.deepEqual(await events(page), ["back"]);
    assert.match(page.url(), /complete_securityandbackground5\.aspx/i);
    assert.equal(await page.locator("#PHOTO").count(), 1);
  } finally {
    await page.close();
  }
});

test("does not click PHOTO when ownership is lost after Back saves", async () => {
  const page = await browser.newPage();
  let checks = 0;
  try {
    await openFixture(page);
    await assert.rejects(
      () => navigateSecurityFiveToPhoto(page, {
        timeoutMs: 2_000,
        pollIntervalMs: 20,
        assertActive: () => {
          checks += 1;
          if (checks >= 3) throw new Error("lease lost after Security 5 Back");
        },
      }),
      /lease lost after Security 5 Back/,
    );
    assert.deepEqual(await events(page), ["back"]);
    assert.match(page.url(), /complete_securityandbackground4\.aspx/i);
    assert.equal(await page.locator("#PHOTO").count(), 1);
  } finally {
    await page.close();
  }
});

test("saves Part 5 through Back before following the official PHOTO link", async () => {
  const page = await browser.newPage();
  try {
    await openFixture(page);
    assert.equal(await navigateSecurityFiveToPhoto(page, { timeoutMs: 2_000, pollIntervalMs: 20 }), true);
    assert.deepEqual(await events(page), ["back", "photo"]);
    assert.match(page.url(), /photo_uploadthephoto\.aspx\?node=UploadPhoto$/i);
  } finally {
    await page.close();
  }
});
