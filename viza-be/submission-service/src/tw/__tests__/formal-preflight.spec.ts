import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

process.env.SUPABASE_URL ??= "http://localhost";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-key";

import type { TwSession } from "../session";
import type { runTwFormalRunnerPreflight as runTwFormalRunnerPreflightType } from "../formal-preflight";

const START_URL = "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china";
const APPLY_URL = "https://coa.immigration.gov.tw/coa-frontend/overseas-foreign-china/apply";

let browser: Browser;
let runTwFormalRunnerPreflight: typeof runTwFormalRunnerPreflightType;

before(async () => {
  ({ runTwFormalRunnerPreflight } = await import("../formal-preflight"));
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
});

async function makeSession(html: string): Promise<TwSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(START_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: '<!doctype html><a href="/coa-frontend/overseas-foreign-china/apply">I want to apply</a>',
    });
  });
  await page.route(APPLY_URL, async (route) => {
    await route.fulfill({ contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto(START_URL);
  return {
    browser,
    context,
    page,
    close: async () => {
      await context.close();
    },
  };
}

function applyHtml(options: { includeContinent?: boolean; delayedOffice?: boolean } = {}): string {
  const includeContinent = options.includeContinent ?? true;
  return `
    <!doctype html>
    <html>
      <body>
        <div id="terms" class="modal" role="dialog" style="display:block">
          <input id="agreeTerms" type="checkbox" />
          <label for="agreeTerms">同意上述條款，請打勾。</label>
          <button id="termsOk" type="button">確定</button>
        </div>
        <div id="photo" class="modal" role="dialog" style="display:none">
          <h2>照片規格說明及範例圖示(.jpg檔)</h2>
          <button id="photoOk" type="button">確定</button>
        </div>
        ${includeContinent ? `
          <select name="continent">
            <option value="">請選擇</option>
            <option value="A">亞洲</option>
          </select>
        ` : ""}
        <select name="overseaOfficeId">
          <option value="">請選擇</option>
          ${options.delayedOffice ? "" : '<option value="53">新加坡</option>'}
        </select>
        <button id="next" type="button">下一步</button>
        <input name="traveller.email" />
        <button id="finalConfirm" type="button">確認資料</button>
        <script>
          window.events = [];
          document.getElementById('termsOk').addEventListener('click', () => {
            window.events.push('terms-ok');
            if (!document.getElementById('agreeTerms').checked) throw new Error('terms OK before checkbox');
            document.getElementById('terms').style.display = 'none';
            document.getElementById('photo').style.display = 'block';
          });
          document.getElementById('photoOk').addEventListener('click', () => {
            window.events.push('photo-ok');
            document.getElementById('photo').style.display = 'none';
          });
          document.querySelector('[name="continent"]')?.addEventListener('change', () => {
            window.events.push('continent');
            if (${options.delayedOffice ? "true" : "false"}) {
              setTimeout(() => {
                document.querySelector('[name="overseaOfficeId"]').insertAdjacentHTML('beforeend', '<option value="53">新加坡</option>');
              }, 250);
            }
          });
          document.querySelector('[name="overseaOfficeId"]').addEventListener('change', () => {
            window.events.push('office');
          });
          document.getElementById('next').addEventListener('click', () => {
            window.events.push('next');
          });
          document.querySelector('[name="traveller.email"]').addEventListener('input', () => {
            window.events.push('email');
          });
          document.getElementById('finalConfirm').addEventListener('click', () => {
            window.events.push('final-confirm');
          });
        </script>
      </body>
    </html>
  `;
}

describe("Taiwan formal runner preflight", () => {
  it("runs official early helpers, selects delivery controls, and stops before email verification", async () => {
    let context!: BrowserContext;
    let events: string[] = [];
    const diagnosticsOutputDir = await mkdtemp(join(tmpdir(), "tw-formal-preflight-test-"));
    const result = await runTwFormalRunnerPreflight(
      { answers: { continent: "A", embassy_office: "53" } },
      {
        runId: "formal-preflight-success",
        diagnosticsOutputDir,
        sessionFactory: async () => {
          const session = await makeSession(applyHtml());
          context = session.context;
          return {
            ...session,
            close: async () => {
              events = await session.page.evaluate(() => (window as any).events);
              await session.context.close();
            },
          };
        },
      },
    );

    assert.equal(result.status, "passed");
    assert.deepEqual(result.phases, ["entry", "terms_modal", "photo_spec_modal", "delivery_location"]);
    assert.deepEqual(events, ["terms-ok", "photo-ok", "continent", "office"]);
    assert.equal(context.pages().length, 0);
  });

  it("waits for the dependent office select options to re-render", async () => {
    const result = await runTwFormalRunnerPreflight(
      { answers: { continent: "A", embassy_office: "53" } },
      {
        runId: "formal-preflight-delayed-office",
        sessionFactory: async () => makeSession(applyHtml({ delayedOffice: true })),
      },
    );

    assert.equal(result.status, "passed");
  });

  it("fails with a single redacted diagnostic when delivery controls never appear", async () => {
    const result = await runTwFormalRunnerPreflight(
      { answers: { continent: "A", embassy_office: "53" } },
      {
        runId: "formal-preflight-failure",
        sessionFactory: async () => makeSession(applyHtml({ includeContinent: false })),
      },
    );

    assert.equal(result.status, "failed");
    assert.equal(result.phase, "photo_spec_modal");
    assert.equal(result.diagnostic.urlPath, "/coa-frontend/overseas-foreign-china/apply");
    assert.ok(Array.isArray(result.diagnostic.controlNames));
    assert.ok(!JSON.stringify(result.diagnostic).includes("Junji"));
  });
});
