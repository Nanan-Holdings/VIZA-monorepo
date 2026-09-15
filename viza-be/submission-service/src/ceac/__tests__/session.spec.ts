import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { chromium, type Browser } from "@playwright/test";
import { gotoCeacStartPage } from "../start-page-navigation";
import { detectGate } from "../gates";

let browser: Browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser.close(); });

it("waits through an interstitial h2 until the CEAC form appears", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      contentType: "text/html",
      body: `<h2>Security verification</h2><script>setTimeout(()=>{document.body.innerHTML='<h2>Apply For a Nonimmigrant Visa</h2><select id="ctl00_ucLocation_ddlLocation"><option>BEJ</option></select>'},250)</script>`,
    }));
    await gotoCeacStartPage(page, 3000);
    assert.equal(await page.locator("h2").innerText(), "Apply For a Nonimmigrant Visa");
    assert.equal(await page.locator("select").count(), 1);
  } finally { await page.close(); }
});

it("preserves a definitive WAF block for structured gate classification", async () => {
  const page = await browser.newPage();
  try {
    await page.route("https://ceac.state.gov/**", route => route.fulfill({
      status: 403, contentType: "text/html", body: "<h2>Sorry, you have been blocked</h2>",
    }));
    await gotoCeacStartPage(page, 3000);
    assert.equal((await detectGate(page)).gated, true);
  } finally { await page.close(); }
});
