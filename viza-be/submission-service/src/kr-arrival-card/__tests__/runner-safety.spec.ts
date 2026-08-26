import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  defaultsToBrowserbase,
  isRemoteBrowserProviderPolicyBlockMessage,
} from "../../arrival-card-browser";
import { classifyOfficialTravelLookup } from "../normalize";
import {
  extractOfficialIssueNumberFromText,
  isOfficialCompletionPageText,
  normalizeOfficialIssueNumber,
} from "../confirmation";

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
  assert.match(runnerSource, /input\.soj_prrpl_rnm_bs_han_addr/);
  assert.match(runnerSource, /input\.soj_prrpl_rnm_bs_eng_addr/);
  assert.match(runnerSource, /input\.zip/);
  assert.match(runnerSource, /kr_eac_address_commit_failed/);
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

test("Korea completion parser rejects the blank table heading as an issue number", () => {
  const stillLoading = [
    "Submission of e-Arrival card complete",
    "Basic information",
    "Issue number country/region",
    "Surname (as shown on passport) Given name (as shown on passport)",
  ].join("\n");
  assert.equal(extractOfficialIssueNumberFromText(stillLoading), null);
  assert.equal(normalizeOfficialIssueNumber("country"), null);
});

test("Korea completion parser accepts only a digit-bearing official issue token", () => {
  assert.equal(
    extractOfficialIssueNumberFromText("EAC-26-PA-123456789"),
    "EAC-26-PA-123456789",
  );
  assert.equal(
    extractOfficialIssueNumberFromText("EAC‑26‑PA‑123456789"),
    "EAC-26-PA-123456789",
  );
  assert.equal(
    extractOfficialIssueNumberFromText("Issue number: EAC-20260824-AB123456"),
    "EAC-20260824-AB123456",
  );
  assert.equal(
    extractOfficialIssueNumberFromText("발급번호 20260824-1234567890"),
    "20260824-1234567890",
  );
  assert.equal(normalizeOfficialIssueNumber("REFERENCE"), null);
});

test("Korea completion marker accepts the official non-breaking hyphen", () => {
  assert.equal(isOfficialCompletionPageText("Submission of e-Arrival card complete"), true);
  assert.equal(isOfficialCompletionPageText("Submission of e‑Arrival card complete"), true);
  assert.equal(isOfficialCompletionPageText("Korea e-Arrival Card declaration"), false);
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

test("Korea success evidence waits for loaded data and never prints a blank fallback", () => {
  assert.match(runnerSource, /hasVisibleConfirmationLoader/);
  assert.match(runnerSource, /waitForOfficialIssueNumber\(page, 90_000\)/);
  assert.match(runnerSource, /kr_eac_verified_detailed_card_pdf_fallback/);
  assert.doesNotMatch(runnerSource, /kr_eac_confirmation_page_pdf_fallback/);
  assert.match(runnerSource, /#btnViewEacInfo/);
  assert.match(runnerSource, /kr_eac_official_card_view_pdf_captured/);
  assert.match(runnerSource, /kr_eac_official_card_view_pdf_rejected_missing_rendered_detail/);
  assert.match(runnerSource, /kr_eac_confirmation_pdf_rejected_missing_detailed_card/);
});

test("Korea CAPTCHA solve preserves leading zeroes and clicks the labelled confirmation control", () => {
  assert.match(runnerSource, /numeric:\s*1/);
  assert.match(runnerSource, /minLength:\s*6/);
  assert.match(runnerSource, /maxLength:\s*6/);
  assert.match(runnerSource, /including any leading zero/);
  assert.match(runnerSource, /normalizeKrEArrivalCaptchaAnswer/);
  assert.match(runnerSource, /button:has-text\('Confirm'\)/);
  assert.doesNotMatch(runnerSource, /\["#captchaConfirm",\s*"\.captcha button",\s*"\[role='dialog'\] button"\]/);
});

test("Korea CAPTCHA solve retries transient solver failures and official rejections in the same form", () => {
  assert.match(runnerSource, /const maxAttempts = 3/);
  assert.match(runnerSource, /kr_eac_captcha_solver_failed attempt=/);
  assert.match(runnerSource, /kr_eac_captcha_rejected attempt=/);
  assert.match(runnerSource, /refreshVisibleCaptcha/);
  assert.match(runnerSource, /waitForCaptchaDecision/);
});

test("Korea treats the official completion page as authoritative over a stale CAPTCHA result", () => {
  const completionCheck = runnerSource.indexOf("isOfficialCompletionPageText(body)");
  const captchaResultCheck = runnerSource.indexOf('page.locator("#captchaResult")');
  assert.ok(completionCheck >= 0);
  assert.ok(captchaResultCheck >= 0);
  assert.ok(completionCheck < captchaResultCheck);
  assert.match(runnerSource, /let sawRejectedResult = false/);
  assert.match(runnerSource, /sawRejectedResult \? "rejected" : "pending"/);
  assert.doesNotMatch(runnerSource, /if \(result && result !== "Y"\) return "rejected"/);
  assert.match(runnerSource, /latestSuccessMarker = isOfficialCompletionPageText\(latestBody\)/);
});

test("Korea waits for the asynchronously mounted CAPTCHA checkpoint", () => {
  assert.match(runnerSource, /const checkpointDeadline = Date\.now\(\) \+ 20_000/);
  assert.match(runnerSource, /if \(image \|\| recaptchaFrame\) break/);
  assert.match(runnerSource, /kr_eac_captcha_checkpoint_timeout/);
  assert.match(runnerSource, /confirmation-not-reached/);
});

test("Korea anchors unnamed CAPTCHA controls to the verification image container", () => {
  assert.match(runnerSource, /findVerificationCaptchaContainer/);
  assert.match(runnerSource, /xpath=ancestor::\*\[descendant::input/);
  assert.match(runnerSource, /const captchaContainer = await findVerificationCaptchaContainer\(image, captchaDialog\)/);
  assert.match(runnerSource, /captchaContainer\.locator\(/);
});

test("Korea final review accepts the official English Confirm control", () => {
  assert.match(runnerSource, /name: \/\^\(\?:confirm\|ok\|확인\)\$\/iu/);
  assert.match(runnerSource, /input\[type='button'\]\[value='Confirm'\]/);
  assert.match(runnerSource, /\.popBox button:has-text\('Confirm'\)/);
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
  assert.match(runnerSource, /waitForPromptMs = 0/);
  assert.match(runnerSource, /"arrival" : "departure"}_flight_entered/);
  assert.match(runnerSource, /waitForPromptMs > 0/);
  assert.match(runnerSource, /acknowledgeOfficialTravelLookupPrompt\(page, label, logs, executionContext, 15_000\)/);
  assert.match(runnerSource, /#popupAlert, #popupConfirm/);
  assert.match(runnerSource, /#confirm, \.pop-btn2/);
  assert.match(runnerSource, /waitFor\(\{ state: "hidden", timeout: 10_000 \}\)/);
  assert.match(runnerSource, /lookup prompt did not close/);
  assert.match(runnerSource, /lookup left an unexpected modal open/);
  assert.match(runnerSource, /visibleBodies\.length > 0/);
  assert.match(runnerSource, /kr_eac_control_click_failed/);
  assert.match(runnerSource, /const lookupDeadline = Date\.now\(\) \+ 8_000/);
  assert.match(runnerSource, /if \(promptAcknowledged \|\| observedCountry \|\| observedCity\) break/);
});

test("Korea review confirmation matches the current official popup markup", () => {
  assert.match(runnerSource, /"#popupConfirm", "#popupAlert"/);
  assert.match(runnerSource, /dialog\.locator\(/);
  assert.match(runnerSource, /#confirm, \.pop-btn2, button/);
  assert.match(runnerSource, /getAttribute\("value"\)\.catch\(\(\) => null\) \?\? ""/);
  assert.match(runnerSource, /\^\(\?:confirm\|ok\|확인\)\$/);
  assert.match(runnerSource, /const reviewPromptPattern =/);
  assert.match(runnerSource, /if \(await findVisibleVerificationCodeDialog\(page\)\) return/);
  assert.match(runnerSource, /reviewPromptPattern\.test\(remainingText\)/);
  assert.match(runnerSource, /kr_eac_review_confirmation_not_closed/);
});

test("Korea verification-code CAPTCHA is not misclassified as a review prompt", () => {
  assert.match(runnerSource, /async function findVisibleVerificationCodeDialog/);
  assert.match(runnerSource, /const captchaDialog = await findVisibleVerificationCodeDialog\(page\)/);
  assert.match(runnerSource, /verification\\s\+code\|verification code for security/);
  assert.match(runnerSource, /captchaDialog\.locator\("img, canvas"\)/);
  assert.match(runnerSource, /bounds\.width >= 60 && bounds\.height >= 20/);
  assert.match(runnerSource, /captchaContainer\.locator\(/);
  assert.match(runnerSource, /"button, a, span, \[onclick\]/);
  assert.match(runnerSource, /captchaContainer\.getByText\(\/\^\(\?:confirm\|verify\|ok\|확인\|인증\)\$\/iu\)/);
  assert.match(runnerSource, /\^\(\?:confirm\|verify\|ok\|확인\|인증\)\$/);
  assert.match(runnerSource, /check that all the information\|information you entered is correct/);
  assert.doesNotMatch(runnerSource, /if \(!\/correct\|confirm/);
});

test("Korea address search observes results without waiting on a phantom navigation", () => {
  assert.match(runnerSource, /function officialAddressSearchKeyword/);
  assert.match(runnerSource, /normalized\.split\(",", 1\)/);
  assert.match(runnerSource, /officialAddressSearchKeyword\(addressQuery\)/);
  assert.match(runnerSource, /search\.click\(\{ timeout: 20_000, noWaitAfter: true \}\)/);
  assert.match(runnerSource, /zipSearch\.click\(\{ timeout: 20_000, noWaitAfter: true \}\)/);
});

test("Korea address fallback paginates and requires a unique postal plus building match", () => {
  assert.match(runnerSource, /fn_egov_link_page\(\$\{pageNumber\}\)/);
  assert.match(runnerSource, /candidate\.postal === postalQuery/);
  assert.match(runnerSource, /leadingAddressNumber\(candidate\.address\) === savedBuildingNumber/);
  assert.match(runnerSource, /uniqueMatches\.length !== 1/);
});
