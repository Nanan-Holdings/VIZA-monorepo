import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fillPageFields, orchestrateFill, verifyPageFieldValues } from "../orchestrator";
import { createRecoveryTracker } from "../artifacts";
import { ds160ContactMappings, ds160TravelMappings } from "../../ds160-form-mappings";
import { deriveDS160Answers } from "../../ds160-derive-answers";
import { createDs160BranchPolicy, ds160MappingRepeatGroup } from "../field-contract";

test("official review expectations use verified control IDs and selected display values", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="tbxAPP_SURNAME" value="CHEN"><select id="ddlCountry"><option value="CHIN" selected>CHINA</option></select><input id="rblGate_1" name="rblGate" type="radio" value="N" checked>');
    const observed: Array<{ fieldName: string; controlId: string; value: string }> = [];
    await verifyPageFieldValues(page, {
      surname: { selector: "#tbxAPP_SURNAME", type: "text", label: "Surname" },
      country: { selector: "#ddlCountry", type: "select", label: "Country" },
      gate: { selector: 'input[name="rblGate"]', type: "radio", label: "Gate" },
    }, { surname: "CHEN", country: "CHIN", gate: "N" }, {}, {
      requireMappedAnswers: true, observeVerified: field => observed.push(field),
    });
    assert.deepEqual(observed, [
      { fieldName: "surname", controlId: "tbxAPP_SURNAME", value: "CHEN" },
      { fieldName: "country", controlId: "ddlCountry", value: "CHINA" },
      { fieldName: "gate", controlId: "rblGate_1", value: "No" },
    ]);
  } finally { await browser.close(); }
});

test("fills intended stay on the no-specific-plans branch instead of dropping it as a repeat field", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="tbxTRAVEL_LOS"><select id="ddlTRAVEL_LOS_CD"><option value="">Choose</option><option value="D">DAY(S)</option></select>');
    const saved = { has_specific_plans: "no", intended_length_of_stay_value: "10", intended_length_of_stay_unit: "DAY(S)" };
    const branch = createDs160BranchPolicy(saved);
    const mappings = Object.fromEntries(Object.entries(ds160TravelMappings).filter(([key]) =>
      !ds160MappingRepeatGroup(key) && branch.isMappingActive(key)));
    const answers = deriveDS160Answers({ ...saved });
    delete answers.has_specific_travel_plans;
    await fillPageFields(page, mappings, answers, {}, { requireMappedAnswers: true });
    assert.equal(await page.locator('#tbxTRAVEL_LOS').inputValue(), '10');
    assert.equal(await page.locator('#ddlTRAVEL_LOS_CD').inputValue(), 'D');
  } finally { await browser.close(); }
});

test("an unknown official branch cannot advance through an unmapped page", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const outputDir = mkdtempSync(join(tmpdir(), "ceac-unmapped-test-"));
  try {
    await page.setContent('<h2>Additional visa category questions</h2><input id="newRequiredField"><button onclick="document.body.dataset.advanced=\'yes\'">Next</button>');
    const result = await orchestrateFill({
      browser, context: page.context(), page, close: async () => browser.close(),
    }, {
      answers: {}, profile: {}, outputDir,
      tracker: createRecoveryTracker({ runId: "unmapped", delegate: { async record() {} } }),
    });
    assert.equal(result.result.status, "failed");
    assert.equal(await page.locator("body").getAttribute("data-advanced"), null);
    assert.deepEqual(result.sectionCoverage.skipped, []);
  } finally {
    await browser.close();
    if (dirname(resolve(outputDir)) !== resolve(tmpdir())) throw new Error("Unexpected test output path");
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("rejects a unique partial official option instead of changing its meaning", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<select id="status"><option value="">Choose</option><option value="NIV">Nonimmigrant</option></select><input id="later">');
    await assert.rejects(fillPageFields(page, {
      status: { selector: "#status", type: "select", label: "Status" },
      later: { selector: "#later", type: "text", label: "Later" },
    }, { status: "immigrant", later: "should not fill" }, {}, { requireMappedAnswers: true }), /could not be filled or verified/);
    assert.equal(await page.locator("#status").inputValue(), "");
    assert.equal(await page.locator("#later").inputValue(), "");
  } finally { await browser.close(); }
});

test("provider NONE never overwrites the separate other-websites answer", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`<input type="radio" name="rblAddSocial" value="Y">
      <input type="radio" name="rblAddSocial" value="N">
      <select id="dtlSocial_ctl00_ddlSocialMedia"><option value="">Choose</option><option value="NONE">None</option></select>`);
    const answers = deriveDS160Answers({ has_social_media: "no", has_other_social_media: "yes" });
    await fillPageFields(page, {
      has_other_social_media: ds160ContactMappings.has_other_social_media,
      social_media_provider: ds160ContactMappings.social_media_provider,
    }, answers, {}, { requireMappedAnswers: true });
    assert.equal(await page.locator('input[value="Y"]').isChecked(), true);
    assert.equal(await page.locator("select").inputValue(), "NONE");
  } finally { await browser.close(); }
});

test("active missing controls stop submission and inactive stale answers are not touched", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="inactive"><input id="current">');
    await fillPageFields(page, {
      inactive: { selector: "#inactive", type: "text", label: "Inactive" },
      current: { selector: "#current", type: "text", label: "Current" },
    }, { inactive: "stale", current: "current" }, {}, {
      isFieldActive: key => key !== "inactive", requireMappedAnswers: true,
    });
    assert.equal(await page.locator("#inactive").inputValue(), "");
    await assert.rejects(() => fillPageFields(page, {
      current: { selector: "#current", type: "text", label: "Current" },
      missing: { selector: "#missing", type: "text", label: "Missing" },
    }, { current: "current", missing: "private-answer" }, {}, { requireMappedAnswers: true }),
    /Missing.*could not be filled or verified/);
  } finally { await browser.close(); }
});

test("repeated row scope and native clicks preserve separate answers and activate branches", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`<div id="first"><input class="answer" value="first"></div>
      <div id="second"><input class="answer"><input type="radio" name="gate" value="Y"
        onclick="document.querySelector('#detail').style.display='block'"><input id="detail" style="display:none"></div>`);
    await fillPageFields(page, {
      answer: { selector: ".answer", type: "text", label: "Answer" },
      gate: { selector: 'input[name="gate"]', type: "radio", label: "Gate" },
      detail: { selector: "#detail", type: "text", label: "Detail" },
    }, { answer: "second", gate: "Y", detail: "branch" }, {}, {
      scope: page.locator("#second"), requireMappedAnswers: true,
    });
    assert.equal(await page.locator("#first .answer").inputValue(), "first");
    assert.equal(await page.locator("#second .answer").inputValue(), "second");
    assert.equal(await page.locator("#detail").inputValue(), "branch");
  } finally { await browser.close(); }
});

test("fills visible text, select, radio, and checkbox controls and verifies their values", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <select id="country">
        <option value="">Choose</option>
        <option value="USA">United States</option>
      </select>
      <select id="country-by-label">
        <option value="">Choose</option>
        <option value="USA">United States</option>
      </select>
      <input id="surname" type="text">
      <input id="not-applicable" type="checkbox">
      <div style="display:none"><input name="has-plan" value="Y"></div>
      <label><input name="has-plan" type="radio" value="N">No</label>
      <label><input name="has-plan" type="radio" value="Y">Yes</label>
    `);

    await fillPageFields(
      page,
      {
        country: { selector: "#country", type: "select", label: "Country" },
        country_by_label: {
          selector: "#country-by-label",
          type: "select",
          label: "Country by label",
        },
        surname: { selector: "#surname", type: "text", label: "Surname" },
        not_applicable: { selector: "#not-applicable", type: "checkbox", label: "Not applicable" },
        has_plan: { selector: 'input[name="has-plan"]', type: "radio", label: "Has plan" },
      },
      { country: "USA", country_by_label: "United States", surname: "CHEN", has_plan: "N", not_applicable: "Y" },
      {},
    );

    assert.equal(await page.locator("#country").inputValue(), "USA");
    assert.equal(await page.locator("#country-by-label").inputValue(), "USA");
    assert.equal(await page.locator("#surname").inputValue(), "CHEN");
    assert.equal(await page.locator("#not-applicable").isChecked(), true);
    assert.equal(await page.locator('input[name="has-plan"][value="N"]').isChecked(), true);
    assert.equal(await page.locator('input[name="has-plan"][value="Y"]').last().isChecked(), false);
  } finally {
    await browser.close();
  }
});

test("stops when a postback replaces an entered value or checked state", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    for (const type of ["text", "checkbox"] as const) {
      await page.setContent(`
        <input id="replaced" type="${type}">
        <input id="later" type="text">
        <script>
          document.querySelector('#replaced').addEventListener('${type === "text" ? "input" : "change"}', event => {
            setTimeout(() => {
              if (event.target.type === 'checkbox') event.target.checked = false;
              else event.target.value = '';
            }, 25);
          });
        </script>
      `);
      await assert.rejects(
        () => fillPageFields(page, {
          replaced: { selector: "#replaced", type, label: "Replaced control" },
          later: { selector: "#later", type: "text", label: "Later control" },
        }, { replaced: type === "text" ? "SUPPLIED-ANSWER" : "Y", later: "must-stop" }, {}),
        /could not be filled or verified/i,
      );
      assert.equal(await page.locator("#later").inputValue(), "");
    }
  } finally {
    await browser.close();
  }
});

test("fails closed when a partial select label matches multiple official options", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <select id="country">
        <option value="">Choose</option>
        <option value="US">United States</option>
        <option value="GB">United Kingdom</option>
      </select>
    `);

    await assert.rejects(
      () =>
        fillPageFields(
          page,
          { country: { selector: "#country", type: "select", label: "Country" } },
          { country: "United" },
          {},
        ),
      /could not be filled or verified/i,
    );
    assert.equal(await page.locator("#country").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("skips a hidden conditional field while continuing visible fields", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <input id="visible" type="text">
      <input id="conditional" type="text" style="display:none">
    `);

    await fillPageFields(
      page,
      {
        visible: { selector: "#visible", type: "text", label: "Visible field" },
        conditional: {
          selector: "#conditional",
          type: "text",
          label: "Conditional field",
        },
      },
      { visible: "kept", conditional: "hidden-answer" },
      {},
    );

    assert.equal(await page.locator("#visible").inputValue(), "kept");
    assert.equal(await page.locator("#conditional").inputValue(), "");
  } finally {
    await browser.close();
  }
});

test("fails closed for a visible field and does not continue to later fields", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <select id="unsupported">
        <option value="">Choose</option>
        <option value="A">Allowed</option>
      </select>
      <input id="after" type="text">
    `);

    await assert.rejects(
      () =>
        fillPageFields(
          page,
          {
            unsupported: {
              selector: "#unsupported",
              type: "select",
              label: "Unsupported option",
            },
            after: { selector: "#after", type: "text", label: "Later field" },
          },
          { unsupported: "TOP-SECRET-ANSWER", after: "must-not-be-filled" },
          {},
        ),
      (error: unknown) => {
        assert.match(String(error), /could not be filled or verified/i);
        assert.doesNotMatch(String(error), /TOP-SECRET-ANSWER|must-not-be-filled/);
        return true;
      },
    );

    assert.equal(await page.locator("#after").inputValue(), "");
  } finally {
    await browser.close();
  }
});
