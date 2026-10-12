import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import {
  applyExplicitPreparerAnswer,
  assertDs160PreparerAnswers,
  fillVerifiedPassportSignature,
} from "../signature-fields";

test("does not require a preparer answer when no preparer controls are visible", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="unrelated" type="radio" value="N">');
    await applyExplicitPreparerAnswer(page);
    assert.equal(await page.locator("#unrelated").isChecked(), false);
  } finally {
    await browser.close();
  }
});

test("checks only the explicit preparer No control and ignores unrelated radios", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <input id="unrelated" name="other" type="radio" value="N">
      <label><input id="ctl00_rblPreparer_0" name="preparer" type="radio" value="Y">Yes</label>
      <label><input id="ctl00_rblPreparer_1" name="preparer" type="radio" value="N">No</label>
    `);
    await applyExplicitPreparerAnswer(page, "no");
    assert.equal(await page.locator("#ctl00_rblPreparer_0").isChecked(), false);
    assert.equal(await page.locator("#ctl00_rblPreparer_1").isChecked(), true);
    assert.equal(await page.locator("#unrelated").isChecked(), false);
  } finally {
    await browser.close();
  }
});

test("matches the live CEAC rblPREP_IND preparer group", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <label><input id="ctl00_SiteContentPlaceHolder_FormView3_rblPREP_IND_0"
        name="ctl00$SiteContentPlaceHolder$FormView3$rblPREP_IND" type="radio" value="Y">Yes</label>
      <label><input id="ctl00_SiteContentPlaceHolder_FormView3_rblPREP_IND_1"
        name="ctl00$SiteContentPlaceHolder$FormView3$rblPREP_IND" type="radio" value="N">No</label>
    `);
    await applyExplicitPreparerAnswer(page, "no");
    assert.equal(await page.locator("#ctl00_SiteContentPlaceHolder_FormView3_rblPREP_IND_0").isChecked(), false);
    assert.equal(await page.locator("#ctl00_SiteContentPlaceHolder_FormView3_rblPREP_IND_1").isChecked(), true);
  } finally {
    await browser.close();
  }
});

test("blocks a visible preparer group without an explicit saved answer", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <label><input id="ctl00_rblPreparer_0" name="preparer" type="radio" value="Y">Yes</label>
      <label><input id="ctl00_rblPreparer_1" name="preparer" type="radio" value="N">No</label>
    `);
    await assert.rejects(
      applyExplicitPreparerAnswer(page),
      /explicit saved yes\/no answer/,
    );
  } finally {
    await browser.close();
  }
});

test("blocks preparer Yes before changing the radio when required third-party data is missing", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <label><input id="ctl00_rblPreparer_0" name="preparer" type="radio" value="Y">Yes</label>
      <label><input id="ctl00_rblPreparer_1" name="preparer" type="radio" value="N">No</label>
    `);
    await assert.rejects(
      applyExplicitPreparerAnswer(page, "yes"),
      /Missing required DS-160 preparer answer: ds160_preparer_surname/,
    );
    assert.equal(await page.locator("#ctl00_rblPreparer_0").isChecked(), false);
    assert.equal(await page.locator("#ctl00_rblPreparer_1").isChecked(), false);
  } finally {
    await browser.close();
  }
});

const preparerAnswers = {
  ds160_preparer_assistance: "yes",
  ds160_preparer_surname: "TEST",
  ds160_preparer_given_names: "PREPARER",
  ds160_preparer_organization_name: "DOES_NOT_APPLY",
  ds160_preparer_street1: "100 EXAMPLE ROAD",
  ds160_preparer_city: "TEST CITY",
  ds160_preparer_state_province: "DOES_NOT_APPLY",
  ds160_preparer_postal_code: "10000",
  ds160_preparer_country: "CHIN",
  ds160_preparer_relationship: "TEST ASSISTANT",
};

const preparerFieldsHtml = [
  ["surname", "Surnames", false],
  ["given_names", "Given Names", true],
  ["organization_name", "Organization Name", true],
  ["street1", "Street Address (Line 1)", false],
  ["street2", "Street Address (Line 2) *Optional*", false],
  ["city", "City", false],
  ["state_province", "State/Province", true],
  ["postal_code", "Postal Zone/ZIP Code", true],
  ["country", "Country/Region", false],
  ["relationship", "Relationship to You", false],
].map(([id, label, na]) => `<div>
  <label for="${id}">${label}</label>
  ${id === "country" ? '<select id="country"><option value="">-SELECT ONE-</option><option value="CHIN">CHINA</option></select>' : `<input id="${id}" type="text">`}
  ${na ? `<label><input type="checkbox" id="${id}_na" onchange="document.getElementById('${id}').disabled=this.checked">Does Not Apply</label>` : ""}
</div>`).join("");

async function showPreparerForm(page: import("@playwright/test").Page): Promise<void> {
  await page.setContent(`
    <label><input id="ctl00_rblPreparer_0" name="preparer" type="radio" value="Y">Yes</label>
    <label><input id="ctl00_rblPreparer_1" name="preparer" type="radio" value="N">No</label>
    <div id="details" hidden></div>
    <label><input id="unrelated_na" type="checkbox">Does Not Apply</label>
  `);
  await page.locator("#ctl00_rblPreparer_0").evaluate((radio, html) => {
    radio.addEventListener("change", () => setTimeout(() => {
      const details = document.getElementById("details")!;
      details.innerHTML = html;
      details.hidden = false;
    }, 100));
  }, preparerFieldsHtml);
}

test("preparer preflight requires an explicit declaration and limits NA to official NA fields", () => {
  assert.throws(() => assertDs160PreparerAnswers({}), /ds160_preparer_assistance/);
  assert.doesNotThrow(() => assertDs160PreparerAnswers({ ds160_preparer_assistance: "no" }));
  assert.doesNotThrow(() => assertDs160PreparerAnswers(preparerAnswers));
  assert.throws(() => assertDs160PreparerAnswers({ ...preparerAnswers, ds160_preparer_surname: "DOES_NOT_APPLY" }), /not supported.*ds160_preparer_surname/);
});

test("fills the Yes branch after postback with field-scoped NA and exact country selection", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await showPreparerForm(page);
    await applyExplicitPreparerAnswer(page, "yes", preparerAnswers);
    assert.equal(await page.locator("#surname").inputValue(), "TEST");
    assert.equal(await page.locator("#country").inputValue(), "CHIN");
    assert.equal(await page.locator("#street2").inputValue(), "");
    assert.equal(await page.locator("#organization_name_na").isChecked(), true);
    assert.equal(await page.locator("#organization_name").isEnabled(), false);
    assert.equal(await page.locator("#unrelated_na").isChecked(), false);
  } finally {
    await browser.close();
  }
});

test("stops when a later preparer field postback drops an earlier answer", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await showPreparerForm(page);
    await page.evaluate(() => document.addEventListener("change", event => {
      if ((event.target as HTMLElement).id === "relationship") {
        (document.getElementById("surname") as HTMLInputElement).value = "";
      }
    }));
    await assert.rejects(applyExplicitPreparerAnswer(page, "yes", preparerAnswers), /failed final read-back: ds160_preparer_surname/);
  } finally {
    await browser.close();
  }
});

test("rejects ambiguous preparer labels rather than selecting the first matching field", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await showPreparerForm(page);
    await page.locator("body").evaluate(element => element.insertAdjacentHTML("beforeend", '<label>Surnames<input type="text"></label>'));
    await assert.rejects(applyExplicitPreparerAnswer(page, "yes", preparerAnswers), /ambiguous.*ds160_preparer_surname/);
  } finally {
    await browser.close();
  }
});

test("blocks an ambiguous visible preparer control", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<label><input id="ctl00_rblPreparer_unknown" name="preparer" type="radio" value="maybe">Maybe</label>',
    );
    await assert.rejects(
      applyExplicitPreparerAnswer(page, "no"),
      /missing or ambiguous/,
    );
  } finally {
    await browser.close();
  }
});

test("fills the unique official passport signature input and leaves the first generic input alone", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <input id="otherVisible" type="text">
      <input id="SIGN_PASSPORT" type="text">
    `);
    await fillVerifiedPassportSignature(page, "P1234567");
    assert.equal(await page.locator("#SIGN_PASSPORT").inputValue(), "P1234567");
    assert.equal(await page.locator("#otherVisible").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("accepts an explicit passport label when the input id is generic", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <label for="signatureField">Passport Number</label>
      <input id="signatureField" type="text">
      <input id="otherVisible" type="text">
    `);
    await fillVerifiedPassportSignature(page, "P7654321");
    assert.equal(await page.locator("#signatureField").inputValue(), "P7654321");
    assert.equal(await page.locator("#otherVisible").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("matches the live CEAC PPTNumTbx passport signature input without a label", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <input id="ctl00_SiteContentPlaceHolder_PPTNumTbx"
        name="ctl00$SiteContentPlaceHolder$PPTNumTbx" type="text">
      <input id="ctl00_SiteContentPlaceHolder_CodeTextBox" type="text">
    `);
    await fillVerifiedPassportSignature(page, "P1234567");
    assert.equal(await page.locator("#ctl00_SiteContentPlaceHolder_PPTNumTbx").inputValue(), "P1234567");
    assert.equal(await page.locator("#ctl00_SiteContentPlaceHolder_CodeTextBox").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("rejects a generic input instead of using editable[0]", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="otherVisible" type="text">');
    await assert.rejects(
      fillVerifiedPassportSignature(page, "P1234567"),
      /exactly one visible official DS-160 passport signature field/,
    );
    assert.equal(await page.locator("#otherVisible").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("rejects multiple explicit passport inputs", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <input id="SIGN_PASSPORT" type="text">
      <input id="PASSPORT_NUMBER" type="text">
    `);
    await assert.rejects(
      fillVerifiedPassportSignature(page, "P1234567"),
      /exactly one visible official DS-160 passport signature field/,
    );
  } finally {
    await browser.close();
  }
});

test("does not use a readonly official passport input", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="SIGN_PASSPORT" type="text" readonly>');
    await assert.rejects(
      fillVerifiedPassportSignature(page, "P1234567"),
      /exactly one visible official DS-160 passport signature field/,
    );
  } finally {
    await browser.close();
  }
});

test("rejects a passport signature when exact read-back changes", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="SIGN_PASSPORT" type="text">');
    await page.locator("#SIGN_PASSPORT").evaluate((input) => {
      input.addEventListener("input", () => {
        (input as HTMLInputElement).value = "MUTATED";
      });
    });
    await assert.rejects(
      fillVerifiedPassportSignature(page, "P1234567"),
      /failed exact read-back verification/,
    );
  } finally {
    await browser.close();
  }
});
