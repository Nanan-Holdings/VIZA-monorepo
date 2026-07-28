import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import { fillJapanVfsApplicantDetails } from "./runner";

test("Japan VFS applicant details map Portal values into visible official controls", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <label>Surname <input /></label><label>Given names <input /></label>
      <label>Passport number <input /></label><label>Email <input /></label><label>Mobile <input /></label>
      <label>Singapore pass type <select><option value="employment_pass">Employment Pass</option></select></label>
      <label>Pass expiry <input /></label><label>Return to Singapore <input /></label>
    `);
    const filled = await fillJapanVfsApplicantDetails(page, {
      surname: "PLACEHOLDER", given_names: "VIZA TEST", passport_number: "E00000000",
      email: "viza-placeholder@example.com", phone: "+6590000000",
    }, {
      singaporePassType: "employment_pass", singaporePassExpiryDate: "2027-12-31", intendedReturnDate: "2027-01-15",
    });
    assert.deepEqual(new Set(filled), new Set(["surname", "given_names", "passport_number", "email", "phone", "singapore_pass_type", "singapore_pass_expiry_date", "intended_return_date"]));
    assert.equal(await page.getByLabel(/Passport number/i).inputValue(), "E00000000");
    assert.equal(await page.getByLabel(/Singapore pass type/i).inputValue(), "employment_pass");
    assert.equal(await page.getByLabel(/Pass expiry/i).inputValue(), "2027-12-31");
  } finally { await page.close(); await browser.close(); }
});
