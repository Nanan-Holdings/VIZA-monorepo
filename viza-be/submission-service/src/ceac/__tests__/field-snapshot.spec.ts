import assert from "node:assert/strict";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import { snapshotDs160Fields } from "../field-snapshot";

test("batches visible native controls and preserves strict display identity", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <input id="hidden-template" class="name" style="display:none" value="wrong">
      <input id="surname" class="name" value="CHEN" maxlength="33">
      <select id="state"><option value="">Choose</option><option value="CA" selected>California</option></select>
      <input id="yes" name="plan" type="radio" value="Y">
      <input id="no" name="plan" type="radio" value="N" checked>
      <input id="na" type="checkbox">
    `);
    const observed: Array<{ fieldName: string; controlId: string; value: string }> = [];
    const result = await snapshotDs160Fields(page, {
      surname: { selector: ".name", type: "text", label: "Surname" },
      state: { selector: "#state", type: "select", label: "State" },
      plan: { selector: 'input[name="plan"]', type: "radio", label: "Plan" },
      na: { selector: "#na", type: "checkbox", label: "NA" },
    }, {
      surname: "CHEN", state: "California", plan: "N", na: "N",
    }, {}, { observeVerified: field => observed.push(field) });

    assert.equal(result.usedBatchedEvaluation, true);
    assert.equal(result.complete, true);
    assert.deepEqual(result.requestedFieldNames, ["surname", "state", "plan", "na"]);
    assert.equal(result.fields.surname.status, "verified");
    assert.equal(result.fields.surname.observation?.controlId, "surname");
    assert.equal(result.fields.surname.observation?.maxLength, 33);
    assert.equal(result.fields.plan.observation?.controlId, "no");
    assert.equal(result.fields.plan.observation?.displayValue, "No");
    assert.deepEqual(observed, [
      { fieldName: "surname", controlId: "surname", value: "CHEN" },
      { fieldName: "state", controlId: "state", value: "California" },
      { fieldName: "plan", controlId: "no", value: "No" },
      { fieldName: "na", controlId: "na", value: "No" },
    ]);
  } finally {
    await browser.close();
  }
});

test("reports hidden, disabled, readonly, missing and unsupported controls without skipping them", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <fieldset disabled><input id="disabled" value="OLD"></fieldset>
      <input id="readonly" readonly value="OLD">
      <input id="wrong-kind" type="checkbox" value="NEW">
      <input id="hidden" style="display:none" value="OLD">
      <div id="aria-disabled" aria-disabled="true"><input id="aria-child" value="OLD"></div>
      <div id="aria-conflict" aria-disabled="true"><div aria-disabled="false"><input id="aria-conflict-input" value="OLD"></div></div>
    `);
    const result = await snapshotDs160Fields(page, {
      disabled: { selector: "#disabled", type: "text", label: "Disabled" },
      readonly: { selector: "#readonly", type: "text", label: "Readonly" },
      missing: { selector: "#missing", type: "text", label: "Missing" },
      hidden: { selector: "#hidden", type: "text", label: "Hidden" },
      ariaChild: { selector: "#aria-child", type: "text", label: "ARIA disabled" },
      ariaConflict: { selector: "#aria-conflict-input", type: "text", label: "ARIA conflict" },
      unsupported: { selector: "#wrong-kind", type: "select", label: "Unsupported" },
      wrongText: { selector: "#wrong-kind", type: "text", label: "Wrong native text control" },
      file: { selector: "#wrong-kind", type: "file", label: "File" },
    }, {
      disabled: "NEW", readonly: "NEW", missing: "NEW", hidden: "NEW", ariaChild: "NEW", ariaConflict: "NEW",
      unsupported: "NEW", wrongText: "NEW", file: "NEW",
    }, {});

    assert.equal(result.complete, false);
    assert.equal(result.fields.disabled.status, "missing");
    assert.equal(result.fields.disabled.reason, "control_disabled");
    assert.equal(result.fields.disabled.observation?.enabled, false);
    assert.equal(result.fields.readonly.status, "missing");
    assert.equal(result.fields.readonly.reason, "control_readonly");
    assert.equal(result.fields.missing.reason, "no_visible_control");
    assert.equal(result.fields.hidden.reason, "no_visible_control");
    assert.equal(result.fields.ariaChild.status, "missing");
    assert.equal(result.fields.ariaChild.reason, "control_disabled");
    assert.equal(result.fields.ariaChild.observation?.enabled, false);
    assert.equal(result.fields.ariaConflict.status, "unsupported");
    assert.equal(result.fields.ariaConflict.reason, "unsupported_control");
    assert.equal(result.fields.unsupported.status, "unsupported");
    assert.equal(result.fields.wrongText.status, "unsupported");
    assert.equal(result.fields.wrongText.sawEligible, false);
    assert.equal(result.fields.file.status, "unsupported");
  } finally {
    await browser.close();
  }
});

test("rejects ambiguous select labels and preserves selector alias order", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent(`
      <select id="duplicate"><option value="A" selected>Duplicate</option><option value="B">Duplicate</option></select>
      <input id="alias" value="MATCH">
      <input id="mixed-good" class="mixed" value="MATCH">
      <input id="mixed-wrong" class="mixed" type="checkbox">
    `);
    const result = await snapshotDs160Fields(page, {
      duplicate: { selector: "#duplicate", type: "select", label: "Duplicate" },
      alias: { selector: "#does-not-exist, #alias", type: "text", label: "Alias" },
      mixed: { selector: ".mixed", type: "text", label: "Mixed native types" },
    }, { duplicate: "Duplicate", alias: "MATCH", mixed: "MATCH" }, {});
    assert.equal(result.fields.duplicate.status, "unsupported");
    assert.equal(result.fields.duplicate.ambiguous, true);
    assert.equal(result.fields.alias.status, "verified");
    assert.equal(result.fields.alias.observation?.selector, "#alias");
    assert.deepEqual(result.fields.alias.unsupportedSelectors, []);
    assert.equal(result.fields.mixed.status, "unsupported");
    assert.equal(result.fields.mixed.reason, "unsupported_control");
  } finally {
    await browser.close();
  }
});

test("returns a fresh mismatch then verification after the DOM changes", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="value" value="OLD">');
    const mapping = { value: { selector: "#value", type: "text" as const, label: "Value" } };
    const answers = { value: "NEW" };
    const before = await snapshotDs160Fields(page, mapping, answers, {});
    assert.equal(before.fields.value.status, "mismatch");
    assert.equal(before.complete, true);
    await page.locator("#value").fill("NEW");
    const after = await snapshotDs160Fields(page, mapping, answers, {});
    assert.equal(after.fields.value.status, "verified");
    assert.equal(after.fields.value.observation?.canSkipWrite, true);
  } finally {
    await browser.close();
  }
});

test("choice-only snapshots skip text while preserving requested keys", async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.setContent('<input id="text" value="TEXT"><input id="check" type="checkbox" checked>');
    const result = await snapshotDs160Fields(page, {
      text: { selector: "#text", type: "text", label: "Text" },
      check: { selector: "#check", type: "checkbox", label: "Check" },
    }, { text: "TEXT", check: "Y" }, {}, { choicesOnly: true });
    assert.equal(result.fields.text.reason, "not_requested");
    assert.equal(result.fields.check.status, "verified");
    assert.deepEqual(result.requestedFieldNames, ["check"]);
    assert.equal(result.complete, true);
  } finally {
    await browser.close();
  }
});
