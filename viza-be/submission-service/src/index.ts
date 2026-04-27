import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { chromium } from "@playwright/test";
import { supabase } from "./supabase";
import { sendFailureAlert } from "./alert";
import {
  personalInfoMappings,
  passportMappings,
  travelInfoMappings,
  documentUploadMappings,
  EVISA_PORTAL_URL,
  NEXT_BUTTON_SELECTOR,
  CONFIRMATION_NUMBER_SELECTOR,
  FormFieldMapping,
} from "./form-mappings";
import {
  DS160_PORTAL_URL,
  DS160_NEXT_SELECTOR,
  DS160_SAVE_SELECTOR,
  DS160_MAPPING_GROUPS,
} from "./ds160-form-mappings";
import {
  startCeacSession,
  createRecoveryTracker,
  recordBootstrapCheckpoint,
  preserveRecoveryOnFailure,
  buildFailureResult,
  serializeError,
  isGateError,
  orchestrateFill,
  isSuccessResult,
  handleConfirmApplicationPage,
  type CeacRunResult,
  type ConfirmApplicationResult,
} from "./ceac";
import { writeSubmissionResult, markSubmissionFailed } from "./result-writer";
import { decryptSecret, encryptSecret } from "./secret-cipher";
import type {
  FrSubmissionResult,
  UkSubmissionResult,
  UsSubmissionResult,
  VnSubmissionResult,
} from "./submission-result";
import {
  fillFranceVisasApplication,
  normalizeFvAnswers,
  buildAnswerMap,
  NormalizationError,
  type NormalizeInput,
} from "./france-visas";
import {
  startUkSession,
  orchestrateUkFill,
  isUkGateError,
  serializeUkError,
  resumeUkApplication,
} from "./uk";
import { fillVietnamApplication } from "./vietnam";
import {
  fillVisitor600Application,
  NationalityIneligibleError,
  MfaRequiredError,
  type AnswerMap as AuAnswerMap,
} from "./au-visitor";
import { generateTotp } from "./au-visitor/totp";
import { launchStealthBrowser } from "./ceac/stealth-browser";
import { uploadArtifact } from "./artifact-storage";
import {
  SubmissionQueueItem,
  ApplicantProfile,
  Application,
  ApplicationDocument,
  FvAccount,
  UkAccount,
  AuAccount,
  VisaApplicationAnswer,
} from "./types";
import type { AuSubmissionResult } from "./submission-result";

const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3;

// ─── Supabase data loaders ───────────────────────────────────────────────────

async function fetchPendingItems(): Promise<SubmissionQueueItem[]> {
  const { data, error } = await supabase
    .from("submission_queue")
    .select("*")
    .in("status", [
      "pending",
      "ds160_prefill_pending",
      "fv_prefill_pending",
      "uk_prefill_pending",
      "vn_prefill_pending",
      "au_prefill_pending",
    ])
    .lt("attempts", MAX_ATTEMPTS);

  if (error) throw new Error(`Failed to fetch submission_queue: ${error.message}`);
  return data ?? [];
}

function isDs160Job(item: SubmissionQueueItem): boolean {
  return item.status === "ds160_prefill_pending";
}

function isFvJob(item: SubmissionQueueItem): boolean {
  return item.status === "fv_prefill_pending";
}

function isUkJob(item: SubmissionQueueItem): boolean {
  return item.status === "uk_prefill_pending";
}

function isVnJob(item: SubmissionQueueItem): boolean {
  return item.status === "vn_prefill_pending";
}

function isAuJob(item: SubmissionQueueItem): boolean {
  return item.status === "au_prefill_pending";
}

async function markProcessing(queueId: string): Promise<void> {
  await supabase
    .from("submission_queue")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", queueId);
}

async function markDone(queueId: string): Promise<void> {
  await supabase
    .from("submission_queue")
    .update({ status: "done", updated_at: new Date().toISOString() })
    .eq("id", queueId);
}

async function incrementFailure(
  queueId: string,
  attempts: number,
  lastError: string
): Promise<void> {
  const newAttempts = attempts + 1;
  const newStatus = newAttempts >= MAX_ATTEMPTS ? "failed" : "pending";

  await supabase
    .from("submission_queue")
    .update({
      status: newStatus,
      attempts: newAttempts,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId);
}

async function loadApplicantData(applicationId: string): Promise<{
  profile: ApplicantProfile;
  application: Application;
  documents: ApplicationDocument[];
}> {
  const { data: application, error: appError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    throw new Error(`Application ${applicationId} not found: ${appError?.message}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("applicant_profiles")
    .select("*")
    .eq("id", application.applicant_id)
    .single();

  if (profileError || !profile) {
    throw new Error(`Applicant profile not found: ${profileError?.message}`);
  }

  const { data: documents, error: docsError } = await supabase
    .from("application_documents")
    .select("*")
    .eq("application_id", applicationId);

  if (docsError) {
    throw new Error(`Failed to load documents: ${docsError.message}`);
  }

  return { profile, application, documents: documents ?? [] };
}

async function updateApplicationSubmitted(
  applicationId: string,
  confirmationNumber: string
): Promise<void> {
  await supabase
    .from("applications")
    .update({
      status: "submitted",
      confirmation_number: confirmationNumber,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", applicationId);
}

// ─── Document downloader ─────────────────────────────────────────────────────

async function downloadDocuments(
  documents: ApplicationDocument[],
  tempDir: string
): Promise<Map<string, string>> {
  const localPaths = new Map<string, string>();

  for (const doc of documents) {
    if (!doc.storage_path) continue;

    const { data, error } = await supabase.storage
      .from("application-documents")
      .download(doc.storage_path);

    if (error || !data) {
      console.warn(`[download] Could not download ${doc.document_type}: ${error?.message}`);
      continue;
    }

    const fileName = doc.file_name ?? `${doc.document_type}.bin`;
    const localPath = path.join(tempDir, fileName);
    const buffer = Buffer.from(await data.arrayBuffer());
    fs.writeFileSync(localPath, buffer);
    localPaths.set(doc.document_type, localPath);
    console.log(`[download] ${doc.document_type} → ${localPath}`);
  }

  return localPaths;
}

// ─── Playwright form filler ──────────────────────────────────────────────────

async function fillField(
  page: import("@playwright/test").Page,
  mapping: FormFieldMapping,
  value: string | null
): Promise<void> {
  if (!value) return;

  const selectors = mapping.selector.split(",").map((s) => s.trim());
  let filled = false;

  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      const count = await el.count();
      if (count === 0) continue;

      if (mapping.type === "select") {
        await el.selectOption(value, { timeout: 5_000 });
      } else if (mapping.type === "date") {
        await el.fill(value, { timeout: 5_000 });
      } else {
        await el.fill(value, { timeout: 5_000 });
      }

      filled = true;
      break;
    } catch {
      // try next selector
    }
  }

  if (!filled) {
    console.warn(`[form] Could not fill field "${mapping.label}" — no matching selector`);
  }
}

async function uploadFile(
  page: import("@playwright/test").Page,
  mapping: FormFieldMapping,
  localPath: string
): Promise<void> {
  const selectors = mapping.selector.split(",").map((s) => s.trim());

  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      const count = await el.count();
      if (count === 0) continue;

      await el.setInputFiles(localPath, { timeout: 10_000 });
      console.log(`[form] Uploaded ${mapping.label}`);
      return;
    } catch {
      // try next selector
    }
  }

  console.warn(`[form] Could not upload "${mapping.label}" — no matching file input`);
}

async function submitApplication(
  profile: ApplicantProfile,
  application: Application,
  localDocPaths: Map<string, string>
): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log(`[playwright] Navigating to ${EVISA_PORTAL_URL}`);
    await page.goto(EVISA_PORTAL_URL, { waitUntil: "networkidle", timeout: 60_000 });

    // TODO: If portal requires account login/creation, add those steps here
    // e.g. await page.click('[href*="register"]'); await page.fill('#email', ...);

    // Step 1 — Personal info
    console.log("[playwright] Filling personal information");
    for (const [key, mapping] of Object.entries(personalInfoMappings)) {
      const value = profile[key as keyof ApplicantProfile] as string | null;
      await fillField(page, mapping, value);
    }
    await page.locator(NEXT_BUTTON_SELECTOR).first().click({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 });

    // Step 2 — Passport info
    console.log("[playwright] Filling passport information");
    for (const [key, mapping] of Object.entries(passportMappings)) {
      const value = profile[key as keyof ApplicantProfile] as string | null;
      await fillField(page, mapping, value);
    }
    await page.locator(NEXT_BUTTON_SELECTOR).first().click({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 });

    // Step 3 — Travel info
    console.log("[playwright] Filling travel information");
    for (const [key, mapping] of Object.entries(travelInfoMappings)) {
      const value = application[key as keyof Application] as string | null;
      await fillField(page, mapping, value);
    }
    await page.locator(NEXT_BUTTON_SELECTOR).first().click({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 });

    // Step 4 — Document uploads
    console.log("[playwright] Uploading documents");
    for (const [docType, mapping] of Object.entries(documentUploadMappings)) {
      const localPath = localDocPaths.get(docType);
      if (localPath) {
        await uploadFile(page, mapping, localPath);
      }
    }
    await page.locator(NEXT_BUTTON_SELECTOR).first().click({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 });

    // Final submit
    console.log("[playwright] Submitting final form");
    const submitBtn = page.locator('button[type="submit"], button:has-text("Submit Application"), button:has-text("Kirim")').first();
    await submitBtn.click({ timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 60_000 });

    // Extract confirmation number
    const confirmationEl = page.locator(CONFIRMATION_NUMBER_SELECTOR).first();
    let confirmationNumber = "PENDING";
    try {
      await confirmationEl.waitFor({ timeout: 15_000 });
      confirmationNumber = (await confirmationEl.textContent())?.trim() ?? "PENDING";
    } catch {
      console.warn("[playwright] Could not extract confirmation number from success page");
    }

    console.log(`[playwright] Submission successful — confirmation: ${confirmationNumber}`);
    return confirmationNumber;
  } finally {
    await browser.close();
  }
}

// ─── DS-160 Data Loaders ────────────────────────────────────────────────────

async function loadDs160Answers(applicationId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", applicationId);

  if (error) throw new Error(`Failed to load DS-160 answers: ${error.message}`);

  const answers: Record<string, string> = {};
  for (const row of (data ?? []) as VisaApplicationAnswer[]) {
    const value = row.value_json != null ? String(row.value_json) : row.value_text;
    if (value) answers[row.field_name] = value;
  }
  return answers;
}

// ─── DS-160 Playwright Prefill ──────────────────────────────────────────────

async function prefillDs160(
  answers: Record<string, string>,
  profile: ApplicantProfile
): Promise<{ applicationId: string; retrievalUrl: string; datFilePath: string }> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  try {
    console.log(`[ds160] Navigating to ${DS160_PORTAL_URL}`);
    await page.goto(DS160_PORTAL_URL, { waitUntil: "networkidle", timeout: 60_000 });

    // Fill form sections page by page
    for (const group of DS160_MAPPING_GROUPS) {
      console.log(`[ds160] Filling section: ${group.name}`);
      for (const [fieldName, mapping] of Object.entries(group.mappings)) {
        // Prefer answers from visa_application_answers; fall back to profile fields
        const value = answers[fieldName] ?? (profile as unknown as Record<string, unknown>)[fieldName] as string | null ?? null;
        if (!value) continue;

        await fillField(page, mapping, value);
      }

      // Navigate to next page
      try {
        const nextBtn = page.locator(DS160_NEXT_SELECTOR).first();
        const count = await nextBtn.count();
        if (count > 0) {
          await nextBtn.click({ timeout: 10_000 });
          await page.waitForLoadState("networkidle", { timeout: 30_000 });
        }
      } catch {
        console.warn(`[ds160] Could not navigate after ${group.name} section`);
      }
    }

    // Save the application (Save button triggers .dat download)
    console.log("[ds160] Saving application...");
    const saveBtn = page.locator(DS160_SAVE_SELECTOR).first();

    // Set up download listener before clicking save
    const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
    await saveBtn.click({ timeout: 10_000 });

    const download = await downloadPromise;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ds160-dat-"));
    const datFilePath = path.join(tempDir, download.suggestedFilename() || "ds160.dat");
    await download.saveAs(datFilePath);
    console.log(`[ds160] .dat file saved to: ${datFilePath}`);

    // Extract Application ID from the page
    let ds160AppId = "PENDING";
    try {
      const appIdEl = page.locator('[id*="ApplicationID"], [class*="applicationId"], text=/AA[0-9]+/').first();
      await appIdEl.waitFor({ timeout: 15_000 });
      ds160AppId = (await appIdEl.textContent())?.trim() ?? "PENDING";
      // Extract just the ID pattern if mixed with other text
      const match = ds160AppId.match(/AA\d{10}/);
      if (match) ds160AppId = match[0];
    } catch {
      console.warn("[ds160] Could not extract Application ID from page");
    }

    // Build retrieval URL
    const retrievalUrl = ds160AppId !== "PENDING"
      ? `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${ds160AppId}`
      : "";

    console.log(`[ds160] Application ID: ${ds160AppId}, Retrieval URL: ${retrievalUrl}`);

    return { applicationId: ds160AppId, retrievalUrl, datFilePath };
  } finally {
    await browser.close();
  }
}

// ─── DS-160 Storage Upload ──────────────────────────────────────────────────

async function uploadDs160Dat(
  datFilePath: string,
  applicationId: string,
  authUserId: string,
): Promise<string> {
  const storagePath = await uploadArtifact({
    authUserId,
    applicationId,
    country: "US",
    kind: "dat",
    ext: "dat",
    contentType: "application/octet-stream",
    filePath: datFilePath,
  });
  console.log(`[ds160] .dat uploaded to storage: ${storagePath}`);
  return storagePath;
}

async function updateDs160Metadata(
  dbApplicationId: string,
  ds160AppId: string,
  retrievalUrl: string,
  storagePath: string
): Promise<void> {
  await supabase
    .from("applications")
    .update({
      ds160_application_id: ds160AppId,
      ds160_retrieval_url: retrievalUrl,
      ds160_dat_storage_path: storagePath,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dbApplicationId);
}

// ─── DS-160 Job Processor (CEAC runtime pipeline) ──────────────────────────

async function processDs160Item(item: SubmissionQueueItem): Promise<void> {
  const runId = `ds160-${item.application_id}-${Date.now()}`;
  console.log(`[ceac] Starting CEAC run ${runId} for ${item.application_id} (attempt ${item.attempts + 1})`);

  await supabase
    .from("submission_queue")
    .update({ status: "ds160_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ceac-run-"));
  let session: Awaited<ReturnType<typeof startCeacSession>> | null = null;

  const tracker = createRecoveryTracker({ runId });

  try {
    session = await startCeacSession({
      headless: true,
      acceptDownloads: true,
      runId,
    });
    // Record bootstrap checkpoint — proves CEAC start page was reached
    await recordBootstrapCheckpoint(session.page, { sink: tracker, runId });

    // Load applicant data and answers for form filling
    const { profile } = await loadApplicantData(item.application_id);
    const answers = await loadDs160Answers(item.application_id);

    // Confirm-application page (Privacy Act ack + Application ID + security
    // question). Captures `applicationId` + `securityQuestionText` +
    // `securityAnswer` — the trio the applicant needs to retrieve their
    // DS-160 from ceac.state.gov later. The security answer is sourced from
    // the applicant's own data so it's deterministic on retry; falls back to
    // a runner constant only when no source is present.
    const securityAnswerSource =
      answers["ds160_security_answer"] ??
      answers["mother_surname"] ??
      "VIZAREDOC";
    const confirm: ConfirmApplicationResult = await handleConfirmApplicationPage(
      session.page,
      {
        securityAnswer: securityAnswerSource,
        // Question 3 = "What is your maternal grandmother's maiden name?" —
        // the most deterministically answerable from applicant-provided data.
        securityQuestionValue: "3",
      },
    );
    console.log(
      `[ceac] confirm-application captured appId=${confirm.applicationId} q="${confirm.securityQuestionText}"`,
    );

    // Recovery credentials so a mid-fill SessionTimedOut triggers auto-resume
    // (CEAC's session is ~10min idle window). Required by orchestrateFill's
    // contract for any run that may exceed the window.
    const surnameFirstFive = (answers["surname"] ?? profile.full_name?.split(" ").slice(-1)[0] ?? "")
      .replace(/[^A-Za-z]/g, "")
      .slice(0, 5)
      .toUpperCase();
    const yearOfBirth =
      answers["date_of_birth_year"] ??
      (profile.date_of_birth ? profile.date_of_birth.split("-")[0] : "") ??
      "";

    // Drive page-by-page fill through CEAC navigation/checkpoint helpers.
    // orchestrateFill handles: field filling, page advancement, section
    // checkpoints, .dat capture, and stop-at-sign-and-submit.
    const { result, datArtifact, sectionCoverage } = await orchestrateFill(session, {
      answers,
      profile: profile as unknown as Record<string, unknown>,
      tracker,
      runId,
      outputDir: tempDir,
      recoveryCredentials: {
        applicationId: confirm.applicationId,
        surnameFirstFive,
        yearOfBirth,
        securityAnswer: confirm.securityAnswer,
      },
    });

    // Upload .dat artifact to Supabase Storage if captured. The path is
    // user-prefixed for RLS — fall back to applicantId if the profile has
    // no auth_user_id (legacy rows from before Supabase Auth was wired).
    let storagePath = "";
    if (datArtifact) {
      const ownerId = profile.auth_user_id ?? profile.id;
      storagePath = await uploadDs160Dat(datArtifact.path, item.application_id, ownerId);
    }

    // Persist Application ID and .dat metadata
    if (result.applicationId) {
      const retrievalUrl = `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${result.applicationId}`;
      await updateDs160Metadata(item.application_id, result.applicationId, retrievalUrl, storagePath);
    }

    // Capture CAPTCHA solve telemetry from session bootstrap (if a CAPTCHA was solved)
    const captchaTelemetry = session.captchaSolve
      ? { captchaSolve: session.captchaSolve.telemetry }
      : {};

    if (isSuccessResult(result)) {
      // Handoff-ready: form filled up to Sign and Submit page.
      // Persist full CEAC result payload for operator diagnostics.
      await supabase
        .from("submission_queue")
        .update({
          status: "ds160_prefilled",
          ceac_result_payload: { ...result, sectionCoverage, ...captchaTelemetry } as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // Write the user-facing UsSubmissionResult to applications so the
      // frontend's realtime subscription can swap StatusStep to UsResultCard.
      // embassyOrConsulate is sourced from form answers; falls back to a
      // pending-confirmation message when the applicant didn't pick a post
      // server-side (CEAC will require it at retrieval time anyway).
      const usPayload: UsSubmissionResult = {
        country: "US",
        status: "stopped_at_sign",
        applicationId: result.applicationId ?? confirm.applicationId,
        surnameFirst5: surnameFirstFive,
        yearOfBirth: Number(yearOfBirth) || 0,
        securityQuestion: confirm.securityQuestionText,
        securityAnswer: confirm.securityAnswer,
        embassyOrConsulate:
          answers["consular_post"] ??
          answers["embassy_or_consulate"] ??
          answers["location_where_applying_for_visa"] ??
          "Pending — confirm at appointment",
        retrievalUrl: `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${result.applicationId ?? confirm.applicationId}`,
        ...(storagePath ? { datStoragePath: storagePath } : {}),
      };
      await writeSubmissionResult(item.application_id, usPayload, "submitted");

      console.log(`[ceac] Run ${runId} handoff_ready for ${item.application_id}`);
    } else {
      // Orchestrator caught an error internally but preserved recovery state.
      // Persist the failure result payload so ops can inspect recovery metadata.
      const errorMsg = result.error?.message as string ?? "Unknown orchestration error";
      console.error(`[ceac] Run ${runId} orchestration failed for ${item.application_id}:`, errorMsg);

      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? "ds160_prefill_failed" : "ds160_prefill_pending";

      await supabase
        .from("submission_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_error: errorMsg,
          ceac_result_payload: { ...result, sectionCoverage, ...captchaTelemetry } as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (newAttempts >= MAX_ATTEMPTS) {
        await markSubmissionFailed(item.application_id, errorMsg);
        await sendFailureAlert(item.application_id, `[CEAC] ${errorMsg}`);
      }
    }
  } catch (err) {
    const recovery = session
      ? await preserveRecoveryOnFailure({
          tracker,
          error: err,
          page: session.page,
          screenshotDir: tempDir,
        })
      : {
          ...tracker.snapshot(),
          failureScreenshot: null,
        };

    const result: CeacRunResult = buildFailureResult(recovery, {
      error: serializeError(err),
      failureScreenshot: recovery.failureScreenshot,
    });

    const errorMsg = err instanceof Error ? err.message : String(err);
    const exceptionCaptchaTelemetry = session?.captchaSolve
      ? { captchaSolve: session.captchaSolve.telemetry }
      : {};

    // Gate errors (anti-bot, captcha, manual intervention) are external CEAC
    // blockers — retrying won't help. Mark as blocked immediately with
    // operator-facing context and alert.
    if (isGateError(err)) {
      console.error(`[ceac] Run ${runId} GATED for ${item.application_id}:`, errorMsg);

      // Persist Application ID if captured before gate
      if (result.applicationId) {
        const retrievalUrl = `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${result.applicationId}`;
        await updateDs160Metadata(item.application_id, result.applicationId, retrievalUrl, "");
      }

      await supabase
        .from("submission_queue")
        .update({
          status: "ds160_blocked",
          last_error: `[CEAC gate: ${err.context.details?.gateKind ?? "unknown"}] ${errorMsg}`,
          ceac_result_payload: {
            ...result as unknown as Record<string, unknown>,
            gateContext: err.context,
            ...exceptionCaptchaTelemetry,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await markSubmissionFailed(item.application_id, `[CEAC gate] ${errorMsg}`);
      await sendFailureAlert(
        item.application_id,
        `[CEAC gate detected] ${errorMsg}`,
      );
    } else {
      // Genuine worker/runtime failure — standard retry logic
      console.error(`[ceac] Run ${runId} failed for ${item.application_id}:`, errorMsg);

      // Persist Application ID if captured before failure
      if (result.applicationId) {
        const retrievalUrl = `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${result.applicationId}`;
        await updateDs160Metadata(item.application_id, result.applicationId, retrievalUrl, "");
      }

      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? "ds160_prefill_failed" : "ds160_prefill_pending";

      await supabase
        .from("submission_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_error: errorMsg,
          ceac_result_payload: { ...result as unknown as Record<string, unknown>, ...exceptionCaptchaTelemetry },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (newAttempts >= MAX_ATTEMPTS) {
        console.error(`[ceac] Max attempts reached for ${item.application_id} — sending alert`);
        await markSubmissionFailed(item.application_id, errorMsg);
        await sendFailureAlert(item.application_id, `[CEAC] ${errorMsg}`);
      }
    }
  } finally {
    if (session) await session.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup */ }
  }
}

// ─── France-Visas autofill ──────────────────────────────────────────────────

async function loadFvAccount(applicantId: string): Promise<FvAccount | null> {
  const { data, error } = await supabase
    .from("fv_accounts")
    .select("*")
    .eq("applicant_id", applicantId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load fv_accounts: ${error.message}`);
  return (data ?? null) as FvAccount | null;
}

async function loadRawAnswers(applicationId: string): Promise<VisaApplicationAnswer[]> {
  const { data, error } = await supabase
    .from("visa_application_answers")
    .select("field_name, value_text, value_json")
    .eq("application_id", applicationId);
  if (error) throw new Error(`Failed to load answers: ${error.message}`);
  return (data ?? []) as VisaApplicationAnswer[];
}

/**
 * Decrypt a stored FV password. Production deployments MUST replace this
 * with a real decrypt against the project's KMS/secrets backend.
 * The `fv_accounts.password_encrypted` column is declared TEXT so encrypted
 * blobs can live there once crypto is wired; for now we treat the column
 * as plain text for dev parity with the smoke runner's env-var flow.
 */
function decryptFvPassword(encrypted: string): string {
  // TODO(crypto): hook into shared KMS helper before production.
  return encrypted;
}

async function processFvItem(item: SubmissionQueueItem): Promise<void> {
  const runId = `fv-${item.application_id}-${Date.now()}`;
  console.log(`[fv] Starting run ${runId} for ${item.application_id} (attempt ${item.attempts + 1})`);

  await supabase
    .from("submission_queue")
    .update({ status: "fv_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);

  try {
    const { profile, application } = await loadApplicantData(item.application_id);

    const account = await loadFvAccount(application.applicant_id);
    if (!account) {
      throw new Error(`No fv_accounts row for applicant ${application.applicant_id} — register first`);
    }

    const rawAnswers = await loadRawAnswers(item.application_id);
    const answerMap = buildAnswerMap(rawAnswers);

    // FV-specific overrides that the seed schema doesn't carry — the frontend
    // writes them into visa_application_answers with `fv_` prefixed keys.
    const normalizeInput: NormalizeInput = {
      answers: answerMap,
      profile,
      application,
      fvOverrides: {
        depositCountry: requireAnswer(answerMap, "fv_deposit_country"),
        depositTown: requireAnswer(answerMap, "fv_deposit_town"),
        authority: answerMap.fv_authority ?? undefined,
        destination: answerMap.fv_destination ?? undefined,
        purpose: requireAnswer(answerMap, "fv_purpose"),
        occupationCode: answerMap.fv_occupation_code ?? undefined,
        businessSegment: answerMap.fv_business_segment ?? undefined,
      },
    };

    const answers = normalizeFvAnswers(normalizeInput);
    const result = await fillFranceVisasApplication(
      {
        credentials: {
          email: account.email,
          password: decryptFvPassword(account.password_encrypted),
        },
        answers,
      },
      { headless: true, runId },
    );

    if (result.status === "prefilled") {
      // Upload the downloaded CERFA PDF (if present) to the
      // submission-artifacts bucket. The autofiller saves to a temp path
      // locally; we move it to durable storage so the applicant can fetch
      // it via signed URL minted by the agent-backend artifact-url route.
      let pdfStoragePath: string | null = null;
      if (result.pdfPath && fs.existsSync(result.pdfPath)) {
        try {
          const ownerId = profile.auth_user_id ?? profile.id;
          pdfStoragePath = await uploadArtifact({
            authUserId: ownerId,
            applicationId: item.application_id,
            country: "FR",
            kind: "cerfa",
            ext: "pdf",
            contentType: "application/pdf",
            filePath: result.pdfPath,
          });
          // Best-effort cleanup of the local temp file.
          try { fs.unlinkSync(result.pdfPath); } catch { /* ignore */ }
        } catch (uploadEx) {
          const msg = uploadEx instanceof Error ? uploadEx.message : String(uploadEx);
          console.warn(`[fv] PDF upload failed for ${item.application_id}: ${msg}`);
          pdfStoragePath = null;
        }
      }

      await supabase
        .from("submission_queue")
        .update({
          status: "fv_prefilled",
          fv_result_payload: result as unknown as Record<string, unknown>,
          fv_application_reference: result.applicationReference,
          fv_pdf_storage_path: pdfStoragePath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      // User-facing FrSubmissionResult. France-Visas requires payment to
      // lock an actual appointment slot, so we surface `stopped_at_pay`
      // with the application reference + downloadable summary PDF — the
      // applicant still needs to book/pay externally on connect.france-visas.gouv.fr.
      // The `appointment` field stays absent until the appointment-booking
      // runner extension lands.
      const frPayload: FrSubmissionResult = {
        country: "FR",
        status: "stopped_at_pay",
        applicationReference: result.applicationReference ?? result.draftReference ?? "",
        ...(pdfStoragePath ? { printablePdfStoragePath: pdfStoragePath } : {}),
      };
      await writeSubmissionResult(item.application_id, frPayload, "stopped_at_pay");
      console.log(`[fv] Run ${runId} prefilled — ref=${result.applicationReference ?? "(none)"}, pdf=${pdfStoragePath ?? "(none)"}`);
    } else {
      const errorMsg = typeof result.error?.message === "string"
        ? result.error.message
        : `failed at ${result.failedStep}`;
      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? "fv_prefill_failed" : "fv_prefill_pending";

      await supabase
        .from("submission_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_error: errorMsg,
          fv_result_payload: result as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (newAttempts >= MAX_ATTEMPTS) {
        await markSubmissionFailed(item.application_id, errorMsg);
        await sendFailureAlert(item.application_id, `[FV] ${errorMsg}`);
      }
      console.error(`[fv] Run ${runId} failed at ${result.failedStep}: ${errorMsg}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isNormalizationFailure = err instanceof NormalizationError;
    const newAttempts = item.attempts + 1;
    // Normalization failures are data errors — don't burn retries on them.
    const newStatus = isNormalizationFailure
      ? "fv_prefill_failed"
      : (newAttempts >= MAX_ATTEMPTS ? "fv_prefill_failed" : "fv_prefill_pending");

    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (newStatus === "fv_prefill_failed") {
      await markSubmissionFailed(item.application_id, errorMsg);
      await sendFailureAlert(item.application_id, `[FV] ${errorMsg}`);
    }
    console.error(`[fv] Unhandled error in ${runId}:`, errorMsg);
  }
}

// ─── UK Standard Visitor Job Processor ───────────────────────────────
//
// Two paths:
//   1. RESUME (preferred): if a uk_accounts row exists for the applicant,
//      walk the in-flight application via forceResume URL → 44 application
//      pages → Documents → Declaration → halt at Pay. Writes a full
//      UkSubmissionResult on success.
//   2. PRE-AUTH SCAFFOLD: if no uk_accounts row, drive the pre-auth flow
//      (language → country → VAC → start) and stop at the registration
//      page. Caller / human registers, persists creds back to uk_accounts,
//      and the next poll picks up the resume path.
async function loadUkAccount(applicantId: string): Promise<UkAccount | null> {
  const { data, error } = await supabase
    .from("uk_accounts")
    .select("*")
    .eq("applicant_id", applicantId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load uk_accounts: ${error.message}`);
  return (data ?? null) as UkAccount | null;
}

function decryptUkPassword(encrypted: string): string {
  // Try the project cipher first; if the column is still plaintext (dev
  // parity), pass it through unchanged. Production rows are encrypted.
  try {
    return decryptSecret(encrypted);
  } catch {
    return encrypted;
  }
}

async function processUkItem(item: SubmissionQueueItem): Promise<void> {
  const runId = `uk-${item.application_id}-${Date.now()}`;
  console.log(`[uk] Starting run ${runId} for ${item.application_id} (attempt ${item.attempts + 1})`);

  await supabase
    .from("submission_queue")
    .update({ status: "uk_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);

  const { profile, application } = await loadApplicantData(item.application_id);
  let account = await loadUkAccount(application.applicant_id);

  // Lazy-upsert from /application answers: the seed exposes step-0 fields
  // uk_account_email / uk_account_password / uk_resume_url. The applicant
  // fills them on the form; the worker materializes them into uk_accounts
  // on first run so subsequent polls take the resume path automatically.
  if (!account) {
    const ukAnswers = await loadDs160Answers(item.application_id);
    const email = ukAnswers["uk_account_email"];
    const password = ukAnswers["uk_account_password"];
    const resumeUrl = ukAnswers["uk_resume_url"];
    if (email && password && resumeUrl) {
      const passwordEncrypted = encryptSecret(password);
      const { error: upsertErr } = await supabase
        .from("uk_accounts")
        .upsert(
          {
            applicant_id: application.applicant_id,
            email,
            password_encrypted: passwordEncrypted,
            resume_url: resumeUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "applicant_id,email" },
        );
      if (upsertErr) {
        console.warn(`[uk] uk_accounts upsert failed: ${upsertErr.message}`);
      } else {
        account = await loadUkAccount(application.applicant_id);
      }
    }
  }

  // ── RESUME path ────────────────────────────────────────────────────
  if (account) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uk-resume-"));
    try {
      const answers = await loadDs160Answers(item.application_id);
      const result = await resumeUkApplication(
        {
          resumeUrl: account.resume_url,
          password: decryptUkPassword(account.password_encrypted),
          email: account.email,
          answers,
        },
        { headless: true, runId, outputDir: tempDir },
      );

      if (result.status === "stopped_at_pay" || result.status === "halted_before_pay") {
        const ukPayload: UkSubmissionResult = {
          country: "UK",
          status: "stopped_at_pay",
          portalUrl: result.portalUrl,
          portalUsername: result.portalUsername,
          generatedPasswordCipher: encryptSecret(decryptUkPassword(account.password_encrypted)),
          ...(result.status === "stopped_at_pay" && result.applicationReference
            ? { applicationReference: result.applicationReference }
            : {}),
        };
        await writeSubmissionResult(item.application_id, ukPayload, "stopped_at_pay");
        await supabase
          .from("submission_queue")
          .update({
            status: "uk_prefilled",
            uk_result_payload: result as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        console.log(
          `[uk] Resume run ${runId} ${result.status} — pages filled=${result.pagesFilled.length}`,
        );
        return;
      }

      // result.status === "failed"
      const errorMsg = typeof result.error?.message === "string" ? result.error.message : `failed at ${result.failedAt}`;
      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? "uk_prefill_failed" : "uk_prefill_pending";
      await supabase
        .from("submission_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_error: errorMsg,
          uk_result_payload: result as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (newStatus === "uk_prefill_failed") {
        await markSubmissionFailed(item.application_id, errorMsg);
        await sendFailureAlert(item.application_id, `[UK resume] ${errorMsg}`);
      }
      console.error(`[uk] Resume run ${runId} failed: ${errorMsg}`);
      return;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? "uk_prefill_failed" : "uk_prefill_pending";
      await supabase
        .from("submission_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_error: errorMsg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (newStatus === "uk_prefill_failed") {
        await markSubmissionFailed(item.application_id, errorMsg);
        await sendFailureAlert(item.application_id, `[UK resume] ${errorMsg}`);
      }
      console.error(`[uk] Resume run ${runId} unhandled error:`, errorMsg);
      return;
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  // ── PRE-AUTH SCAFFOLD path (fallback when no uk_accounts row) ──────
  void profile; // silence unused-var
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uk-run-"));
  let session: Awaited<ReturnType<typeof startUkSession>> | null = null;
  try {
    const answers = await loadDs160Answers(item.application_id);
    session = await startUkSession({ headless: true, runId });
    const result = await orchestrateUkFill(session, {
      answers,
      runId,
      outputDir: tempDir,
    });

    // Pre-auth scaffold-only success: reached registration page. We mark
    // as `uk_prefilled` so ops can see the run completed its current
    // scope, but the payload's `handoffReady=false` and `reason` make
    // clear there's more to do.
    await supabase
      .from("submission_queue")
      .update({
        status: "uk_prefilled",
        uk_result_payload: result as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (result.handoffReady) {
      // Post-auth runner extension landed: capture portal credentials and
      // surface to user. Encrypts the password before persisting; FE asks
      // the agent-backend credentials endpoint for the plaintext on demand.
      const portalUrl = process.env.UK_PORTAL_RESUME_URL ?? "";
      const portalUsername = process.env.UK_PORTAL_USERNAME ?? "";
      const portalPassword = process.env.UK_PORTAL_PASSWORD ?? "";
      if (portalUrl && portalUsername && portalPassword) {
        const ukPayload: UkSubmissionResult = {
          country: "UK",
          status: "stopped_at_pay",
          portalUrl,
          portalUsername,
          generatedPasswordCipher: encryptSecret(portalPassword),
        };
        await writeSubmissionResult(item.application_id, ukPayload, "stopped_at_pay");
      } else {
        console.warn(
          `[uk] handoffReady=true but UK_PORTAL_* env not set — skipping submission_result write`,
        );
      }
    } else {
      console.log(
        `[uk] Run ${runId} stopped at ${result.stoppedAt.id} (pre-auth scaffold) — submission_result not written until walk extension lands`,
      );
    }
    console.log(`[uk] Run ${runId} stopped at ${result.stoppedAt.id} — ${result.reason}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorPayload = serializeUkError(err);
    const newAttempts = item.attempts + 1;

    // Gate errors (maintenance / 5xx / rate-limit) are external UKVI
    // blockers — retrying within the worker won't help. Mark as
    // blocked immediately and alert, mirroring the CEAC pattern.
    if (isUkGateError(err)) {
      await supabase
        .from("submission_queue")
        .update({
          status: "uk_blocked",
          last_error: `[UK gate] ${errorMsg}`,
          uk_result_payload: errorPayload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      await markSubmissionFailed(item.application_id, `[UK gate] ${errorMsg}`);
      await sendFailureAlert(item.application_id, `[UK gate] ${errorMsg}`);
      console.error(`[uk] Run ${runId} GATED:`, errorMsg);
      return;
    }

    const newStatus = newAttempts >= MAX_ATTEMPTS ? "uk_prefill_failed" : "uk_prefill_pending";
    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        uk_result_payload: errorPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (newStatus === "uk_prefill_failed") {
      await markSubmissionFailed(item.application_id, errorMsg);
      await sendFailureAlert(item.application_id, `[UK] ${errorMsg}`);
    }
    console.error(`[uk] Run ${runId} failed:`, errorMsg);
  } finally {
    if (session) await session.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup */ }
  }
}

// ─── Vietnam e-Visa Job Processor ────────────────────────────────────
//
// Today: navigates to evisa.gov.vn landing page and stops with
// `scaffolded_pending_walk`. The per-step fill implementation depends on
// the recon walk (vietnam/form-recon-v3.ts output). When that lands and
// fillVietnamApplication starts returning `submitted_pending_pay`, the
// success branch below writes a VnSubmissionResult.
async function processVnItem(item: SubmissionQueueItem): Promise<void> {
  const runId = `vn-${item.application_id}-${Date.now()}`;
  console.log(`[vn] Starting run ${runId} for ${item.application_id} (attempt ${item.attempts + 1})`);

  await supabase
    .from("submission_queue")
    .update({ status: "vn_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);

  try {
    const answers = await loadDs160Answers(item.application_id);
    const result = await fillVietnamApplication({ answers }, { headless: true, runId });

    if (result.status === "submitted_pending_pay") {
      const vnPayload: VnSubmissionResult = {
        country: "VN",
        status: "submitted_pending_email",
        registrationCode: result.registrationCode,
        submittedAtIso: result.submittedAtIso,
        noticeText: "Your e-visa PDF will be emailed within ~3 working days.",
      };
      await writeSubmissionResult(item.application_id, vnPayload, "stopped_at_pay");
      await supabase
        .from("submission_queue")
        .update({
          status: "vn_prefilled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      console.log(`[vn] Run ${runId} prefilled — registrationCode=${result.registrationCode}`);
      return;
    }

    if (result.status === "scaffolded_pending_walk") {
      // Scaffold reached but per-step fill not yet implemented. Mark
      // queue row done so the scheduler doesn't loop, but don't write
      // submission_result — the FE keeps showing WaitingCard until the
      // real runner extension lands.
      await supabase
        .from("submission_queue")
        .update({
          status: "vn_blocked",
          last_error: "Vietnam runner scaffold-only. Per-step fill pending recon walk integration.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      console.log(`[vn] Run ${runId} stopped at scaffold: ${result.reason}`);
      return;
    }

    // status === "failed"
    const errorMsg = typeof result.error?.message === "string" ? result.error.message : `failed at ${result.failedStep}`;
    const newAttempts = item.attempts + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? "vn_prefill_failed" : "vn_prefill_pending";
    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (newStatus === "vn_prefill_failed") {
      await markSubmissionFailed(item.application_id, errorMsg);
      await sendFailureAlert(item.application_id, `[VN] ${errorMsg}`);
    }
    console.error(`[vn] Run ${runId} failed at ${result.failedStep}: ${errorMsg}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newAttempts = item.attempts + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? "vn_prefill_failed" : "vn_prefill_pending";
    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (newStatus === "vn_prefill_failed") {
      await markSubmissionFailed(item.application_id, errorMsg);
      await sendFailureAlert(item.application_id, `[VN] ${errorMsg}`);
    }
    console.error(`[vn] Unhandled error in ${runId}:`, errorMsg);
  }
}

async function loadAuAccount(applicantId: string): Promise<AuAccount | null> {
  const { data, error } = await supabase
    .from("au_accounts")
    .select("*")
    .eq("applicant_id", applicantId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load au_accounts: ${error.message}`);
  return (data ?? null) as AuAccount | null;
}

function decryptAuSecret(encrypted: string): string {
  // Try the project cipher first; if the column is still plaintext (dev
  // parity), pass it through unchanged. Production rows are encrypted.
  try {
    return decryptSecret(encrypted);
  } catch {
    return encrypted;
  }
}

// ─── AU Subclass 600 Job Processor ───────────────────────────────────
//
// Walks the 20-page VSS-AP-600 form via the au-visitor runner, then
// halts on the Review page. Persists an AuSubmissionResult with status
// `stopped_at_review` so the user is the one who actually clicks Submit
// inside ImmiAccount — Subclass 600 lodgement legally requires the
// applicant's own action; VIZA cannot finalise on their behalf.
async function processAuItem(item: SubmissionQueueItem): Promise<void> {
  const runId = `au-${item.application_id}-${Date.now()}`;
  console.log(`[au] Starting run ${runId} for ${item.application_id} (attempt ${item.attempts + 1})`);

  await supabase
    .from("submission_queue")
    .update({ status: "au_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "au-run-"));
  let handles: Awaited<ReturnType<typeof launchStealthBrowser>> | null = null;

  try {
    const { profile, application } = await loadApplicantData(item.application_id);
    const answers = await loadDs160Answers(item.application_id);

    // Prefer au_accounts row; lazy-upsert from step-0 answer fields if
    // the applicant filled them but the row hasn't been materialized yet
    // (mirrors the UK uk_accounts lazy-upsert pattern).
    let account = await loadAuAccount(application.applicant_id);
    if (!account) {
      const username = answers["au_immi_username"];
      const password = answers["au_immi_password"];
      const totpSecret = answers["au_immi_totp_secret"];
      const resumeTrnFromAnswers = answers["au_resume_trn"];
      if (username && password) {
        const passwordEncrypted = encryptSecret(password);
        const totpEncrypted = totpSecret ? encryptSecret(totpSecret) : null;
        const { error: upsertErr } = await supabase
          .from("au_accounts")
          .upsert(
            {
              applicant_id: application.applicant_id,
              username,
              password_encrypted: passwordEncrypted,
              totp_secret_encrypted: totpEncrypted,
              resume_trn: resumeTrnFromAnswers || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "applicant_id,username" },
          );
        if (upsertErr) {
          console.warn(`[au] au_accounts upsert failed: ${upsertErr.message}`);
        } else {
          account = await loadAuAccount(application.applicant_id);
        }
      }
    }

    if (!account) {
      throw new Error(
        "No au_accounts row and no au_immi_username/au_immi_password in answers — applicant must register an ImmiAccount and persist credentials before submission.",
      );
    }

    const username = account.username;
    const password = decryptAuSecret(account.password_encrypted);
    const totpSecret = account.totp_secret_encrypted
      ? decryptAuSecret(account.totp_secret_encrypted)
      : undefined;
    const resumeTrn = account.resume_trn ?? answers["au_resume_trn"] ?? null;

    handles = await launchStealthBrowser({ headless: true, acceptDownloads: true });

    const result = await fillVisitor600Application({
      context: handles.context,
      credentials: {
        username,
        password,
        mfaCodeProvider: totpSecret
          ? async () => generateTotp(totpSecret)
          : undefined,
      },
      answers: answers as AuAnswerMap,
      resumeTrn,
      options: {},
    });

    if (result.outcome === "review_reached" && result.result) {
      const trn = result.result.trn ?? resumeTrn ?? "";
      const portalUrl = "https://online.immi.gov.au/ola/app";

      // Capture the Review page so the user can verify what was filled
      // before they hit Submit themselves.
      let screenshotStoragePath: string | undefined;
      try {
        const pages = handles.context.pages();
        const activePage = pages[pages.length - 1];
        if (activePage) {
          const localPath = path.join(tempDir, "au-review.png");
          await activePage.screenshot({ path: localPath, fullPage: true });
          const ownerId = profile.auth_user_id ?? profile.id;
          screenshotStoragePath = await uploadArtifact({
            authUserId: ownerId,
            applicationId: item.application_id,
            country: "AU",
            kind: "review-screenshot",
            ext: "png",
            contentType: "image/png",
            filePath: localPath,
          });
        }
      } catch (screenshotErr) {
        const msg = screenshotErr instanceof Error ? screenshotErr.message : String(screenshotErr);
        console.warn(`[au] Review screenshot capture failed for ${item.application_id}: ${msg}`);
      }

      const auPayload: AuSubmissionResult = {
        country: "AU",
        status: "stopped_at_review",
        trn,
        portalUrl,
        portalUsername: username,
        ...(screenshotStoragePath ? { reviewScreenshotStoragePath: screenshotStoragePath } : {}),
      };

      await writeSubmissionResult(item.application_id, auPayload, "stopped_at_review");

      await supabase
        .from("submission_queue")
        .update({
          status: "au_prefilled",
          au_result_payload: result.result as unknown as Record<string, unknown>,
          au_trn: trn || null,
          au_review_screenshot_storage_path: screenshotStoragePath ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      console.log(`[au] Run ${runId} stopped_at_review — trn=${trn || "(none)"}, screenshot=${screenshotStoragePath ?? "(none)"}`);
      return;
    }

    if (result.outcome === "stopped_early" && result.result) {
      // Walked but never reached Review (e.g. orchestrator hit maxPages on
      // an unmapped section). Treat as a recoverable failure so ops can
      // re-queue after fixing selectors.
      const reason = `stopped early at ${result.result.reachedPage}`;
      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS ? "au_prefill_failed" : "au_prefill_pending";
      await supabase
        .from("submission_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_error: reason,
          au_result_payload: result.result as unknown as Record<string, unknown>,
          au_trn: result.result.trn ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (newStatus === "au_prefill_failed") {
        await markSubmissionFailed(item.application_id, reason);
        await sendFailureAlert(item.application_id, `[AU] ${reason}`);
      }
      console.error(`[au] Run ${runId} ${reason}`);
      return;
    }

    // outcome === "failed"
    const errBag = result.error ?? {};
    const errorMsg = typeof errBag.message === "string" ? errBag.message : "AU runner failed";

    // Nationality-ineligible is a data error, not a transient failure —
    // burning retries on it is wasteful and will never succeed.
    const isIneligible = errBag.name === "NationalityIneligibleError";
    const newAttempts = item.attempts + 1;
    const newStatus = isIneligible
      ? "au_prefill_failed"
      : (newAttempts >= MAX_ATTEMPTS ? "au_prefill_failed" : "au_prefill_pending");

    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        au_result_payload: errBag as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (newStatus === "au_prefill_failed") {
      await markSubmissionFailed(item.application_id, errorMsg);
      await sendFailureAlert(item.application_id, `[AU] ${errorMsg}`);
    }
    console.error(`[au] Run ${runId} failed: ${errorMsg}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newAttempts = item.attempts + 1;

    // MFA + ineligibility are data-side blockers that re-running cannot
    // resolve until the applicant updates their answers/credentials.
    const isBlocker = err instanceof MfaRequiredError || err instanceof NationalityIneligibleError;
    const newStatus = isBlocker
      ? "au_blocked"
      : (newAttempts >= MAX_ATTEMPTS ? "au_prefill_failed" : "au_prefill_pending");

    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (newStatus === "au_prefill_failed" || newStatus === "au_blocked") {
      await markSubmissionFailed(item.application_id, errorMsg);
      await sendFailureAlert(item.application_id, `[AU${isBlocker ? " blocked" : ""}] ${errorMsg}`);
    }
    console.error(`[au] Unhandled error in ${runId}:`, errorMsg);
  } finally {
    if (handles) {
      try { await handles.context.close(); } catch { /* ignore */ }
      try { await handles.browser.close(); } catch { /* ignore */ }
    }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function requireAnswer(map: Record<string, string | null>, field: string): string {
  const v = map[field];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required FV-override field "${field}" in visa_application_answers`);
  }
  return v.trim();
}

// ─── Main processing loop ────────────────────────────────────────────────────

async function processItem(item: SubmissionQueueItem): Promise<void> {
  console.log(`[queue] Processing application ${item.application_id} (attempt ${item.attempts + 1})`);

  await markProcessing(item.id);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-submission-"));
  console.log(`[queue] Temp dir: ${tempDir}`);

  try {
    const { profile, application, documents } = await loadApplicantData(item.application_id);
    const localDocPaths = await downloadDocuments(documents, tempDir);
    const confirmationNumber = await submitApplication(profile, application, localDocPaths);

    await updateApplicationSubmitted(item.application_id, confirmationNumber);
    await markDone(item.id);
    console.log(`[queue] Done — application ${item.application_id}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[queue] Error processing ${item.application_id}:`, errorMsg);

    await incrementFailure(item.id, item.attempts, errorMsg);

    const newAttempts = item.attempts + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      console.error(`[queue] Max attempts reached for ${item.application_id} — sending alert`);
      await sendFailureAlert(item.application_id, errorMsg);
    }
  } finally {
    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

async function poll(): Promise<void> {
  console.log("[poll] Checking submission_queue for pending items...");

  let items: SubmissionQueueItem[];
  try {
    items = await fetchPendingItems();
  } catch (err) {
    console.error("[poll] Failed to fetch queue:", err);
    return;
  }

  if (items.length === 0) {
    console.log("[poll] No pending items.");
    return;
  }

  console.log(`[poll] Found ${items.length} pending item(s).`);

  // Process sequentially to avoid parallel browser sessions overwhelming the host
  for (const item of items) {
    if (isDs160Job(item)) {
      await processDs160Item(item);
    } else if (isFvJob(item)) {
      await processFvItem(item);
    } else if (isUkJob(item)) {
      await processUkItem(item);
    } else if (isVnJob(item)) {
      await processVnItem(item);
    } else if (isAuJob(item)) {
      await processAuItem(item);
    } else {
      await processItem(item);
    }
  }
}

async function main(): Promise<void> {
  console.log("[main] VIZA Submission Service starting...");
  console.log(`[main] Polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately on start, then on interval
  await poll();
  setInterval(poll, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
