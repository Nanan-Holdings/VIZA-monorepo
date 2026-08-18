import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const runnerSource = readFileSync(
  resolve(process.cwd(), "src", "kr-arrival-card", "runner.ts"),
  "utf8",
);

test("Korea runner uses official widgets for controlled fields", () => {
  assert.doesNotMatch(runnerSource, /setHiddenValue/);
  assert.match(runnerSource, /\.nat-options-value/);
  assert.match(runnerSource, /\.btnSrchNav\[data-edgb='/);
  assert.match(runnerSource, /segment: "E" \| "D"/);
  assert.match(runnerSource, /\.ent_strp_nat_nm/);
  assert.match(runnerSource, /\.ent_str_apt/);
  assert.match(runnerSource, /\.dep_strp_nat_nm/);
  assert.match(runnerSource, /\.dep_str_apt/);
  assert.match(runnerSource, /\.btnEngAddr/);
  assert.match(runnerSource, /#keywordZipCode/);
  assert.match(runnerSource, /#btnSearchZipCode/);
  assert.match(runnerSource, /KR_EARRIVAL_ADDITIONAL_QUESTION_KEYS\.length === 0/);
  assert.match(runnerSource, /kr_eac_dynamic_field_drift/);
});

test("Korea runner never bypasses disabled or readonly official controls", () => {
  const start = runnerSource.indexOf("async function fillInput");
  const end = runnerSource.indexOf("async function selectExact", start);
  assert.ok(start >= 0 && end > start);
  const fillInputSource = runnerSource.slice(start, end);
  assert.doesNotMatch(fillInputSource, /removeAttribute/);
  assert.doesNotMatch(fillInputSource, /\.evaluate\(/);
  assert.match(fillInputSource, /isDisabled/);
  assert.match(fillInputSource, /readonly/);
  assert.match(fillInputSource, /isEditable/);
});

test("Korea runner redacts sensitive controls before every diagnostic screenshot", () => {
  assert.match(runnerSource, /__vizaKrEacScreenshotState/);
  assert.match(runnerSource, /input\[name\*='passport'/);
  assert.match(runnerSource, /input\[name\*='email'/);
  assert.match(runnerSource, /input\[name\*='tel'/);
  assert.match(runnerSource, /sensitiveValues/);
  assert.match(runnerSource, /saveScreenshot\(page, tempDir, "after-submit", logs, sensitiveValues\)/);
});

test("Korea stop-before-submit exits before the final official submit control", () => {
  const stop = runnerSource.indexOf("if (options.stopBeforeSubmit)");
  const submit = runnerSource.indexOf("clickVisible(page, [\"#btnSubmit\"]", stop);
  assert.ok(stop >= 0 && submit > stop);
  const stopSource = runnerSource.slice(stop, submit);
  assert.match(stopSource, /kr_eac_stopped_before_submit/);
  assert.match(stopSource, /blocked: true/);
  assert.doesNotMatch(stopSource, /#btnSubmit/);
});

test("Korea agreement and OCR modal actions stay anchored to observed controls", () => {
  assert.match(runnerSource, /label\[for='chkAgreement1'\]/);
  assert.match(runnerSource, /label\[for='chkAgreement3'\]/);
  assert.match(runnerSource, /label\[for='chkAgreement4'\]/);
  assert.match(runnerSource, /#btnPopClose/);
});
