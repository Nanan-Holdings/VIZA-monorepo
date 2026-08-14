import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";

const TW_SRC_DIR = join(process.cwd(), "src", "tw");
const SRC_DIR = join(process.cwd(), "src");

async function readTwSource(file: string): Promise<string> {
  return readFile(join(TW_SRC_DIR, file), "utf8");
}

describe("Taiwan runner compliance boundary", () => {
  it("uses the shared CAPTCHA client and never persists solved CAPTCHA text", async () => {
    const [applySource, indexSource, captchaSource, haltRunnerSource] = await Promise.all([
      readTwSource("apply.ts"),
      readTwSource("index.ts"),
      readTwSource("captcha.ts"),
      readFile(join(SRC_DIR, "queue", "halt-runners.ts"), "utf8"),
    ]);
    const runtimeSource = `${applySource}\n${indexSource}\n${captchaSource}`;

    assert.match(captchaSource, /from "\.\.\/captcha"/);
    assert.match(captchaSource, /solveImageCaptcha/);
    assert.match(captchaSource, /reportBadCaptcha/);
    assert.match(indexSource, /solveTwCaptchaAndSubmitWithRetry/);
    assert.match(indexSource, /solveTwCaptchaForSubmitWithRetry/);
    assert.match(captchaSource, /solveAndFillTwCaptchaOnce/);
    assert.match(captchaSource, /clickTwFinalSubmit/);
    assert.match(applySource, /prepareSubmit:\s*\(\)\s*=>\s*solveTwCaptchaForSubmitWithRetry\(page\)/);
    assert.match(applySource, /submit:\s*\(\)\s*=>\s*solveTwCaptchaAndSubmitWithRetry\(page\)/);
    assert.equal(runtimeSource.includes("../captcha/two-captcha"), false);
    assert.match(haltRunnerSource, /text:\s*"\[redacted\]"/);
  });

  it("records the CAPTCHA boundary, solves it, submits, and closes the local session", async () => {
    const applySource = await readTwSource("apply.ts");

    assert.match(applySource, /runTwRepairSubmissionLoop/);
    assert.match(applySource, /collectTwOfficialValidationIssues\(page\)/);
    assert.match(applySource, /readReceipt:\s*\(\)\s*=>\s*readTwOfficialReceiptEvidence\(page\)/);
    assert.match(applySource, /"captcha_solved"/);
    assert.match(applySource, /"final_submit"/);
    assert.match(applySource, /"ready_to_submit"/);
    assert.match(applySource, /stopBeforeFinalSubmit/);
    assert.match(applySource, /status:\s*"submitted"/);
    assert.match(applySource, /finally\s*{[\s\S]*session\.close\(\)/);
  });

  it("canonical dispatch metadata exposes Taiwan as an automatic runner_job submit path", async () => {
    const [registrySource, dispatchSource, runnerSource] = await Promise.all([
      readFile(join(SRC_DIR, "country-submissions", "registry.ts"), "utf8"),
      readFile(join(SRC_DIR, "queue", "dispatch.ts"), "utf8"),
      readTwSource("runner.ts"),
    ]);

    const taiwanRegistryBlock = registrySource.slice(
      registrySource.indexOf('countryCode: "TW"'),
      registrySource.indexOf('countryCode: "KR"'),
    );
    assert.match(taiwanRegistryBlock, /realSubmitAvailable:\s*true/);
    assert.match(taiwanRegistryBlock, /routeStatus:\s*"runner_job_dispatched"/);
    assert.match(taiwanRegistryBlock, /fail-closed official receipt capture/);
    assert.doesNotMatch(taiwanRegistryBlock, /halting at the CAPTCHA/i);
    assert.match(dispatchSource, /taiwan:\s*\(a,\s*j\)\s*=>\s*runTaiwan\(a,\s*j\)/);
    assert.match(dispatchSource, /official receipt/);
    assert.match(runnerSource, /fillTwEntryPermitApplication/);
    assert.doesNotMatch(runnerSource, /stopped_at_captcha.*halted_before_pay/);
  });

  it("uses application email verification by default and gates official login only when a login page appears", async () => {
    const applySource = await readTwSource("apply.ts");
    const authSource = await readTwSource("auth.ts");
    const haltRunnerSource = await readFile(join(SRC_DIR, "queue", "halt-runners.ts"), "utf8");

    assert.match(authSource, /export interface TwOfficialLoginProvider/);
    assert.match(authSource, /export interface TwOfficialLoginOtpProvider/);
    assert.match(authSource, /createTwOfficialLoginOtpProviderFromEnvironment/);
    assert.match(authSource, /export interface TwEmailOtpProvider/);
    assert.match(authSource, /twFailClosedOfficialLoginProvider/);
    assert.doesNotMatch(authSource, /twNoopOfficialLoginProvider|status:\s*"skipped"|authorized_login_skipped/);
    assert.match(applySource, /maybeCompleteOfficialLoginIfPresent/);
    assert.match(applySource, /isTwOfficialLoginPage/);
    assert.match(applySource, /officialLoginProvider\.completeLogin\(page/);
    assert.match(applySource, /otpProvider:\s*officialLoginOtpProvider/);
    assert.match(applySource, /await clickEnterApplication\(page,\s*\{\s*allowEmailVerifyBoundary:\s*true\s*\}\)/);
    assert.ok(
      applySource.indexOf("await clickEnterApplication(page, { allowEmailVerifyBoundary: true })") <
        applySource.indexOf("await acceptTermsModal(page)"),
    );
    assert.match(applySource, /method:\s*"application_email_verification"/);
    assert.match(applySource, /otpProvider\.waitForEmailOtp/);
    assert.match(applySource, /email,\s*sentAfter,\s*timeoutMs/);
    assert.match(applySource, /email_verification:\s*"email"/);
    assert.match(applySource, /email_verification_code:\s*"verifyCode"/);
    assert.match(applySource, /fillTwVerificationEmail/);
    assert.match(applySource, /fillTwVerificationCode/);
    assert.match(applySource, /solveTwEmailCaptchaAndSendCodeWithRetry\(page,\s*\{\s*timeoutMs\s*\}\)/);
    assert.ok(
      applySource.indexOf("await fillTwVerificationEmail(page, email, audit)") <
        applySource.indexOf("solveTwEmailCaptchaAndSendCodeWithRetry(page"),
    );
    assert.ok(
      applySource.indexOf("solveTwEmailCaptchaAndSendCodeWithRetry(page") <
        applySource.indexOf("otpProvider.waitForEmailOtp"),
    );
    assert.match(haltRunnerSource, /officialLoginProvider:\s*createTwOfficialLoginProviderFromEnvironment\(\)/);
    assert.match(haltRunnerSource, /officialLoginOtpProvider:\s*createTwOfficialLoginOtpProviderFromEnvironment\(\)/);
    assert.match(haltRunnerSource, /twApplicationInboxAlias\(applicationId\)/);
    assert.match(haltRunnerSource, /"viza\.it\.com"/);
    assert.doesNotMatch(haltRunnerSource, /haggstorm\.com/);
  });

  it("keeps email CAPTCHA solving separate from final CAPTCHA submission", async () => {
    const [applySource, captchaSource] = await Promise.all([
      readTwSource("apply.ts"),
      readTwSource("captcha.ts"),
    ]);

    assert.match(captchaSource, /solveTwEmailCaptchaAndSendCodeWithRetry/);
    assert.match(captchaSource, /TW_EMAIL_CAPTCHA_BOUNDARY/);
    assert.match(captchaSource, /input\[name='captchaToken'\]/);
    assert.match(captchaSource, /sendButtonText:\s*"寄送驗證碼"/);
    assert.match(captchaSource, /reportBadCaptcha/);
    assert.match(captchaSource, /status:\s*"wrong_answer"/);
    assert.match(captchaSource, /status:\s*"sent",\s*solve/);
    assert.match(captchaSource, /if \(hasCaptcha\)/);
    assert.doesNotMatch(
      captchaSource.slice(
        captchaSource.indexOf("export async function solveTwEmailCaptchaAndSendCodeOnce"),
        captchaSource.indexOf("export async function solveTwCaptchaAndSubmitOnce"),
      ),
      /確認資料|submitButtonText|solveTwCaptchaAndSubmitWithRetry/,
    );
    assert.ok(
      applySource.indexOf("solveTwEmailCaptchaAndSendCodeWithRetry(page") <
        applySource.indexOf("otpProvider.waitForEmailOtp"),
    );
    assert.ok(
      applySource.indexOf("solveTwCaptchaAndSubmitWithRetry(page)") >
        applySource.indexOf("runTwRepairSubmissionLoop"),
    );
    assert.ok(
      captchaSource.indexOf("solveAndFillTwCaptchaOnce") <
        captchaSource.indexOf("clickTwFinalSubmit"),
    );
    assert.ok(
      captchaSource.indexOf("solveTwCaptchaForSubmitWithRetry") >
        captchaSource.indexOf("clickTwFinalSubmit"),
    );
  });

  it("persists only sanitized CAPTCHA-boundary metadata", async () => {
    const metadataSource = await readTwSource("run-metadata.ts");
    const diagnosticsSource = await readTwSource("diagnostics.ts");

    assert.match(metadataSource, /fieldVerification/);
    assert.match(metadataSource, /pageFingerprint/);
    assert.match(metadataSource, /urlPath/);
    assert.doesNotMatch(metadataSource, /inputValue|expectedValue|actualValue|cookie|storageState/i);
    assert.match(diagnosticsSource, /tryCaptureTwMaskedScreenshot/);
    assert.match(diagnosticsSource, /mask:\s*\[/);
  });

  it("guards Taiwan prepare with submitted and active-job state without legacy handoff blocking", async () => {
    const [haltRunnerSource, guardSource] = await Promise.all([
      readFile(join(SRC_DIR, "queue", "halt-runners.ts"), "utf8"),
      readTwSource("prepare-guard.ts"),
    ]);

    assert.match(haltRunnerSource, /prepareTwEntryPermitApplication\(applicationId, \{ currentJobId: jobId \}\)/);
    assert.match(haltRunnerSource, /\.eq\("application_id", applicationId\)/);
    assert.match(haltRunnerSource, /\.eq\("country", "taiwan"\)/);
    assert.match(haltRunnerSource, /TW_ACTIVE_RUNNER_JOB_STATUSES/);
    assert.match(guardSource, /result\?\.country === "TW" && result\.status === "submitted"/);
    assert.match(guardSource, /job\.id !== snapshot\.currentJobId/);
    assert.doesNotMatch(guardSource, /activeHandoffs|takeover_session|handoff/i);
    assert.doesNotMatch(guardSource, /stopped_at_captcha[^\n]+throw/);
  });

  it("requires both audited VIZA terms authorizations before canonical final submit", async () => {
    const [haltRunnerSource, consentSource, termsSource] = await Promise.all([
      readFile(join(SRC_DIR, "queue", "halt-runners.ts"), "utf8"),
      readTwSource("official-terms-consent.ts"),
      readTwSource("terms-modal.ts"),
    ]);

    assert.match(haltRunnerSource, /loadTwOfficialTermsConsent\(jobId, applicationId\)/);
    assert.match(haltRunnerSource, /mode:\s*"submit"/);
    assert.match(haltRunnerSource, /officialTermsConsent/);
    assert.match(consentSource, /entryPromptAccepted !== true/);
    assert.match(consentSource, /termsModalAccepted !== true/);
    assert.match(consentSource, /viza_final_confirmation/);
    assert.match(termsSource, /await ensureTermsCheckboxChecked/);
    assert.ok(
      termsSource.indexOf("await ensureTermsCheckboxChecked") <
        termsSource.indexOf("await okButton.click"),
    );
  });

  it("does not depend on the legacy Taiwan Browserbase applicant handoff runtime", async () => {
    const [sessionSource, indexSource, flyTemplate, secretSync] = await Promise.all([
      readTwSource("session.ts"),
      readTwSource("index.ts"),
      readFile(join(process.cwd(), "deploy", "fly", "fly.country.toml.template"), "utf8"),
      readFile(join(process.cwd(), "scripts", "fly", "sync-runtime-secrets.sh"), "utf8"),
    ]);

    assert.doesNotMatch(sessionSource, /applicantHandoff|handoffTimeoutSeconds|Browserbase/i);
    assert.doesNotMatch(indexSource, /registerTwApplicantHandoff|waitForTwApplicantSubmission/);
    assert.doesNotMatch(flyTemplate, /TW_ENTRY_PERMIT_BROWSERBASE|TW_ENTRY_PERMIT_HANDOFF/);
    const taiwanSecrets = secretSync.slice(
      secretSync.indexOf("taiwan)"),
      secretSync.indexOf("united_states)"),
    );
    assert.doesNotMatch(taiwanSecrets, /BROWSERBASE_API_KEY/);
    assert.match(taiwanSecrets, /TWOCAPTCHA_API_KEY/);
  });

  it("exposes a no-job formal pre-submit CLI without enabling runner pre-submit mode", async () => {
    const [scriptSource, haltRunnerSource] = await Promise.all([
      readFile(join(process.cwd(), "scripts", "run-tw-pre-submit-e2e.ts"), "utf8"),
      readFile(join(SRC_DIR, "queue", "halt-runners.ts"), "utf8"),
    ]);

    assert.match(scriptSource, /prepareTwEntryPermitApplication/);
    assert.match(scriptSource, /fillTwEntryPermitApplication/);
    assert.match(scriptSource, /stopBeforeFinalSubmit:\s*true/);
    assert.match(scriptSource, /new tw\.TwInboxEmailOtpProvider\(\{\s*markProcessed:\s*false\s*\}\)/);
    assert.doesNotMatch(scriptSource, /runner_job|writeSubmissionResult|insert\(/);
    assert.doesNotMatch(haltRunnerSource, /stopBeforeFinalSubmit:\s*true/);
  });
});
