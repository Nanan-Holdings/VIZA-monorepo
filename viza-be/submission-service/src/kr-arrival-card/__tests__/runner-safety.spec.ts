import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  defaultsToBrowserbase,
  isRemoteBrowserProviderPolicyBlockMessage,
} from "../../arrival-card-browser";
import { classifyOfficialTravelLookup } from "../normalize";

const runnerSource = readFileSync(
  resolve(process.cwd(), "src", "kr-arrival-card", "runner.ts"),
  "utf8",
);

test("Korea runner uses official widgets for controlled fields", () => {
  assert.doesNotMatch(runnerSource, /setHiddenValue/);
  assert.match(runnerSource, /\.nat-options-value/);
  assert.match(runnerSource, /\.btnSrchNav\[data-edgb='/);
  assert.match(runnerSource, /fillOfficialAirFlightNumber/);
  assert.match(runnerSource, /\.cno-options\[data-edgb='/);
  assert.match(runnerSource, /kr_eac_airline_widget_drift/);
  assert.match(runnerSource, /kr_eac_airline_option_click_failed/);
  assert.match(runnerSource, /segment: "E" \| "D"/);
  assert.match(runnerSource, /\.ent_strp_nat_nm/);
  assert.match(runnerSource, /\.ent_str_apt/);
  assert.match(runnerSource, /\.dep_strp_nat_nm/);
  assert.match(runnerSource, /\.dep_str_apt/);
  assert.match(runnerSource, /\.btnEngAddr/);
  assert.match(runnerSource, /#keywordZipCode/);
  assert.match(runnerSource, /#btnSearchZipCode/);
  assert.match(runnerSource, /keywordSelectors\.join/);
  assert.match(runnerSource, /allowUniquePostalFallback/);
  assert.match(runnerSource, /postalCandidates\.length === 1/);
  assert.match(runnerSource, /\[onclick\*='addrSet\('\]/);
  assert.match(runnerSource, /searchDiagnostics/);
  assert.match(runnerSource, /kr_eac_address_result_click_failed/);
  assert.match(runnerSource, /acknowledgeOfficialAddressNoResultsPrompt/);
  assert.match(runnerSource, /kr_eac_address_prompt_drift/);
  assert.match(runnerSource, /KR_EARRIVAL_ADDITIONAL_QUESTION_KEYS\.length === 0/);
  assert.match(runnerSource, /kr_eac_dynamic_field_drift/);
  assert.match(runnerSource, /option\[value=/);
  assert.match(runnerSource, /runOfficialDateRefresh/);
  assert.match(runnerSource, /bb-custom-select-container/);
  assert.match(runnerSource, /jquery\(month\)\.trigger\("change"\)/);
  assert.match(runnerSource, /kr_eac_date_widget_incompatible/);
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
  assert.match(runnerSource, /input:not\(\[type='checkbox'\]\)/);
  assert.match(runnerSource, /:not\(\[type='file'\]\)/);
  assert.match(runnerSource, /textarea/);
  assert.match(runnerSource, /styledElements/);
  assert.match(runnerSource, /setProperty\("color", "transparent", "important"\)/);
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
  assert.match(runnerSource, /setRequiredAgreement\(page, "#chkAgreement1"/);
  assert.match(runnerSource, /setRequiredAgreement\(page, "#chkAgreement3"/);
  assert.match(runnerSource, /setRequiredAgreement\(page, "#chkAgreement4"/);
  assert.match(runnerSource, /setChecked\(true, \{ force: true/);
  assert.match(runnerSource, /isChecked/);
  assert.match(runnerSource, /kr_eac_agreement_not_committed/);
  assert.match(runnerSource, /kr_eac_agreement_confirmation_rejected/);
  assert.match(runnerSource, /kr_eac_individual_form_timeout/);
  assert.match(runnerSource, /kr_eac_agreements_verified/);
  assert.match(runnerSource, /kr_eac_agreement_confirmed/);
  assert.match(runnerSource, /#btnPopClose/);
  assert.match(runnerSource, /#btnPopClose"\)\.first\(\)\.waitFor\(\{ state: "visible", timeout: 7_500 \}\)/);
  assert.match(runnerSource, /kr_eac_individual_form_ready/);
  assert.match(runnerSource, /\/portal\/apply\/exptEmlChk\.do/);
  assert.match(runnerSource, /kr_eac_agreement_email_check/);
  assert.match(runnerSource, /agreement confirmation"[\s\S]*noWaitAfter: true/);
  assert.match(runnerSource, /kr_eac_agreement_retry/);
  assert.match(runnerSource, /error\.code === "kr_eac_agreement_selector_drift"/);
});

test("Korea travel lookup accepts the official unknown-flight fallback but rejects real conflicts", () => {
  assert.equal(classifyOfficialTravelLookup("Singapore", "Changi", "", ""), "unresolved");
  assert.equal(
    classifyOfficialTravelLookup(
      "Singapore",
      "Changi",
      "SINGAPORE",
      "SINGAPORE CHANGI AIRPORT",
    ),
    "matched",
  );
  assert.equal(
    classifyOfficialTravelLookup("Singapore", null, "CHINA", "BEIJING"),
    "mismatch",
  );
});

test("Korea error screenshots redact all text inputs and obscure select values", () => {
  assert.match(runnerSource, /input:not\(\[type='checkbox'\]\)/);
  assert.match(runnerSource, /styledElements/);
  assert.match(runnerSource, /text-shadow/);
  assert.match(runnerSource, /mergedLogs/);
});

test("Korea unexpected portal failures retain a redacted screenshot", () => {
  assert.match(runnerSource, /saveScreenshot\(page, tempDir, "unexpected-error", logs, sensitiveValues\)/);
  assert.match(runnerSource, /screenshotPaths: diagnosticScreenshots/);
});

test("Korea e-Arrival Card defaults to Browserbase instead of Bright Data", () => {
  assert.equal(defaultsToBrowserbase("KR_EAC"), true);
  assert.equal(defaultsToBrowserbase("SGAC"), false);
});

test("Korea e-Arrival Card classifies Bright Data government policy blocks", () => {
  assert.equal(
    isRemoteBrowserProviderPolicyBlockMessage(
      "Access denied: www.e-arrivalcard.go.kr is classified as Government and blocked by Bright Data (proxy_error)",
    ),
    true,
  );
  assert.equal(isRemoteBrowserProviderPolicyBlockMessage("net::ERR_NAME_NOT_RESOLVED"), false);
});

test("Korea navigation failures preserve a structured provider error", () => {
  assert.match(runnerSource, /kr_eac_browser_provider_policy_blocked/);
  assert.match(runnerSource, /kr_eac_official_portal_navigation_failed/);
  assert.match(runnerSource, /kr_eac_navigation_failed/);
  assert.match(runnerSource, /kr_eac_navigation_recovered/);
  assert.match(runnerSource, /kr_eac_navigation_retry/);
  assert.match(runnerSource, /kr_eac_unexpected_error/);
});

test("Korea runner waits for official travel prompts to close", () => {
  assert.match(runnerSource, /for \(let pass = 0; pass < 3; pass \+= 1\)/);
  assert.match(runnerSource, /lookup left an unexpected modal open/);
  assert.match(runnerSource, /visibleBodies\.length > 0/);
  assert.match(runnerSource, /kr_eac_control_click_failed/);
});

test("Korea address search observes results without waiting on a phantom navigation", () => {
  assert.match(runnerSource, /search\.click\(\{ timeout: 20_000, noWaitAfter: true \}\)/);
  assert.match(runnerSource, /zipSearch\.click\(\{ timeout: 20_000, noWaitAfter: true \}\)/);
});

test("Korea address fallback paginates and requires a unique postal plus building match", () => {
  assert.match(runnerSource, /fn_egov_link_page\(\$\{pageNumber\}\)/);
  assert.match(runnerSource, /candidate\.postal === postalQuery/);
  assert.match(runnerSource, /leadingAddressNumber\(candidate\.address\) === savedBuildingNumber/);
  assert.match(runnerSource, /uniqueMatches\.length !== 1/);
});
