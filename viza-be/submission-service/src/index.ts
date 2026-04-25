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
  type CeacRunResult,
} from "./ceac";
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
} from "./uk";
import {
  SubmissionQueueItem,
  ApplicantProfile,
  Application,
  ApplicationDocument,
  FvAccount,
  VisaApplicationAnswer,
} from "./types";

const POLL_INTERVAL_MS = 30_000;
const MAX_ATTEMPTS = 3;

// ─── Supabase data loaders ───────────────────────────────────────────────────

async function fetchPendingItems(): Promise<SubmissionQueueItem[]> {
  const { data, error } = await supabase
    .from("submission_queue")
    .select("*")
    .in("status", ["pending", "ds160_prefill_pending", "fv_prefill_pending", "uk_prefill_pending"])
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
  applicationId: string
): Promise<string> {
  const fileBuffer = fs.readFileSync(datFilePath);
  const storagePath = `ds160-dat/${applicationId}/${path.basename(datFilePath)}`;

  const { error } = await supabase.storage
    .from("application-documents")
    .upload(storagePath, fileBuffer, {
      contentType: "application/octet-stream",
      upsert: true,
    });

  if (error) throw new Error(`Failed to upload .dat file: ${error.message}`);

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

    // Drive page-by-page fill through CEAC navigation/checkpoint helpers.
    // orchestrateFill handles: field filling, page advancement, section
    // checkpoints, .dat capture, and stop-at-sign-and-submit.
    const { result, datArtifact, sectionCoverage } = await orchestrateFill(session, {
      answers,
      profile: profile as unknown as Record<string, unknown>,
      tracker,
      runId,
      outputDir: tempDir,
    });

    // Upload .dat artifact to Supabase Storage if captured
    let storagePath = "";
    if (datArtifact) {
      storagePath = await uploadDs160Dat(datArtifact.path, item.application_id);
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
      await supabase
        .from("submission_queue")
        .update({
          status: "fv_prefilled",
          fv_result_payload: result as unknown as Record<string, unknown>,
          fv_application_reference: result.applicationReference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      console.log(`[fv] Run ${runId} prefilled — ref=${result.applicationReference ?? "(none)"}`);
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
      await sendFailureAlert(item.application_id, `[FV] ${errorMsg}`);
    }
    console.error(`[fv] Unhandled error in ${runId}:`, errorMsg);
  }
}

// ─── UK Standard Visitor Job Processor ───────────────────────────────
//
// Today: drives the pre-auth flow (language → country → VAC → start) and
// stops at the registration page. Post-auth selectors are not yet
// mapped — see src/uk/form-recon.ts to harvest them. The terminal state
// `uk_prefilled` here means "session reached registration", not "form
// fully filled". Callers should treat it as scaffold-only until the
// post-auth phase ships.
async function processUkItem(item: SubmissionQueueItem): Promise<void> {
  const runId = `uk-${item.application_id}-${Date.now()}`;
  console.log(`[uk] Starting run ${runId} for ${item.application_id} (attempt ${item.attempts + 1})`);

  await supabase
    .from("submission_queue")
    .update({ status: "uk_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);

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
      await sendFailureAlert(item.application_id, `[UK] ${errorMsg}`);
    }
    console.error(`[uk] Run ${runId} failed:`, errorMsg);
  } finally {
    if (session) await session.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup */ }
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
