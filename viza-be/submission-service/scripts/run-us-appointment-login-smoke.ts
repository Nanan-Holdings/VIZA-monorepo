#!/usr/bin/env npx tsx
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse } from "dotenv";
import { resolve } from "node:path";
import {
  loadUSAppointmentRunnerConfig,
  SupabaseUSAppointmentRunnerRepository,
  validateUSAppointmentRunnerStart,
} from "../src/us-appointment";
import { PlaywrightUSVisaSchedulingPortalClient } from "../src/us-appointment/usvisascheduling-portal";
import { connectBrowserbaseCloudBrowser } from "../src/browserbase-session";

let phase = "configuration";

export function parseLoginSmokeArgs(argv: string[]): { applicationId: string; browserbase: boolean; credentialConfig: string | null } {
  const inline = argv.find((value) => value.startsWith("--application-id="));
  const index = argv.indexOf("--application-id");
  const applicationId = (inline?.slice("--application-id=".length) ?? (index >= 0 ? argv[index + 1] : "") ?? "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId)) {
    throw new Error("--application-id must identify the application authorized for this login test.");
  }
  const configInline = argv.find((value) => value.startsWith("--credential-config="));
  const configIndex = argv.indexOf("--credential-config");
  const credentialConfig = (configInline?.slice("--credential-config=".length)
    ?? (configIndex >= 0 ? argv[configIndex + 1] : "") ?? "").trim() || null;
  return { applicationId, browserbase: argv.includes("--browserbase"), credentialConfig };
}

async function main(): Promise<void> {
  const args = parseLoginSmokeArgs(process.argv.slice(2));
  if (args.credentialConfig) {
    // A local diagnostic may explicitly select the account writer's existing
    // key. Do not change any env file or the normal worker's global key.
    const key = parse(await readFile(resolve(args.credentialConfig))).SUBMISSION_RESULT_SECRET_KEY;
    if (!key || key.length < 16) throw new Error("SUBMISSION_RESULT_SECRET_KEY is missing in the selected credential config.");
    process.env.SUBMISSION_RESULT_SECRET_KEY = key;
  }
  if (args.browserbase) {
    process.env.US_APPOINTMENT_BROWSERBASE_ENABLED = "true";
    process.env.US_APPOINTMENT_BROWSERBASE_REGION ||= "us-east-1";
    process.env.US_APPOINTMENT_BROWSERBASE_COUNTRY ||= "US";
  }
  const config = loadUSAppointmentRunnerConfig();
  const configError = validateUSAppointmentRunnerStart(config);
  if (configError) throw new Error(configError);
  if (!config.playwrightEnabled) throw new Error("US_APPOINTMENT_PLAYWRIGHT_ENABLED=true is required.");
  // Diagnostic sessions never persist OAuth cookies or alter a pending job.
  config.playwrightStorageStatePath = null;
  phase = "job_lookup";
  const repository = new SupabaseUSAppointmentRunnerRepository();
  const job = await repository.getLatestJobForApplication(args.applicationId);
  if (!job || job.scheduling_provider !== "usvisascheduling" || job.applying_country_code !== "CN") {
    throw new Error("An existing China USVisaScheduling job is required.");
  }
  phase = "credential_read";
  const credentials = await repository.getAppointmentAccountCredentials(job);
  if (!credentials) throw new Error("The selected application has no usable saved official account credentials.");
  const directory = resolve("output/playwright/us-appointment-login", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(directory, { recursive: true });
  phase = "browser_session";
  const cloud = args.browserbase ? await connectBrowserbaseCloudBrowser({ prefix: "US_APPOINTMENT" }) : null;
  const client = new PlaywrightUSVisaSchedulingPortalClient(config, cloud ? { page: cloud.page } : {});
  try {
    phase = "official_login";
    const inspection = await client.inspectAccountSession(credentials);
    phase = "redacted_evidence";
    const visibleControls = cloud ? await cloud.page.locator("input, button, img, canvas").evaluateAll((elements) => elements
      .filter((element) => element.checkVisibility())
      .map((element) => ({ tag: element.tagName.toLowerCase(), id: element.id, type: element.getAttribute("type") }))
      .slice(0, 60)).catch(() => []) : [];
    const body = cloud ? await cloud.page.locator("body").innerText({ timeout: 3_000 }).catch(() => "") : "";
    const validationText = cloud ? (await cloud.page.locator(".error:visible, [role='alert']:visible, #claimVerificationServerError:visible, .validation-summary-errors:visible")
      .allTextContents().catch(() => [])).join(" ") : "";
    const diagnosticMarkers = {
      securityQuestions: /security question/i.test(body),
      validationMessagePresent: Boolean(validationText.trim()),
      invalidCredentials: /(?:username|password|credentials).{0,80}(?:incorrect|invalid)|(?:incorrect|invalid).{0,80}(?:username|password|credentials)/i.test(validationText),
      rejectedSecurityAnswers: /(?:answer|response).{0,80}(?:incorrect|invalid)|(?:incorrect|invalid).{0,80}(?:answer|response)/i.test(validationText),
      rejectedCaptcha: /captcha.{0,100}(?:incorrect|invalid|fail|error)|(?:incorrect|invalid|fail|error).{0,100}captcha/i.test(validationText),
      accountRestricted: /account.{0,60}(?:locked|suspended)|attempts.{0,40}(?:exceeded|limit)/i.test(validationText),
    };
    const screenshotPath = resolve(directory, "account-session-masked.png");
    await client.captureDebugScreenshot(screenshotPath);
    const report = {
      observedAt: new Date().toISOString(),
      status: inspection.state === "authenticated" && !inspection.gate ? "authenticated" : "checkpoint",
      ...inspection,
      visibleControls,
      diagnosticMarkers,
      screenshotPath,
      stopPoint: "Login inspection only; no registration, policy acceptance, profile submission, payment, or booking was performed.",
    };
    const reportPath = resolve(directory, "result.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
    if (report.status !== "authenticated") process.exitCode = 2;
  } catch (error) {
    const screenshotPath = resolve(directory, "failed-session-masked.png");
    const captured = await client.captureDebugScreenshot(screenshotPath).then(() => true).catch(() => false);
    if (captured) console.log(JSON.stringify({ status: "failure_evidence_saved", phase, screenshotPath }));
    throw error;
  } finally {
    try { await client.close(); } finally { await cloud?.browser.close().catch(() => undefined); }
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    // Playwright/CDP errors can embed credentials, OAuth URLs, or typed values.
    const message = error instanceof Error ? error.message : "";
    const code = /SUBMISSION_RESULT_SECRET_KEY/.test(message) ? "decryption_key_missing"
      : /authenticate data|cipher|decrypt/i.test(message) ? "stored_credentials_unreadable"
        : /Browserbase.*concurrency|rate limit/i.test(message) ? "browser_capacity_unavailable"
          : /Browserbase.*API key|account permissions/i.test(message) ? "browser_credentials_rejected"
            : /timeout/i.test(message) ? "operation_timed_out"
              : "inspection_failed";
    console.error(JSON.stringify({ status: "login_smoke_failed", phase, code, message: "US appointment login inspection failed; no account secrets are logged." }));
    process.exitCode = 1;
  });
}
