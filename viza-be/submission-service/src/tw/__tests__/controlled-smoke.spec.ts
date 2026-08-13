import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";

import {
  completeTwControlledSmokeFirstStep,
  installTwSmokePageGuard,
  isTwOfficialLoginOrOtpBoundaryForSmoke,
  isTwControlledSmokeAllowedUrl,
  runTwControlledFirstStepSmoke,
} from "../controlled-smoke";
import { TwUnexpectedPageError } from "../errors";

let browser: Browser;

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function newPage(html: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(html);
  return page;
}

async function newOfficialPage(path: string, html: string): Promise<Page> {
  const page = await browser.newPage();
  await page.route(`https://coa.immigration.gov.tw${path}`, async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto(`https://coa.immigration.gov.tw${path}`);
  return page;
}

function deliveryPageHtml(): string {
  return `
    <!doctype html>
    <html>
      <body>
        <div class="modal" role="dialog" style="display:block">
          <div class="modal-content">
            <input id="agreeTerms" type="checkbox" />
            <label for="agreeTerms">同意上述條款，請打勾。</label>
            <button id="termsOk" type="button">確定</button>
          </div>
        </div>
        <div class="modal" role="dialog" id="photoModal" style="display:none">
          <div class="modal-content">
            <h2>照片規格說明及範例圖示(.jpg檔)</h2>
            <button id="photoOk" type="button">確定</button>
          </div>
        </div>
        <select name="continent">
          <option value="">請選擇</option>
          <option value="A">亞洲</option>
        </select>
        <select name="overseaOfficeId">
          <option value="">請選擇</option>
          <option value="53">新加坡</option>
        </select>
        <button id="next" type="button">下一步</button>
        <button id="finalConfirm" type="button">確認資料</button>
        <script>
          window.events = [];
          document.getElementById('termsOk').addEventListener('click', () => {
            window.events.push('terms-ok');
            if (!document.getElementById('agreeTerms').checked) throw new Error('terms OK before checkbox');
            document.querySelector('.modal').style.display = 'none';
            document.getElementById('photoModal').style.display = 'block';
          });
          document.getElementById('photoOk').addEventListener('click', () => {
            window.events.push('photo-ok');
            document.getElementById('photoModal').style.display = 'none';
          });
          document.querySelector('[name="continent"]').addEventListener('change', () => {
            window.events.push('continent');
          });
          document.querySelector('[name="overseaOfficeId"]').addEventListener('change', () => {
            window.events.push('office');
          });
          document.getElementById('next').addEventListener('click', () => {
            window.events.push('next');
            document.body.dataset.step = 'application';
          });
          document.getElementById('finalConfirm').addEventListener('click', () => {
            window.events.push('final-confirm');
          });
        </script>
      </body>
    </html>
  `;
}

describe("Taiwan controlled first-step smoke guard", () => {
  it("allows only the official Taiwan smoke URL set", () => {
    assert.equal(isTwControlledSmokeAllowedUrl("https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china"), true);
    assert.equal(isTwControlledSmokeAllowedUrl("https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply"), true);
    assert.equal(isTwControlledSmokeAllowedUrl("https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply/verify"), true);
    assert.equal(isTwControlledSmokeAllowedUrl("https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/other"), false);
    assert.equal(isTwControlledSmokeAllowedUrl("https://example.com/coa-frontend/overseas-foreign-china/apply"), false);
  });

  it("fails closed if a second page appears in the controlled context", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const guard = installTwSmokePageGuard(context, page);
    try {
      await context.newPage();
      await assert.rejects(() => guard.assertStable("test"), TwUnexpectedPageError);
    } finally {
      guard.dispose();
      await context.close();
    }
  });

  it("does not treat future CAPTCHA text on /apply as a manual login boundary", async () => {
    const page = await newOfficialPage(
      "/coa-frontend/overseas-foreign-china/apply",
      `
        <!doctype html>
        <select name="continent"><option value="">請選擇</option><option value="A">亞洲</option></select>
        <select name="overseaOfficeId"><option value="53">新加坡</option></select>
        <button>下一步</button>
        <section hidden>
          <label>驗證碼</label>
          <input name="captcha" disabled />
          <img src="/coa-frontend/captcha" />
        </section>
      `,
    );
    try {
      assert.equal(await isTwOfficialLoginOrOtpBoundaryForSmoke(page), false);
    } finally {
      await page.close();
    }
  });

  it("pauses on /apply/verify even when no fields are visible", async () => {
    const page = await newOfficialPage("/coa-frontend/overseas-foreign-china/apply/verify", "<!doctype html><p>verify</p>");
    try {
      assert.equal(await isTwOfficialLoginOrOtpBoundaryForSmoke(page), true);
    } finally {
      await page.close();
    }
  });

  it("pauses on /apply when a visible login or OTP blocker is interactable", async () => {
    const page = await newOfficialPage(
      "/coa-frontend/overseas-foreign-china/apply",
      `
        <!doctype html>
        <select name="continent"><option value="">請選擇</option></select>
        <div class="modal" role="dialog" style="display:block">
          <label>驗證碼 <input placeholder="請輸入驗證碼" /></label>
        </div>
      `,
    );
    try {
      assert.equal(await isTwOfficialLoginOrOtpBoundaryForSmoke(page), true);
    } finally {
      await page.close();
    }
  });

  it("reuses the official modal helpers and delivery-location filler, then stops at step two", async () => {
    const page = await newOfficialPage(
      "/coa-frontend/overseas-foreign-china/apply",
      deliveryPageHtml(),
    );
    try {
      const audit = await completeTwControlledSmokeFirstStep(page, { continent: "A", embassy_office: "53" });
      assert.deepEqual(await page.evaluate(() => (window as any).events), [
        "terms-ok",
        "photo-ok",
        "continent",
        "office",
        "next",
      ]);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
      assert.equal(await page.locator('[name="continent"]').inputValue(), "A");
      assert.equal(await page.locator('[name="overseaOfficeId"]').inputValue(), "53");
      assert.equal(audit.map((entry) => entry.fieldName).join(","), "continent,embassy_office");
    } finally {
      await page.close();
    }
  });

  it("keeps the controlled headed page open for inspection until explicitly released", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    let closeCount = 0;
    let releaseInspection!: () => void;
    const inspectionReleased = new Promise<void>((resolve) => {
      releaseInspection = resolve;
    });
    let inspectionStarted = false;

    await page.route("https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: '<a href="/coa-frontend/overseas-foreign-china/apply">I want to apply</a>',
      });
    });
    await page.route("https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: `
          <!doctype html>
          <select name="continent"><option value="">請選擇</option><option value="A">亞洲</option></select>
          <select name="overseaOfficeId"><option value="">請選擇</option><option value="53">新加坡</option></select>
          <button id="next" type="button">下一步</button>
          <button id="finalConfirm" type="button">確認資料</button>
          <script>
            window.events = [];
            document.getElementById('next').addEventListener('click', () => {
              window.events.push('next');
              document.body.insertAdjacentHTML('beforeend', '<div role="tab">申請表</div>');
            });
            document.getElementById('finalConfirm').addEventListener('click', () => {
              window.events.push('final-confirm');
            });
          </script>
        `,
      });
    });

    const run = runTwControlledFirstStepSmoke({
      answers: { continent: "A", embassy_office: "53" },
      sessionFactory: async () => {
        await page.goto("https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china");
        return {
          browser,
          context,
          page,
          close: async () => {
            closeCount += 1;
            await context.close();
          },
        };
      },
      waitForInspection: async (result, inspectedPage) => {
        inspectionStarted = true;
        assert.equal(result.status, "stopped_at_second_step");
        assert.equal(inspectedPage.isClosed(), false);
        assert.equal(closeCount, 0);
        assert.deepEqual(await inspectedPage.evaluate(() => (window as any).events), ["next"]);
        await inspectionReleased;
      },
    });

    while (!inspectionStarted) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(closeCount, 0);
    assert.equal(page.isClosed(), false);
    assert.deepEqual(await page.evaluate(() => (window as any).events), ["next"]);

    releaseInspection();
    const result = await run;
    assert.equal(result.status, "stopped_at_second_step");
    assert.equal(closeCount, 1);
  });
});
