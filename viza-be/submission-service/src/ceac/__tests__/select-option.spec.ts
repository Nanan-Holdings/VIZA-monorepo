import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { selectCeacOption } from "../orchestrator";

describe("CEAC select option resolution", () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  after(async () => {
    await browser.close();
  });

  it("waits for a delayed canonical country option and retains it", async () => {
    await page.setContent(`
      <select id="ctl00_SiteContentPlaceHolder_FormView1_ddlAPP_POB_CNTRY">
        <option value="">- Select One -</option>
      </select>
      <script>
        setTimeout(() => {
          const option = document.createElement("option");
          option.value = "CHIN";
          option.textContent = "CHINA";
          document.querySelector("select").append(option);
        }, 300);
      </script>
    `);

    const country = page.locator('select[id*="ddlAPP_POB_CNTRY"]');
    await selectCeacOption(country, "CHIN");

    assert.equal(await country.inputValue(), "CHIN");
  });
});
