import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type Page } from "@playwright/test";
import { resolveTravelAddressFieldStrategy } from "../orchestrator";

describe("CEAC Travel address preservation", () => {
  let browser: Browser;
  let page: Page;

  before(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  after(async () => {
    await browser.close();
  });

  async function render(state = "NY", zip = "10001") {
    await page.setContent(`
      <select id="ctl00_SiteContentPlaceHolder_FormView1_ddlTravelState">
        <option value="">-Select One-</option>
        <option value="CA">CALIFORNIA</option>
        <option value="NY" ${state === "NY" ? "selected" : ""}>NEW YORK</option>
      </select>
      <input id="ctl00_SiteContentPlaceHolder_FormView1_tbZIPCode" value="${zip}">
    `);
  }

  it("preserves valid official DOM values when legacy source values are invalid", async () => {
    await render();

    assert.equal(
      await resolveTravelAddressFieldStrategy(page, "us_address_state", "not-a-state"),
      "preserve",
    );
    assert.equal(
      await resolveTravelAddressFieldStrategy(page, "us_address_zip", "123456"),
      "preserve",
    );
  });

  it("fills from VIZA when the source values are valid", async () => {
    await render();

    assert.equal(
      await resolveTravelAddressFieldStrategy(page, "us_address_state", "CALIFORNIA"),
      "fill",
    );
    assert.equal(
      await resolveTravelAddressFieldStrategy(page, "us_address_zip", "90210"),
      "fill",
    );
  });

  it("fails closed when neither VIZA nor CEAC has a valid value", async () => {
    await render("", "123456");

    await assert.rejects(
      resolveTravelAddressFieldStrategy(page, "us_address_state", "not-a-state"),
      /Travel State is empty or invalid/,
    );
    await assert.rejects(
      resolveTravelAddressFieldStrategy(page, "us_address_zip", "123456"),
      /Travel ZIP is empty or invalid/,
    );
  });
});
