import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { ds160PreviousUsTravelMappings as mappings } from "../../ds160-form-mappings";
import { fillPageFields } from "../orchestrator";
import { resolvePreviousTravelMappings } from "../previous-travel-branch";

const gates = ["PREV_US_TRAVEL", "PREV_VISA", "PREV_VISA_REFUSED", "IV_PETITION"];
const radios = (name: string) => `<input type="radio" name="rbl${name}_IND" value="Y"><input type="radio" name="rbl${name}_IND" value="N">`;
const completePage = `<h2>Previous U.S. Travel Information</h2>${gates.map(radios).join("")}`;
const answers = { has_been_in_us: "N", has_us_visa: "N", has_been_refused: "N", immigrant_petition_filed: "N", vwp_denial: "N" };

test("observed four-question branch fills and verifies every displayed answer", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(completePage);
    const active = await resolvePreviousTravelMappings(page, mappings, answers);
    assert.equal(active.vwp_denial, undefined);
    assert.ok(mappings.vwp_denial, "source mapping is not mutated");
    await fillPageFields(page, active, answers, {}, { requireMappedAnswers: true });
    for (const gate of gates) assert.equal(await page.locator(`input[name="rbl${gate}_IND"][value="N"]`).isChecked(), true);

    await page.setContent(`${completePage}<p>Have you ever been denied ESTA authorization?</p>${radios("VWP_DENIAL")}`);
    const displayed = await resolvePreviousTravelMappings(page, mappings, answers);
    assert.ok(displayed.vwp_denial);
    await fillPageFields(page, displayed, answers, {}, { requireMappedAnswers: true });
    assert.equal(await page.locator('input[name="rblVWP_DENIAL_IND"][value="N"]').isChecked(), true);
  } finally { await browser.close(); }
});

test("missing ESTA control remains required for affirmative answers, incomplete pages, and changed question selectors", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    for (const html of [
      completePage + "<p>Have you been denied travel authorization through ESTA?</p>",
      `<h2>Previous U.S. Travel Information</h2>${gates.slice(0, 3).map(radios).join("")}`,
      completePage.replace("Previous U.S. Travel Information", "Address and Phone Information"),
    ]) {
      await page.setContent(html);
      assert.ok((await resolvePreviousTravelMappings(page, mappings, answers)).vwp_denial);
    }
    await page.setContent(completePage);
    const affirmative = { ...answers, vwp_denial: "Y" };
    const active = await resolvePreviousTravelMappings(page, mappings, affirmative);
    assert.ok(active.vwp_denial);
    await assert.rejects(fillPageFields(page, active, affirmative, {}, { requireMappedAnswers: true }), /vwp_denial/);
  } finally { await browser.close(); }
});
