import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";

import { dismissTwPhotoSpecModalIfPresent, assertTwPhotoSpecModalCleared } from "../photo-spec-modal";
import { TwUnexpectedPageError } from "../errors";

let browser: Browser;
const APPLY_URL = "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply";

before(async () => {
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function newPage(html: string): Promise<Page> {
  const page = await browser.newPage();
  await page.route(APPLY_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: html,
    });
  });
  await page.goto(APPLY_URL);
  return page;
}

function pageHtml(options: {
  includeModal?: boolean;
  okHidesModal?: boolean;
  okSelector?: "inside" | "outside" | "both";
  delayHideMs?: number;
  delayContinentMs?: number;
  includePhotoSpecLink?: boolean;
} = {}): string {
  const includeModal = options.includeModal ?? true;
  const okHidesModal = options.okHidesModal ?? true;
  const okSelector = options.okSelector ?? "inside";
  const delayHideMs = options.delayHideMs ?? 0;
  const delayContinentMs = options.delayContinentMs ?? 0;
  return `
    <!doctype html>
    <html>
      <body>
        ${options.includePhotoSpecLink ? '<a href="#photo">照片規格說明</a>' : ""}
        ${okSelector === "outside" || okSelector === "both" ? '<button id="outsideOk" type="button">確定</button>' : ""}
        ${includeModal ? `
          <div class="modal" role="dialog" style="display:block">
            <div class="modal-content">
              <h2>照片規格說明及範例圖示(.jpg檔)</h2>
              <p>附件：照片規格說明</p>
              ${okSelector === "inside" || okSelector === "both" ? '<button id="photoOk" class="btn btn-primary" type="button">確定</button>' : ""}
            </div>
          </div>
        ` : ""}
        <div id="continentHost">
        ${delayContinentMs === 0 ? `
          <select name="continent">
            <option value="">請選擇</option>
            <option value="A">亞洲</option>
          </select>
        ` : ""}
        </div>
        <template id="continentTpl">
          <select name="continent">
            <option value="">請選擇</option>
            <option value="A">亞洲</option>
          </select>
        </template>
        <select name="overseaOfficeId">
          <option value="">請選擇</option>
          <option value="53">新加坡</option>
        </select>
        <button id="next" type="button">下一步</button>
        <script>
          window.firstStepStarted = false;
          const modal = document.querySelector('.modal');
          document.getElementById('outsideOk')?.addEventListener('click', () => {
            window.outsideOkClicked = true;
          });
          document.getElementById('photoOk')?.addEventListener('click', () => {
            window.photoOkClicked = true;
            if (${okHidesModal ? "true" : "false"}) {
              setTimeout(() => { modal.style.display = 'none'; }, ${delayHideMs});
            }
          });
          if (${delayContinentMs} > 0) {
            setTimeout(() => {
              document.getElementById('continentHost').appendChild(document.getElementById('continentTpl').content.cloneNode(true));
              wireContinent();
            }, ${delayContinentMs});
          }
          function wireContinent() {
            document.querySelector('[name="continent"]')?.addEventListener('change', () => {
              window.firstStepStarted = true;
              if (modal?.offsetParent !== null) throw new Error('first step touched before photo modal cleared');
            });
          }
          wireContinent();
          document.querySelector('[name="overseaOfficeId"]')?.addEventListener('change', () => {
            window.firstStepStarted = true;
          });
          document.getElementById('next').addEventListener('click', () => {
            window.firstStepStarted = true;
            document.body.dataset.step = 'application';
          });
        </script>
      </body>
    </html>
  `;
}

async function completeFirstStep(page: Page): Promise<void> {
  await assertTwPhotoSpecModalCleared(page);
  await page.locator('[name="continent"]').selectOption("A");
  await page.locator('[name="overseaOfficeId"]').selectOption("53");
  await page.getByRole("button", { name: "下一步" }).click();
}

describe("Taiwan official photo-spec modal handling", () => {
  before(() => {
    process.env.TW_DELIVERY_READY_TIMEOUT_MS = "800";
  });

  after(() => {
    delete process.env.TW_DELIVERY_READY_TIMEOUT_MS;
  });

  it("closes the visible photo-spec modal before first-step controls are used", async () => {
    const page = await newPage(pageHtml());
    try {
      const handled = await dismissTwPhotoSpecModalIfPresent(page);
      assert.equal(handled, true);
      assert.equal(await page.evaluate(() => (window as any).photoOkClicked), true);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
    } finally {
      await page.close();
    }
  });

  it("skips idempotently when the photo-spec modal is absent", async () => {
    const page = await newPage(pageHtml({ includeModal: false }));
    try {
      const handled = await dismissTwPhotoSpecModalIfPresent(page);
      assert.equal(handled, false);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
    } finally {
      await page.close();
    }
  });

  it("fails closed and does not continue when the photo-spec modal does not disappear", async () => {
    const page = await newPage(pageHtml({ okHidesModal: false }));
    try {
      await assert.rejects(() => dismissTwPhotoSpecModalIfPresent(page), TwUnexpectedPageError);
      assert.equal(await page.evaluate(() => (window as any).photoOkClicked), true);
      assert.equal(await page.evaluate(() => (window as any).firstStepStarted), false);
      await assert.rejects(() => completeFirstStep(page), TwUnexpectedPageError);
    } finally {
      await page.close();
    }
  });

  it("waits for delayed modal animation before using delivery-location controls", async () => {
    const page = await newPage(pageHtml({ delayHideMs: 350 }));
    try {
      const handled = await dismissTwPhotoSpecModalIfPresent(page);
      assert.equal(handled, true);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
    } finally {
      await page.close();
    }
  });

  it("waits for delayed continent select after the modal is gone", async () => {
    const page = await newPage(pageHtml({ delayContinentMs: 350 }));
    try {
      const handled = await dismissTwPhotoSpecModalIfPresent(page);
      assert.equal(handled, true);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
    } finally {
      await page.close();
    }
  });

  it("does not treat a photo-spec link as a modal", async () => {
    const page = await newPage(pageHtml({ includeModal: false, includePhotoSpecLink: true }));
    try {
      const handled = await dismissTwPhotoSpecModalIfPresent(page);
      assert.equal(handled, false);
      await completeFirstStep(page);
      assert.equal(await page.evaluate(() => document.body.dataset.step), "application");
    } finally {
      await page.close();
    }
  });

  it("does not click an OK button outside the photo-spec modal", async () => {
    const page = await newPage(pageHtml({ okSelector: "outside" }));
    try {
      await assert.rejects(() => dismissTwPhotoSpecModalIfPresent(page), TwUnexpectedPageError);
      assert.equal(await page.evaluate(() => (window as any).outsideOkClicked ?? false), false);
      assert.equal(await page.evaluate(() => (window as any).firstStepStarted), false);
    } finally {
      await page.close();
    }
  });

  it("fails closed with diagnostics when delivery-location controls never appear", async () => {
    const page = await newPage(pageHtml({ delayContinentMs: 20_000 }));
    try {
      await assert.rejects(
        () => dismissTwPhotoSpecModalIfPresent(page),
        (error) => error instanceof TwUnexpectedPageError &&
          /Delivery-location continent control is not ready/.test(error.message) &&
          Array.isArray(error.context.details?.selectNames),
      );
      assert.equal(await page.evaluate(() => (window as any).firstStepStarted), false);
    } finally {
      await page.close();
    }
  });
});
