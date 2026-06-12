import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { randomBytes } from "crypto";
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
import { deriveDS160Answers } from "./ds160-derive-answers";
import {
  startCeacSession,
  createRecoveryTracker,
  recordBootstrapCheckpoint,
  preserveRecoveryOnFailure,
  buildFailureResult,
  serializeError,
  isGateError,
  isManualActionRequiredError,
  orchestrateFill,
  isSuccessResult,
  handleConfirmApplicationPage,
  type CeacRunResult,
  type ConfirmApplicationResult,
} from "./ceac";
import { writeSubmissionResult, markSubmissionFailed, markSubmissionStalled, setSubmissionStatus } from "./result-writer";
import {
  applyVietnamAnswerAliases,
  buildCountrySubmissionApplication,
  getCountrySubmissionProvider,
  runDryRunSubmission,
} from "./country-submissions";
import { pollAndRun } from "./queue/worker";
import { runnerJobHandler } from "./queue/handler";
import { validateEnv } from "./config/validate-env";
import { startHealthServer } from "./health-server";
import { decryptSecret, encryptSecret } from "./secret-cipher";
import { applicantVault } from "./applicant-vault";
import type {
  FrSubmissionResult,
  GenericSubmissionResult,
  UkSubmissionResult,
  UsSubmissionResult,
  VnSubmissionResult,
  SgArrivalCardSubmissionResult,
} from "./submission-result";
import {
  fillFranceVisasApplication,
  registerFvAccount,
  normalizeFvAnswers,
  buildAnswerMap,
  isGateError as isFvGateError,
  NormalizationError,
  type NormalizeInput,
} from "./france-visas";
import { ensureApplicantInboxAlias } from "./inbox/alias";
import { createSupabaseMailboxProvider } from "./france-visas/mailbox-provider";
import {
  startUkSession,
  orchestrateUkFill,
  isUkGateError,
  serializeUkError,
  resumeUkApplication,
} from "./uk";
import { fillVietnamApplication, type FillVietnamResult } from "./vietnam";
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
import {
  loadDs160SubmissionConfig,
  validateDs160LiveStart,
  type Ds160SubmissionConfig,
} from "./ds160-live-config";
import {
  loadFranceSubmissionConfig,
  validateFranceLiveStart,
  type FranceSubmissionConfig,
} from "./france-live-config";
import {
  createUSAppointmentRunnerRepository,
  loadUSAppointmentRunnerConfig,
  pollUSAppointmentAssistedJobs,
  validateUSAppointmentRunnerStart,
} from "./us-appointment";
import {
  normalizeSgacPortalPayload,
  runSgacPortalSubmission,
  SGAC_OFFICIAL_PORTAL_URL,
  SgacPortalError,
  SgacPortalValidationError,
} from "./sgac";

const POLL_INTERVAL_MS = Number.parseInt(
  process.env.VIZA_SUBMISSION_POLL_INTERVAL_MS ?? "30000",
  10,
);
const MAX_ATTEMPTS = 3;
const STALE_QUEUE_TIMEOUT_MS = Number.parseInt(
  process.env.VIZA_SUBMISSION_QUEUE_STALE_MS ?? String(10 * 60 * 1000),
  10,
);
const DS160_LIVE_PROCESSING_TIMEOUT_MS = Math.max(
  STALE_QUEUE_TIMEOUT_MS,
  (Number.parseInt(process.env.DS160_LIVE_MAX_DURATION_SECONDS ?? "1800", 10) + 300) * 1000,
);
const PENDING_PICKUP_TIMEOUT_MS = Number.parseInt(
  process.env.VIZA_SUBMISSION_PENDING_PICKUP_TIMEOUT_MS ?? "90000",
  10,
);
const STALE_QUEUE_STATUSES: SubmissionQueueItem["status"][] = [
  "pending",
  "processing",
  "ds160_prefill_pending",
  "ds160_prefill_processing",
  "ds160_live_assisted_pending",
  "ds160_live_assisted_processing",
  "fv_prefill_pending",
  "fv_prefill_processing",
  "france_live_assisted_pending",
  "france_live_processing",
  "uk_prefill_pending",
  "uk_prefill_processing",
  "vn_dry_run_pending",
  "vn_dry_run_processing",
  "vn_live_assisted_pending",
  "vn_live_assisted_processing",
  "sgac_dry_run_pending",
  "sgac_dry_run_processing",
  "sgac_live_assisted_pending",
  "sgac_live_assisted_processing",
  "vn_prefill_pending",
  "vn_prefill_processing",
  "au_prefill_pending",
  "au_prefill_processing",
];

function isSubmissionDryRunMode(): boolean {
  return process.env.VIZA_SUBMISSION_DRY_RUN === "1";
}

function isDryRunQueueItem(item: SubmissionQueueItem): boolean {
  return item.mode === "dry_run" || item.status.startsWith("vn_dry_run_") || item.status.startsWith("sgac_dry_run_");
}

function isLiveAssistedQueueItem(item: SubmissionQueueItem): boolean {
  return (
    item.mode === "live_assisted" ||
    item.status.startsWith("ds160_live_assisted_") ||
    item.status.startsWith("france_live_") ||
    item.status.startsWith("vn_live_assisted_") ||
    item.status.startsWith("sgac_live_assisted_") ||
    item.provider === "france_visas_live" ||
    item.provider === "vietnam_evisa_live" ||
    item.provider === "sg_arrival_card_live"
  );
}

function isDs160LiveAssistedQueueItem(item: SubmissionQueueItem): boolean {
  return item.mode === "live_assisted" || item.status === "ds160_live_assisted_pending";
}

function isLegacyRealSubmitEnabled(): boolean {
  return process.env.VIZA_ALLOW_LEGACY_REAL_SUBMIT === "1";
}

function redactIdentifier(value: string | null | undefined): string {
  if (!value) return "(none)";
  if (value.length <= 8) return "<redacted>";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function createRunId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Supabase data loaders ───────────────────────────────────────────────────

async function fetchPendingItems(): Promise<SubmissionQueueItem[]> {
  const { data, error } = await supabase
    .from("submission_queue")
    .select("*")
    .in("status", [
      "pending",
      "ds160_prefill_pending",
      "ds160_live_assisted_pending",
      "fv_prefill_pending",
      "france_live_assisted_pending",
      "uk_prefill_pending",
      "vn_dry_run_pending",
      "vn_live_assisted_pending",
      "sgac_dry_run_pending",
      "sgac_live_assisted_pending",
      "vn_prefill_pending",
      "au_prefill_pending",
    ])
    .lt("attempts", MAX_ATTEMPTS);

  if (error) throw new Error(`Failed to fetch submission_queue: ${error.message}`);
  return data ?? [];
}

function isDs160Job(item: SubmissionQueueItem): boolean {
  return item.status === "ds160_prefill_pending" || item.status === "ds160_live_assisted_pending";
}

function isFvJob(item: SubmissionQueueItem): boolean {
  return (
    item.status === "fv_prefill_pending" ||
    item.status === "france_live_assisted_pending" ||
    item.provider === "france_visas_live"
  );
}

function isUkJob(item: SubmissionQueueItem): boolean {
  return item.status === "uk_prefill_pending";
}

function isVnJob(item: SubmissionQueueItem): boolean {
  return item.status === "vn_prefill_pending" || item.status === "vn_live_assisted_pending";
}

function isSgacJob(item: SubmissionQueueItem): boolean {
  return item.status === "sgac_live_assisted_pending";
}

function isAuJob(item: SubmissionQueueItem): boolean {
  return item.status === "au_prefill_pending";
}

const VIETNAM_COUNTRY_ALIASES = new Set(["VN", "VIETNAM", "VIET_NAM"]);
const VIETNAM_EVISA_TYPES = new Set([
  "VN_E_VISA",
  "VIETNAM_E_VISA",
  "E_VISA_TOURISM",
  "EVISA_TOURISM",
  "TOURIST_E_VISA",
  "TOURIST_EVISA",
]);

const SINGAPORE_COUNTRY_ALIASES = new Set(["SG", "SINGAPORE"]);
const SG_ARRIVAL_CARD_TYPES = new Set(["SG_ARRIVAL_CARD"]);

type QueueRoutingApplication = Pick<Application, "id" | "country" | "visa_type">;

function normalizeQueueRoutingValue(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s/-]+/g, "_");
}

function isVietnamApplicationMetadata(application: QueueRoutingApplication | null): boolean {
  if (!application) return false;
  return (
    VIETNAM_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country)) &&
    VIETNAM_EVISA_TYPES.has(normalizeQueueRoutingValue(application.visa_type))
  );
}

function isSgArrivalCardApplicationMetadata(application: QueueRoutingApplication | null): boolean {
  if (!application) return false;
  return (
    SINGAPORE_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country)) &&
    SG_ARRIVAL_CARD_TYPES.has(normalizeQueueRoutingValue(application.visa_type))
  );
}

function isSgArrivalCardQueueItem(
  item: SubmissionQueueItem,
  application: QueueRoutingApplication | null = null,
): boolean {
  return (
    item.status.startsWith("sgac_") ||
    item.provider === "sg_arrival_card_dry_run" ||
    item.provider === "sg_arrival_card_live" ||
    isSgArrivalCardApplicationMetadata(application)
  );
}

function isVietnamQueueMetadata(item: SubmissionQueueItem, application: QueueRoutingApplication | null): boolean {
  return (
    item.status.startsWith("vn_") ||
    item.provider === "vietnam_evisa_live" ||
    item.provider === "vietnam_evisa_dry_run" ||
    isVietnamApplicationMetadata(application)
  );
}

async function loadQueueRoutingApplication(applicationId: string): Promise<QueueRoutingApplication | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, country, visa_type")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    console.warn(`[queue] Could not load application routing metadata for ${applicationId}: ${error.message}`);
    return null;
  }
  return (data ?? null) as QueueRoutingApplication | null;
}

async function normalizeVietnamQueueItem(item: SubmissionQueueItem): Promise<SubmissionQueueItem> {
  const application = await loadQueueRoutingApplication(item.application_id);
  if (!isVietnamQueueMetadata(item, application)) return item;

  const liveRequested = isLiveAssistedQueueItem(item);
  const expectedStatus: SubmissionQueueItem["status"] = liveRequested
    ? "vn_live_assisted_pending"
    : "vn_dry_run_pending";
  const expectedProvider = liveRequested ? "vietnam_evisa_live" : "vietnam_evisa_dry_run";
  const expectedMode = liveRequested ? "live_assisted" : "dry_run";

  if (item.status === expectedStatus && item.provider === expectedProvider && item.mode === expectedMode) {
    return item;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("submission_queue")
    .update({
      status: expectedStatus,
      mode: expectedMode,
      provider: expectedProvider,
      current_stage: "queued",
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  if (error) {
    console.error(`[vn] Failed to normalize legacy queue ${redactIdentifier(item.id)}: ${error.message}`);
    return item;
  }

  console.warn(
    `[vn] Normalized legacy Vietnam queue ${redactIdentifier(item.id)} from status=${item.status} mode=${item.mode ?? "(null)"} provider=${item.provider ?? "(null)"} to ${expectedStatus}`,
  );
  return {
    ...item,
    status: expectedStatus,
    mode: expectedMode,
    provider: expectedProvider,
    heartbeat_at: now,
    updated_at: now,
  };
}

async function normalizeSgacQueueItem(item: SubmissionQueueItem): Promise<SubmissionQueueItem> {
  const application = await loadQueueRoutingApplication(item.application_id);
  if (!isSgArrivalCardQueueItem(item, application)) return item;

  const liveRequested = isLiveAssistedQueueItem(item);
  const expectedStatus: SubmissionQueueItem["status"] = liveRequested
    ? "sgac_live_assisted_pending"
    : "sgac_dry_run_pending";
  const expectedProvider = liveRequested ? "sg_arrival_card_live" : "sg_arrival_card_dry_run";
  const expectedMode = liveRequested ? "live_assisted" : "dry_run";

  if (item.status === expectedStatus && item.provider === expectedProvider && item.mode === expectedMode) {
    return item;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("submission_queue")
    .update({
      status: expectedStatus,
      mode: expectedMode,
      provider: expectedProvider,
      current_stage: "queued",
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  if (error) {
    console.error(`[sgac] Failed to normalize queue ${redactIdentifier(item.id)}: ${error.message}`);
    return item;
  }

  console.warn(
    `[sgac] Normalized queue ${redactIdentifier(item.id)} from status=${item.status} mode=${item.mode ?? "(null)"} provider=${item.provider ?? "(null)"} to ${expectedStatus}`,
  );
  return {
    ...item,
    status: expectedStatus,
    mode: expectedMode,
    provider: expectedProvider,
    heartbeat_at: now,
    updated_at: now,
  };
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

    console.log("[playwright] Submission successful — confirmation captured.");
    return confirmationNumber;
  } finally {
    await browser.close();
  }
}

// ─── DS-160 Data Loaders ────────────────────────────────────────────────────

const HAS_CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/;

function applyEnglishAliases(answers: Record<string, string>): void {
  for (const [key, value] of Object.entries(answers)) {
    if (!key.endsWith("_en")) continue;
    const baseKey = key.slice(0, -3);
    if (!baseKey) continue;

    const current = answers[baseKey];
    if (!current || HAS_CJK.test(current)) {
      answers[baseKey] = value;
    }
  }
}

function resolveCeacStartLocationCode(answers: Record<string, string>): string {
  const candidates = [
    answers["consular_post"],
    answers["embassy_or_consulate"],
    answers["location_where_applying_for_visa"],
    process.env.CEAC_LOCATION_CODE,
    "NSS",
  ];

  for (const candidate of candidates) {
    const code = candidate?.trim();
    if (code) return code.toUpperCase();
  }

  return "NSS";
}

function failedStatusForQueueStatus(status: SubmissionQueueItem["status"]): SubmissionQueueItem["status"] {
  if (status.startsWith("ds160_live_assisted_")) return "ds160_live_assisted_failed";
  if (status.startsWith("ds160_")) return "ds160_prefill_failed";
  if (status.startsWith("fv_")) return "fv_prefill_failed";
  if (status.startsWith("uk_")) return "uk_prefill_failed";
  if (status.startsWith("vn_live_assisted_")) return "vn_live_assisted_failed";
  if (status.startsWith("vn_dry_run_")) return "vn_dry_run_failed";
  if (status.startsWith("vn_")) return "vn_prefill_failed";
  if (status.startsWith("sgac_live_assisted_")) return "sgac_live_assisted_failed";
  if (status.startsWith("sgac_dry_run_")) return "sgac_dry_run_failed";
  if (status.startsWith("sgac_")) return "sgac_blocked";
  if (status.startsWith("au_")) return "au_prefill_failed";
  return "failed";
}

function isPendingQueueStatus(status: SubmissionQueueItem["status"]): boolean {
  return status === "pending" || status.endsWith("_pending");
}

function timeoutForQueueStatus(status: SubmissionQueueItem["status"]): number {
  if (isPendingQueueStatus(status)) return PENDING_PICKUP_TIMEOUT_MS;
  if (status === "ds160_live_assisted_processing") {
    return DS160_LIVE_PROCESSING_TIMEOUT_MS;
  }
  return STALE_QUEUE_TIMEOUT_MS;
}

async function markStaleQueueItemsTimedOut(): Promise<void> {
  if (!Number.isFinite(STALE_QUEUE_TIMEOUT_MS) || STALE_QUEUE_TIMEOUT_MS <= 0) return;
  const { data, error } = await supabase
    .from("submission_queue")
    .select("*")
    .in("status", STALE_QUEUE_STATUSES);

  if (error) {
    console.error(`[queue-timeout] Failed to scan stale submission_queue rows: ${error.message}`);
    return;
  }

  const staleItems = ((data ?? []) as SubmissionQueueItem[]).filter((item) => {
    const timeoutMs = timeoutForQueueStatus(item.status);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return false;
    const cutoffMs = Date.now() - timeoutMs;
    const lastTouched = item.updated_at || item.created_at;
    const touchedMs = lastTouched ? Date.parse(lastTouched) : Number.NaN;
    return Number.isFinite(touchedMs) && touchedMs < cutoffMs;
  });
  for (const item of staleItems) {
    const timeoutMs = timeoutForQueueStatus(item.status);
    const pendingPickup = isPendingQueueStatus(item.status);
    const timedOutStatus: SubmissionQueueItem["status"] = pendingPickup
      ? "stalled"
      : failedStatusForQueueStatus(item.status);
    const reason = pendingPickup
      ? `Submission job stalled: the worker did not pick up queue status ${item.status} within ${Math.round(timeoutMs / 1000)}s.`
      : `Submission job failed: worker heartbeat stopped for ${Math.round(timeoutMs / 1000)}s in status ${item.status}.`;
    await supabase
      .from("submission_queue")
      .update({
        status: timedOutStatus,
        attempts: pendingPickup ? item.attempts : Math.max(item.attempts, MAX_ATTEMPTS),
        last_error: reason,
        error_code: pendingPickup ? "queue_pickup_stalled" : "queue_processing_timed_out",
        error_message: reason,
        current_stage: pendingPickup ? "stalled" : "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (pendingPickup) {
      await markSubmissionStalled(item.application_id, reason);
    } else {
      await markSubmissionFailed(item.application_id, reason);
    }
    console.warn(
      `[queue-timeout] queue=${redactIdentifier(item.id)} application=${redactIdentifier(item.application_id)} -> ${timedOutStatus}: ${reason}`,
    );
  }
}

async function loadDs160Answers(
  applicationId: string,
  options: { prepareForCeac?: boolean } = {},
): Promise<Record<string, string>> {
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

  if (options.prepareForCeac) {
    applyEnglishAliases(answers);
    deriveDS160Answers(answers);
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

    console.log(
      `[ds160] Application metadata captured: applicationId=${redactIdentifier(ds160AppId)}, retrievalUrl=${retrievalUrl ? "<redacted>" : "(none)"}`,
    );

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
  console.log("[ds160] .dat uploaded to private storage.");
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

function buildDs160ActionRequiredResult(
  applicationId: string,
  actionType: string,
  message: string,
): GenericSubmissionResult {
  return {
    country: "GENERIC",
    targetCountry: "US",
    visaType: "DS160",
    status: "action_required",
    mode: "live_assisted",
    applicationId,
    actionType,
    actionInstructions: message,
    implementationStatus: "implemented",
    message,
  };
}

function buildFranceActionRequiredResult(
  applicationId: string,
  actionType: string,
  message: string,
): GenericSubmissionResult {
  return {
    country: "GENERIC",
    targetCountry: "FR",
    visaType: "EU_SCHENGEN_C_SHORT_STAY",
    status: "action_required",
    mode: "live_assisted",
    applicationId,
    actionType,
    actionInstructions: message,
    implementationStatus: "implemented",
    message,
  };
}

type FranceManualActionType =
  | "captcha_required"
  | "login_required"
  | "email_verification_required"
  | "official_review_required"
  | "final_validation_required"
  | "payment_required"
  | "appointment_required"
  | "provider_handoff_required"
  | "layout_changed"
  | "official_portal_error";

function redactManualActionMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactManualActionMetadata);
  if (typeof value !== "object" || value === null) return value;

  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (/answer|captcha|password|cookie|token|secret|passport|reference/i.test(key)) {
      out[key] = "<redacted>";
    } else {
      out[key] = redactManualActionMetadata(nested);
    }
  }
  return out;
}

function franceManualActionTypeFromError(error: unknown): FranceManualActionType {
  const message = error instanceof Error ? error.message : String(error);
  if (/captcha|gate|anti[- ]?bot/i.test(message)) return "captcha_required";
  if (/login|sign.?in|session/i.test(message)) return "login_required";
  if (/email|mail|verification/i.test(message)) return "email_verification_required";
  if (/review|diff|mismatch/i.test(message)) return "official_review_required";
  if (/payment|pay/i.test(message)) return "payment_required";
  if (/appointment|booking|vac|vfs|tls|capago/i.test(message)) return "appointment_required";
  if (/layout|selector|unknown page/i.test(message)) return "layout_changed";
  return "official_portal_error";
}

async function createFranceManualAction(input: {
  item: SubmissionQueueItem;
  actionType: FranceManualActionType;
  instruction: string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const metadata = redactManualActionMetadata(input.metadata ?? {}) as Record<string, unknown>;
  const userId = input.userId ?? input.item.user_id ?? null;

  const genericPayload = {
    submission_queue_id: input.item.id,
    application_id: input.item.application_id,
    user_id: userId,
    country: "france",
    action_type: input.actionType,
    status: "pending",
    instruction: input.instruction,
    screenshot_url: null,
    metadata,
    created_at: now,
  };

  const { error: genericError } = await supabase
    .from("submission_manual_actions")
    .insert(genericPayload);

  if (!genericError) return;

  const genericMessage = genericError.message.toLowerCase();
  const genericMissing =
    genericError.code === "PGRST204" ||
    genericMessage.includes("schema cache") ||
    genericMessage.includes("does not exist") ||
    genericMessage.includes("submission_manual_actions");
  if (!genericMissing) {
    console.warn(`[fv] Failed to create generic manual action for ${input.item.id}: ${genericError.message}`);
    return;
  }

  const { error: franceError } = await supabase
    .from("france_live_manual_actions")
    .insert({
      job_id: input.item.id,
      application_id: input.item.application_id,
      user_id: userId,
      action_type: input.actionType,
      status: "pending",
      instruction: input.instruction,
      screenshot_url: null,
      redacted_metadata_json: metadata,
      created_at: now,
    });

  if (franceError) {
    console.warn(`[fv] Failed to create France manual action for ${input.item.id}: ${franceError.message}`);
  }
}

async function processDs160LiveConfigBlockedItem(
  item: SubmissionQueueItem,
  reason: string,
): Promise<void> {
  console.warn(
    `[ceac] Live assisted blocked for application=${redactIdentifier(item.application_id)}: ${reason}`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: "ds160_blocked",
      last_error: reason,
      ceac_result_payload: {
        status: "blocked_by_config",
        reason,
        mode: "live_assisted",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  await writeSubmissionResult(
    item.application_id,
    buildDs160ActionRequiredResult(item.application_id, "live_mode_config", reason),
    "action_required",
  );
}

// ─── DS-160 Job Processor (CEAC runtime pipeline) ──────────────────────────

async function processDs160Item(
  item: SubmissionQueueItem,
  config: Ds160SubmissionConfig,
): Promise<void> {
  const liveAssisted = isDs160LiveAssistedQueueItem(item);
  const runId = createRunId(liveAssisted ? "ds160-live" : "ds160-prefill");
  console.log(
    `[ceac] Starting CEAC run ${runId} for application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: liveAssisted ? "ds160_live_assisted_processing" : "ds160_prefill_processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ceac-run-"));
  let session: Awaited<ReturnType<typeof startCeacSession>> | null = null;
  const heartbeatTimer = setInterval(() => {
    void supabase
      .from("submission_queue")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .in("status", ["ds160_live_assisted_processing", "ds160_prefill_processing"])
      .then(({ error }) => {
        if (error) {
          console.warn(
            `[ceac] Heartbeat update failed for queue=${redactIdentifier(item.id)}: ${error.message}`,
          );
        }
      });
  }, 60_000);

  const tracker = createRecoveryTracker({ runId });

  try {
    // Load applicant data and answers before bootstrap so the CEAC start-page
    // post/location can be selected from the applicant's own DS-160 answers.
    const { profile } = await loadApplicantData(item.application_id);
    const answers = await loadDs160Answers(item.application_id, { prepareForCeac: true });
    const startLocationCode = resolveCeacStartLocationCode(answers);

    session = await startCeacSession({
      headless: config.playwrightHeadless,
      acceptDownloads: true,
      runId,
      startLocationCode,
    });
    // Record bootstrap checkpoint — proves CEAC start page was reached
    await recordBootstrapCheckpoint(session.page, { sink: tracker, runId });

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
      `[ceac] confirm-application checkpoint captured applicationId=${redactIdentifier(confirm.applicationId)}`,
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
        securityAnswerCipher: encryptSecret(confirm.securityAnswer),
        embassyOrConsulate:
          answers["consular_post"] ??
          answers["embassy_or_consulate"] ??
          answers["location_where_applying_for_visa"] ??
          "Pending — confirm at appointment",
        retrievalUrl: `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${result.applicationId ?? confirm.applicationId}`,
        ...(storagePath ? { datStoragePath: storagePath } : {}),
        finalSubmissionMode: "applicant_handoff",
      };
      await writeSubmissionResult(item.application_id, usPayload, "stopped_at_sign");

      console.log(
        `[ceac] Run ${runId} handoff_ready for application=${redactIdentifier(item.application_id)}`,
      );
    } else {
      // Orchestrator caught an error internally but preserved recovery state.
      // Persist the failure result payload so ops can inspect recovery metadata.
      const errorMsg = result.error?.message as string ?? "Unknown orchestration error";
      console.error(
        `[ceac] Run ${runId} orchestration failed for application=${redactIdentifier(item.application_id)}:`,
        errorMsg,
      );

      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS
        ? liveAssisted ? "ds160_live_assisted_failed" : "ds160_prefill_failed"
        : liveAssisted ? "ds160_live_assisted_pending" : "ds160_prefill_pending";

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
    if (isManualActionRequiredError(err)) {
      console.warn(
        `[ceac] Run ${runId} waiting for manual action for application=${redactIdentifier(item.application_id)}:`,
        errorMsg,
      );

      await supabase
        .from("submission_queue")
        .update({
          status: "ds160_blocked",
          last_error: `[CEAC manual action: ${err.actionType}] ${errorMsg}`,
          ceac_result_payload: {
            ...result as unknown as Record<string, unknown>,
            manualAction: {
              actionType: err.actionType,
              instruction: err.instruction,
              context: err.context,
            },
            ...exceptionCaptchaTelemetry,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await writeSubmissionResult(
        item.application_id,
        buildDs160ActionRequiredResult(item.application_id, err.actionType, err.instruction),
        "action_required",
      );
    } else if (isGateError(err)) {
      console.error(
        `[ceac] Run ${runId} GATED for application=${redactIdentifier(item.application_id)}:`,
        errorMsg,
      );

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
      console.error(
        `[ceac] Run ${runId} failed for application=${redactIdentifier(item.application_id)}:`,
        errorMsg,
      );

      // Persist Application ID if captured before failure
      if (result.applicationId) {
        const retrievalUrl = `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${result.applicationId}`;
        await updateDs160Metadata(item.application_id, result.applicationId, retrievalUrl, "");
      }

      const newAttempts = item.attempts + 1;
      const newStatus = newAttempts >= MAX_ATTEMPTS
        ? liveAssisted ? "ds160_live_assisted_failed" : "ds160_prefill_failed"
        : liveAssisted ? "ds160_live_assisted_pending" : "ds160_prefill_pending";

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
        console.error(
          `[ceac] Max attempts reached for application=${redactIdentifier(item.application_id)} — sending alert`,
        );
        await markSubmissionFailed(item.application_id, errorMsg);
        await sendFailureAlert(item.application_id, `[CEAC] ${errorMsg}`);
      }
    }
  } finally {
    clearInterval(heartbeatTimer);
    if (session) await session.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup */ }
  }
}

// ─── France-Visas autofill ──────────────────────────────────────────────────

function isMissingFvAccountColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("column fv_accounts.") ||
    message.includes("could not find the") ||
    message.includes("schema cache")
  );
}

function normalizeFvAccountRow(row: Record<string, unknown> | null): FvAccount | null {
  if (!row) return null;

  const rawEmail = typeof row.email === "string" ? row.email : null;
  const rawPassword = typeof row.password_encrypted === "string" ? row.password_encrypted : null;
  let officialEmail: string | null = null;
  let officialPassword: string | null = null;

  try {
    officialEmail =
      typeof row.official_account_email_encrypted === "string"
        ? decryptSecret(row.official_account_email_encrypted)
        : null;
    officialPassword =
      typeof row.official_account_password_encrypted === "string"
        ? decryptSecret(row.official_account_password_encrypted)
        : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[fv] Could not decrypt fv_accounts credentials; manual login required: ${message}`);
  }

  const email = rawEmail ?? officialEmail;
  const passwordEncrypted = rawPassword ?? officialPassword;

  if (!email || !passwordEncrypted || typeof row.id !== "string") return null;

  return {
    id: row.id,
    applicant_id: typeof row.applicant_id === "string" ? row.applicant_id : null,
    application_id: typeof row.application_id === "string" ? row.application_id : null,
    submission_queue_id: typeof row.submission_queue_id === "string" ? row.submission_queue_id : null,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    email,
    password_encrypted: passwordEncrypted,
    official_account_email_encrypted:
      typeof row.official_account_email_encrypted === "string"
        ? row.official_account_email_encrypted
        : null,
    official_account_password_encrypted:
      typeof row.official_account_password_encrypted === "string"
        ? row.official_account_password_encrypted
        : null,
    storage_state_json:
      typeof row.storage_state_json === "object" && row.storage_state_json !== null
        ? (row.storage_state_json as Record<string, unknown>)
        : null,
    last_authenticated_at:
      typeof row.last_authenticated_at === "string" ? row.last_authenticated_at : null,
    created_at: typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString(),
  };
}

async function loadFvAccount(
  applicantId: string,
  applicationId: string,
  queueId: string,
): Promise<FvAccount | null> {
  const lookups: Array<{ column: string; value: string }> = [
    { column: "applicant_id", value: applicantId },
    { column: "application_id", value: applicationId },
    { column: "submission_queue_id", value: queueId },
  ];

  for (const lookup of lookups) {
    const { data, error } = await supabase
      .from("fv_accounts")
      .select("*")
      .eq(lookup.column, lookup.value)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingFvAccountColumnError(error)) continue;
      throw new Error(`Failed to load fv_accounts: ${error.message}`);
    }

    const account = normalizeFvAccountRow((data ?? null) as Record<string, unknown> | null);
    if (account) return account;
  }

  return null;
}

function generateFvPortalPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$*?";
  const all = upper + lower + digits + symbols;
  const required = [
    upper[randomBytes(1)[0] % upper.length],
    lower[randomBytes(1)[0] % lower.length],
    digits[randomBytes(1)[0] % digits.length],
    symbols[randomBytes(1)[0] % symbols.length],
  ];
  while (required.length < 18) {
    required.push(all[randomBytes(1)[0] % all.length]);
  }
  return required
    .map((char) => ({ char, sort: randomBytes(2).readUInt16BE(0) }))
    .sort((a, b) => a.sort - b.sort)
    .map((entry) => entry.char)
    .join("");
}

function registrationNameParts(
  profile: ApplicantProfile,
  answers: Record<string, string | null>,
): { firstName: string; lastName: string } {
  const lastName =
    answers.surname ??
    answers.surname_en ??
    profile.full_name?.trim().split(/\s+/).slice(-1)[0] ??
    "Applicant";
  const firstName =
    answers.given_names ??
    answers.given_names_en ??
    profile.full_name?.trim().split(/\s+/).slice(0, -1).join(" ") ??
    "VIZA";
  return {
    firstName: firstName.trim() || "VIZA",
    lastName: lastName.trim() || "Applicant",
  };
}

function isMissingFvAccountWriteColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("column") ||
    message.includes("could not find")
  );
}

async function insertFvAccountRow(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("fv_accounts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return (data ?? {}) as Record<string, unknown>;
}

async function persistRegisteredFvAccount(input: {
  item: SubmissionQueueItem;
  applicantId: string;
  userId: string | null;
  email: string;
  password: string;
  storageState: Record<string, unknown>;
}): Promise<FvAccount> {
  const now = new Date().toISOString();
  const emailCipher = encryptSecret(input.email);
  const passwordCipher = encryptSecret(input.password);
  const payload = {
    application_id: input.item.application_id,
    submission_queue_id: input.item.id,
    user_id: input.userId,
    official_account_email_encrypted: emailCipher,
    official_account_password_encrypted: passwordCipher,
    storage_state_json: input.storageState,
    last_authenticated_at: now,
    created_at: now,
    updated_at: now,
  };

  const candidatePayloads: Array<{ label: string; payload: Record<string, unknown> }> = [
    { label: "fv_accounts row", payload },
    {
      label: "minimal fv_accounts row",
      payload: {
        application_id: input.item.application_id,
        submission_queue_id: input.item.id,
        user_id: input.userId,
        official_account_email_encrypted: emailCipher,
        official_account_password_encrypted: passwordCipher,
        created_at: now,
        updated_at: now,
      },
    },
    {
      label: "legacy fv_accounts row",
      payload: {
        applicant_id: input.applicantId,
        email: input.email,
        password_encrypted: passwordCipher,
        storage_state_json: input.storageState,
        last_authenticated_at: now,
        created_at: now,
        updated_at: now,
      },
    },
  ];

  let lastError: unknown = null;
  for (const candidate of candidatePayloads) {
    try {
      const row = await insertFvAccountRow(candidate.payload);
      const account = normalizeFvAccountRow(row);
      if (!account) throw new Error(`Persisted ${candidate.label} could not be normalized`);
      return account;
    } catch (error) {
      lastError = error;
      if (!isMissingFvAccountWriteColumnError(error as { message?: string; code?: string })) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to persist ${candidate.label}: ${message}`);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to persist fv_accounts row with any supported schema: ${message}`);
}

async function registerFvAccountForQueue(input: {
  item: SubmissionQueueItem;
  profile: ApplicantProfile;
  answers: Record<string, string | null>;
  config: FranceSubmissionConfig;
  runId: string;
}): Promise<FvAccount> {
  if (!input.config.accountRegistrationEnabled) {
    throw new Error("France-Visas account registration is disabled by configuration.");
  }

  const alias = await ensureApplicantInboxAlias(input.profile.id);
  const password = generateFvPortalPassword();
  const name = registrationNameParts(input.profile, input.answers);
  const registration = await registerFvAccount(
    {
      firstName: name.firstName,
      lastName: name.lastName,
      email: alias.alias,
      password,
      language: "English",
    },
    {
      mailbox: createSupabaseMailboxProvider(input.profile.id),
      headless: input.config.playwrightHeadless,
      maxCaptchaAttempts: input.config.registrationMaxCaptchaAttempts,
      verificationTimeoutMs: input.config.registrationEmailTimeoutMs,
      enableCaptchaSolving: input.config.registrationTwoCaptchaEnabled,
      runId: input.runId,
    },
  );

  const { error: resultPayloadError } = await supabase
    .from("submission_queue")
    .update({
      fv_result_payload: {
        status: "account_registered",
        mode: "live_assisted",
        captchaTelemetry: registration.captcha?.telemetry ?? [],
        aliasCreated: alias.created,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.item.id);
  if (resultPayloadError) {
    const message = resultPayloadError.message.toLowerCase();
    if (
      resultPayloadError.code === "PGRST204" ||
      message.includes("fv_result_payload") ||
      message.includes("could not find")
    ) {
      await supabase
        .from("submission_queue")
        .update({
          official_status: "account_registered",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.item.id);
    } else {
      throw new Error(`Failed to record France account registration telemetry: ${resultPayloadError.message}`);
    }
  }

  return persistRegisteredFvAccount({
    item: input.item,
    applicantId: input.profile.id,
    userId: input.profile.auth_user_id,
    email: registration.email,
    password: registration.password,
    storageState: registration.storageState as Record<string, unknown>,
  });
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
  try {
    return decryptSecret(encrypted);
  } catch {
    return encrypted;
  }
}

async function processFvConfigBlockedItem(
  item: SubmissionQueueItem,
  reason: string,
): Promise<void> {
  console.warn(
    `[fv] Live assisted blocked for application=${redactIdentifier(item.application_id)}: ${reason}`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: "fv_blocked",
      mode: "live_assisted",
      provider: "france_visas_live",
      last_error: reason,
      manual_action_status: "blocked",
      official_status: "blocked_by_config",
      error_code: "live_mode_config",
      error_message: reason,
      fv_result_payload: {
        status: "blocked_by_config",
        reason,
        mode: "live_assisted",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  await writeSubmissionResult(
    item.application_id,
    buildFranceActionRequiredResult(item.application_id, "live_mode_config", reason),
    "action_required",
  );
}

function redactOfficialReference(reference: string): string {
  if (reference.length <= 7) return "captured";
  return `${reference.slice(0, 3)}...${reference.slice(-4)}`;
}

async function processFvItem(
  item: SubmissionQueueItem,
  config: FranceSubmissionConfig,
): Promise<void> {
  const runId = createRunId("fv");
  console.log(
    `[fv] Starting run ${runId} for application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );
  const liveAssisted = isLiveAssistedQueueItem(item);

  await supabase
    .from("submission_queue")
    .update({
      status: liveAssisted ? "france_live_processing" : "fv_prefill_processing",
      mode: liveAssisted ? "live_assisted" : "dry_run",
      provider: liveAssisted ? "france_visas_live" : "france_visas_dry_run",
      manual_action_status: liveAssisted ? null : undefined,
      live_started_at: liveAssisted ? new Date().toISOString() : undefined,
      live_checkpoint: liveAssisted ? null : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

  try {
    const { profile, application } = await loadApplicantData(item.application_id);
    const rawAnswers = await loadRawAnswers(item.application_id);
    const answerMap = buildAnswerMap(rawAnswers);

    let account = await loadFvAccount(application.applicant_id, item.application_id, item.id);
    if (!account) {
      if (liveAssisted) {
        try {
          await supabase
            .from("submission_queue")
            .update({
              live_checkpoint: "account_registration",
              official_status: "account_registration_in_progress",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          account = await registerFvAccountForQueue({
            item,
            profile,
            answers: answerMap,
            config,
            runId,
          });
        } catch (registrationError) {
          const instruction =
            "France-Visas account registration needs manual help. Complete the official registration, CAPTCHA, or email verification checkpoint, then click continue.";
          const actionType = franceManualActionTypeFromError(registrationError);
          const message = registrationError instanceof Error ? registrationError.message : String(registrationError);
          await createFranceManualAction({
            item,
            actionType,
            instruction,
            userId: profile.auth_user_id,
            metadata: {
              reason: "fv_account_registration_failed",
              errorCode: (registrationError as { code?: unknown }).code,
              context: (registrationError as { context?: unknown }).context,
            },
          });
          await supabase
            .from("submission_queue")
            .update({
              status: "action_required",
              mode: "live_assisted",
              provider: "france_visas_live",
              manual_action_status: "pending",
              live_checkpoint: actionType,
              official_status: "manual_action_required",
              error_code: "france_visas_account_registration_required",
              error_message: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          await writeSubmissionResult(
            item.application_id,
            buildFranceActionRequiredResult(item.application_id, actionType, instruction),
            "action_required",
          );
          console.warn(
            `[fv] Live assisted paused for ${redactIdentifier(item.application_id)} during account registration: ${message}`,
          );
          return;
        }
      } else {
        throw new Error(`No fv_accounts row for applicant ${application.applicant_id} — register first`);
      }
      if (!account) {
        throw new Error(`France-Visas account registration did not return credentials for applicant ${application.applicant_id}`);
      }
    }

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
      {
        headless: liveAssisted ? config.playwrightHeadless : true,
        runId,
        finalize: true,
        stepTimeoutMs: Math.min(config.liveMaxDurationSeconds * 1000, 30 * 60 * 1000),
        onOfficialPortalOpened: liveAssisted
          ? async ({ url }) => {
              await supabase
                .from("submission_queue")
                .update({
                  status: "france_live_official_portal_opened",
                  official_status: "official_portal_opened",
                  official_confirmation_url: url,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", item.id);
            }
          : undefined,
      },
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
          console.warn(
            `[fv] PDF upload failed for application=${redactIdentifier(item.application_id)}: ${msg}`,
          );
          pdfStoragePath = null;
        }
      }

      const officialReference = result.applicationReference ?? result.draftReference ?? "";
      const officialReferenceCipher = liveAssisted && officialReference
        ? encryptSecret(officialReference)
        : null;

      await supabase
        .from("submission_queue")
        .update({
          status: "fv_prefilled",
          mode: liveAssisted ? "live_assisted" : "dry_run",
          provider: liveAssisted ? "france_visas_live" : "france_visas_dry_run",
          fv_result_payload: result as unknown as Record<string, unknown>,
          official_application_id_encrypted: officialReferenceCipher,
          official_application_reference_encrypted: officialReferenceCipher,
          review_diff_status: liveAssisted ? "not_run" : "not_run",
          manual_action_status: liveAssisted ? "open" : null,
          payment_status: "manual_required",
          appointment_status: "manual_required",
          official_status: liveAssisted ? "official_record_created" : "draft_prefilled",
          fv_application_reference: liveAssisted ? null : result.applicationReference,
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
        status: liveAssisted ? "final_review_required" : "stopped_at_pay",
        mode: liveAssisted ? "live_assisted" : "dry_run",
        provider: liveAssisted ? "france_visas_live" : "france_visas_dry_run",
        applicationReference: liveAssisted && officialReference
          ? redactOfficialReference(officialReference)
          : officialReference,
        reviewDiffStatus: liveAssisted ? "not_run" : undefined,
        manualAction: liveAssisted
          ? {
              type: "final_review_required",
              status: "open",
              instructions:
                "Review the official France-Visas draft/CERFA yourself. VIZA stopped before final validation, payment, and appointment booking.",
            }
          : undefined,
        paymentStatus: "manual_required",
        appointmentStatus: "manual_required",
        officialStatus: liveAssisted ? "official_record_created" : "draft_prefilled",
        ...(pdfStoragePath ? { printablePdfStoragePath: pdfStoragePath } : {}),
      };
      await writeSubmissionResult(
        item.application_id,
        frPayload,
        liveAssisted ? "action_required" : "stopped_at_pay",
      );
      const logReference = liveAssisted && officialReference
        ? redactOfficialReference(officialReference)
        : result.applicationReference ?? "(none)";
      console.log(`[fv] Run ${runId} prefilled — ref=${logReference}, pdf=${pdfStoragePath ?? "(none)"}`);
    } else {
      const errorMsg = typeof result.error?.message === "string"
        ? result.error.message
        : `failed at ${result.failedStep}`;
      const resultErrorCode = typeof result.error?.code === "string"
        ? result.error.code
        : "";
      const isManualGateFailure =
        liveAssisted &&
        (resultErrorCode === "GATE_DETECTED" ||
          /captcha|manual|account creation|email verification|login/i.test(errorMsg));
      const manualActionType = isManualGateFailure
        ? franceManualActionTypeFromError(errorMsg)
        : null;
      const newAttempts = item.attempts + 1;
      const newStatus = isManualGateFailure
        ? "action_required"
        : newAttempts >= MAX_ATTEMPTS ? "fv_prefill_failed" : "fv_prefill_pending";

      if (manualActionType) {
        await createFranceManualAction({
          item,
          actionType: manualActionType,
          instruction:
            "France-Visas requires manual action. Complete the checkpoint in the visible official browser or provide the one-time answer in VIZA, then click continue.",
          metadata: {
            failedStep: result.failedStep,
            errorCode: resultErrorCode,
            url: result.url,
          },
          userId: profile.auth_user_id,
        });
      }

      await supabase
        .from("submission_queue")
        .update({
          status: newStatus,
          attempts: newAttempts,
          last_error: errorMsg,
          ...(liveAssisted
            ? {
                provider: "france_visas_live",
                manual_action_status: isManualGateFailure ? "pending" : "blocked",
                live_checkpoint: manualActionType,
                official_status: isManualGateFailure ? "manual_action_required" : "official_portal_error",
                error_code: isManualGateFailure ? "france_visas_manual_gate" : "france_visas_prefill_failed",
                error_message: errorMsg,
              }
            : {}),
          fv_result_payload: result as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (isManualGateFailure) {
        await writeSubmissionResult(
            item.application_id,
            buildFranceActionRequiredResult(
              item.application_id,
              manualActionType ?? "captcha_required",
              "France-Visas requires manual action before VIZA can continue. Complete CAPTCHA, login, or account verification on the official page, then retry live assisted mode.",
            ),
            "action_required",
        );
      } else if (newAttempts >= MAX_ATTEMPTS) {
        await markSubmissionFailed(item.application_id, errorMsg);
        await sendFailureAlert(item.application_id, `[FV] ${errorMsg}`);
      }
      console.error(`[fv] Run ${runId} failed at ${result.failedStep}: ${errorMsg}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isNormalizationFailure = err instanceof NormalizationError;
    const isGateFailure = isFvGateError(err);
    const manualActionType = isGateFailure ? franceManualActionTypeFromError(err) : null;
    const newAttempts = item.attempts + 1;
    // Normalization failures are data errors — don't burn retries on them.
    const newStatus = isNormalizationFailure
      ? "fv_prefill_failed"
      : isGateFailure
        ? "action_required"
        : (newAttempts >= MAX_ATTEMPTS ? "fv_prefill_failed" : "fv_prefill_pending");

    if (manualActionType) {
      await createFranceManualAction({
        item,
        actionType: manualActionType,
        instruction:
          "France-Visas requires manual action. Complete the checkpoint in the visible official browser or provide the one-time answer in VIZA, then click continue.",
        metadata: {
          errorCode: (err as { code?: unknown }).code,
          context: (err as { context?: unknown }).context,
        },
      });
    }

    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        ...(isLiveAssistedQueueItem(item)
          ? {
              provider: "france_visas_live",
              manual_action_status: isGateFailure ? "pending" : "blocked",
              live_checkpoint: manualActionType,
              official_status: isGateFailure ? "manual_action_required" : "official_portal_error",
              error_code: isGateFailure
                ? "france_visas_manual_gate"
                : isNormalizationFailure
                  ? "france_visas_normalization_failed"
                  : "france_visas_unhandled_error",
              error_message: errorMsg,
            }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    if (newStatus === "action_required" && isLiveAssistedQueueItem(item)) {
      await writeSubmissionResult(
        item.application_id,
        buildFranceActionRequiredResult(
          item.application_id,
          manualActionType ?? "captcha_required",
          "France-Visas requires manual action before VIZA can continue. Complete CAPTCHA, login, or account verification on the official page, then retry live assisted mode.",
        ),
        "action_required",
      );
    } else if (newStatus === "fv_prefill_failed") {
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
  const runId = createRunId("uk");
  console.log(
    `[uk] Starting run ${runId} for application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({ status: "uk_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

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
      // surface to user. Reads through the applicant vault — no env
      // fallback (SECRETS-002). Crashes loudly via VaultMissError if the
      // expected secrets were not seeded.
      const applicantId = application.applicant_id;
      const portalUrl = await applicantVault.require(applicantId, "uk.portal.resume_url");
      const portalUsername = await applicantVault.require(applicantId, "uk.portal.username");
      const portalPassword = await applicantVault.require(applicantId, "uk.portal.password");
      const ukPayload: UkSubmissionResult = {
        country: "UK",
        status: "stopped_at_pay",
        portalUrl,
        portalUsername,
        generatedPasswordCipher: encryptSecret(portalPassword),
      };
      await writeSubmissionResult(item.application_id, ukPayload, "stopped_at_pay");
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
// Drives evisa.gov.vn through the safe pre-pay checkpoint. A captured
// registration code is a user-action handoff, not a background completion:
// the applicant must still review/pay on the official portal.
function readBooleanEnv(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined) return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

function readNumberEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function isMissingSubmissionQueueColumnError(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    message.includes("submission_queue.mode") ||
    message.includes("submission_queue.provider") ||
    message.includes("submission_queue.current_stage") ||
    message.includes("submission_queue.heartbeat_at") ||
    message.includes("submission_queue.vn_result_payload") ||
    message.includes("submission_queue.vn_registration_code_encrypted") ||
    message.includes("submission_queue.official_portal_url") ||
    message.includes("submission_queue.official_trace_url") ||
    message.includes("column submission_queue.") ||
    message.includes("could not find the")
  );
}

async function updateVnQueueRow(
  queueId: string,
  richPatch: Record<string, unknown>,
  legacyPatch: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("submission_queue")
    .update(richPatch)
    .eq("id", queueId);
  if (!error) return;

  if (!isMissingSubmissionQueueColumnError(error)) {
    throw new Error(`Failed to update Vietnam queue ${queueId}: ${error.message}`);
  }

  const { error: legacyError } = await supabase
    .from("submission_queue")
    .update(legacyPatch)
    .eq("id", queueId);
  if (legacyError) {
    throw new Error(`Failed to update legacy Vietnam queue ${queueId}: ${legacyError.message}`);
  }
}

function redactVnDiagnosticText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
    .replace(/([?&](?:access_token|token|code|captcha|security_answer|password|key)=)[^&\s]+/gi, "$1<redacted>")
    .replace(/\b[A-Z0-9]{8,}\b/g, "<id>");
}

function redactedVnDiagnostics(result: FillVietnamResult): Record<string, unknown> | null {
  const diagnostics = "diagnostics" in result ? result.diagnostics : undefined;
  if (!diagnostics) return null;
  const snapshot = diagnostics.lastSnapshot;
  return {
    consoleErrors: diagnostics.consoleErrors.map(redactVnDiagnosticText),
    failedRequests: diagnostics.failedRequests.map(redactVnDiagnosticText),
    tracePath: diagnostics.tracePath,
    finalScreenshotPath: diagnostics.finalScreenshotPath,
    lastSnapshot: snapshot
      ? {
          url: snapshot.url,
          title: snapshot.title,
          antFormItemCount: snapshot.antFormItemCount,
          inputCount: snapshot.inputCount,
          failedRequestCount: snapshot.failedRequestCount,
          mainRequestFailed: snapshot.mainRequestFailed,
          hasVisibleModal: snapshot.hasVisibleModal,
          registrationCodeDetected: Boolean(snapshot.registrationCode),
        }
      : null,
  };
}

function buildVnQueuePayload(
  result: FillVietnamResult,
  tracePath: string | undefined,
  finalScreenshotPath: string | undefined,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    status: result.status,
    runId: result.runId,
    tracePath,
    finalScreenshotPath,
    diagnostics: redactedVnDiagnostics(result),
  };

  if (result.status === "submitted_pending_pay") {
    return {
      ...base,
      registrationCodeCaptured: true,
      submittedAtIso: result.submittedAtIso,
      fieldsFilled: result.fieldsFilled,
      fieldsSkipped: result.fieldsSkipped,
    };
  }
  if (result.status === "action_required") {
    return {
      ...base,
      actionType: result.actionType,
      checkpoint: result.checkpoint,
      instruction: result.instruction,
      url: result.url,
    };
  }
  if (result.status === "scaffolded_pending_walk") {
    return {
      ...base,
      reason: result.reason,
      checkpoint: result.checkpoint,
      url: result.url,
    };
  }
  return {
    ...base,
    failedStep: result.failedStep,
    error: result.error,
    url: result.url,
    checkpoint: result.checkpoint,
  };
}

type VietnamActionRequiredRunResult = Extract<FillVietnamResult, { status: "action_required" }>;

function vietnamStatusForAction(result: VietnamActionRequiredRunResult): VnSubmissionResult["status"] {
  if (result.actionType === "note_modal_required") return "note_modal_required";
  if (result.actionType === "captcha_required") return "captcha_required";
  if (result.actionType === "upload_required") return "upload_required";
  if (result.actionType === "payment_required" || result.actionType === "final_submit_required") {
    return "stopped_at_pay";
  }
  if (result.actionType === "official_portal_error") return "official_portal_error";
  if (result.actionType === "needs_manual_verification") return "needs_manual_verification";
  if (result.actionType === "layout_changed") return "layout_changed";
  if (result.checkpoint === "application_form_visible") return "official_form_reached";
  return "official_landing_reached";
}

function buildVietnamActionRequiredResult(
  result: VietnamActionRequiredRunResult,
  finalScreenshotPath: string | undefined,
): VnSubmissionResult {
  return {
    country: "VN",
    status: vietnamStatusForAction(result),
    mode: "live_assisted",
    provider: "vietnam_evisa_live",
    portalUrl: result.url,
    checkpoint: result.checkpoint,
    manualAction: {
      type: result.actionType,
      status: "open",
      instructions: result.instruction,
      ...(finalScreenshotPath ? { screenshotUrl: finalScreenshotPath } : {}),
    },
    paymentStatus:
      result.actionType === "payment_required" || result.actionType === "final_submit_required"
        ? "manual_required"
        : "not_required",
  };
}

async function createVietnamManualAction(
  item: SubmissionQueueItem,
  result: VietnamActionRequiredRunResult,
  screenshotPath: string | undefined,
): Promise<void> {
  const { error } = await supabase
    .from("vietnam_live_manual_actions")
    .insert({
      job_id: item.id,
      application_id: item.application_id,
      user_id: item.user_id ?? null,
      action_type: result.actionType,
      status: "pending",
      instruction: result.instruction,
      screenshot_url: screenshotPath ?? null,
      redacted_metadata_json: {
        checkpoint: result.checkpoint,
        url: result.url,
      },
    });
  if (error) {
    console.warn(`[vn] Failed to create manual action for queue=${redactIdentifier(item.id)}: ${error.message}`);
  }
}

async function processVnItem(item: SubmissionQueueItem): Promise<void> {
  const liveAssisted = item.status !== "vn_dry_run_pending" && item.mode !== "dry_run";
  const runId = createRunId(liveAssisted ? "vn-live" : "vn-dry");
  console.log(
    `[vn] Starting run ${runId} for application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );
  const diagnosticsDir = path.resolve("diag-out", "vn-live", runId);
  const captureTrace = readBooleanEnv("VN_CAPTURE_TRACE", true);
  const captureScreenshot = readBooleanEnv("VN_CAPTURE_SCREENSHOT", true);
  const tracePath = captureTrace ? path.join(diagnosticsDir, "trace.zip") : undefined;
  const finalScreenshotPath = captureScreenshot ? path.join(diagnosticsDir, "final.png") : undefined;
  const now = new Date().toISOString();

  await updateVnQueueRow(
    item.id,
    {
      status: liveAssisted ? "vn_live_assisted_processing" : "vn_prefill_processing",
      mode: liveAssisted ? "live_assisted" : "dry_run",
      provider: liveAssisted ? "vietnam_evisa_live" : "vietnam_evisa_dry_run",
      current_stage: "starting",
      started_at: now,
      heartbeat_at: now,
      official_status: "processing",
      updated_at: now,
    },
    {
      status: liveAssisted ? "vn_live_assisted_processing" : "vn_prefill_processing",
      updated_at: now,
    },
  );
  await setSubmissionStatus(item.application_id, "processing");

  try {
    const { profile, application } = await loadApplicantData(item.application_id);
    const answers = applyVietnamAnswerAliases(
      await loadDs160Answers(item.application_id),
      profile,
      application,
    );
    const result = await fillVietnamApplication(
      { answers },
      {
        headless: readBooleanEnv("VN_PLAYWRIGHT_HEADLESS", false),
        runId,
        officialBaseUrl: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
        officialFallbackBaseUrl:
          process.env.VN_OFFICIAL_FALLBACK_BASE_URL ?? "https://thithucdientu.gov.vn/",
        stepTimeoutMs: readNumberEnv(
          "VN_SMOKE_STEP_TIMEOUT_MS",
          Math.min(readNumberEnv("VN_SMOKE_TIMEOUT_MS", 240_000), 60_000),
        ),
        ...(tracePath ? { tracePath } : {}),
        ...(finalScreenshotPath ? { finalScreenshotPath } : {}),
      },
    );

    if (result.status === "submitted_pending_pay") {
      const vnPayload: VnSubmissionResult = {
        country: "VN",
        status: "submitted_pending_email",
        mode: liveAssisted ? "live_assisted" : "dry_run",
        provider: liveAssisted ? "vietnam_evisa_live" : "vietnam_evisa_dry_run",
        portalUrl: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
        checkpoint: "registration_code_visible",
        registrationCode: result.registrationCode,
        submittedAtIso: result.submittedAtIso,
        noticeText: "Your e-visa PDF will be emailed within ~3 working days.",
        paymentStatus: "manual_required",
      };
      await writeSubmissionResult(item.application_id, vnPayload, "needs_user_action");
      const completedAt = new Date().toISOString();
      await updateVnQueueRow(
        item.id,
        {
          status: "vn_prefilled",
          mode: liveAssisted ? "live_assisted" : "dry_run",
          provider: liveAssisted ? "vietnam_evisa_live" : "vietnam_evisa_dry_run",
          vn_result_payload: buildVnQueuePayload(result, tracePath, finalScreenshotPath),
          vn_registration_code_encrypted: encryptSecret(result.registrationCode),
          official_status: "registration_code_captured",
          current_stage: "payment_required",
          manual_action_status: "pending",
          payment_status: "manual_required",
          official_portal_url: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
          official_trace_url: tracePath ?? null,
          heartbeat_at: completedAt,
          updated_at: completedAt,
        },
        {
          status: "vn_prefilled",
          last_error: null,
          updated_at: completedAt,
        },
      );
      console.log(`[vn] Run ${runId} prefilled — registration code captured`);
      return;
    }

    if (result.status === "action_required") {
      const actionResult = buildVietnamActionRequiredResult(result, finalScreenshotPath);
      await createVietnamManualAction(item, result, finalScreenshotPath);
      const actionAt = new Date().toISOString();
      await updateVnQueueRow(
        item.id,
        {
          status: "vn_blocked",
          mode: "live_assisted",
          provider: "vietnam_evisa_live",
          attempts: item.attempts,
          last_error: result.instruction,
          vn_result_payload: buildVnQueuePayload(result, tracePath, finalScreenshotPath),
          manual_action_status: "pending",
          official_status: "manual_action_required",
          error_code: result.actionType,
          error_message: result.instruction,
          current_stage: result.checkpoint,
          official_portal_url: result.url,
          official_trace_url: tracePath ?? null,
          heartbeat_at: actionAt,
          updated_at: actionAt,
        },
        {
          status: "vn_blocked",
          attempts: item.attempts,
          last_error: result.instruction,
          updated_at: actionAt,
        },
      );
      await writeSubmissionResult(item.application_id, actionResult, "action_required");
      console.warn(`[vn] Run ${runId} requires manual action at ${result.checkpoint}: ${result.actionType}`);
      return;
    }

    if (result.status === "scaffolded_pending_walk") {
      // Parser/selector gap after reaching the form/review surface. This is
      // not a user checkpoint; surface it as a real failure so the UI cannot
      // spin forever at confirming_result.
      const reason =
        result.reason ||
        "Vietnam runner reached the portal but could not capture the registration code.";
      const failedAt = new Date().toISOString();
      await updateVnQueueRow(
        item.id,
        {
          status: liveAssisted ? "vn_live_assisted_failed" : "vn_prefill_failed",
          attempts: Math.max(item.attempts + 1, MAX_ATTEMPTS),
          last_error: reason,
          vn_result_payload: buildVnQueuePayload(result, tracePath, finalScreenshotPath),
          official_status: "official_portal_error",
          error_code: "registration_code_not_found",
          error_message: reason,
          current_stage: result.checkpoint ?? "layout_changed",
          official_portal_url: result.url ?? null,
          official_trace_url: tracePath ?? null,
          heartbeat_at: failedAt,
          updated_at: failedAt,
        },
        {
          status: liveAssisted ? "vn_live_assisted_failed" : "vn_prefill_failed",
          attempts: Math.max(item.attempts + 1, MAX_ATTEMPTS),
          last_error: reason,
          updated_at: failedAt,
        },
      );
      await markSubmissionFailed(item.application_id, reason);
      await sendFailureAlert(item.application_id, `[VN] ${reason}`);
      console.log(`[vn] Run ${runId} stopped at scaffold: ${result.reason}`);
      return;
    }

    // status === "failed"
    const errorMsg = typeof result.error?.message === "string" ? result.error.message : `failed at ${result.failedStep}`;
    const errorCode = typeof result.error?.code === "string" ? result.error.code : "vietnam_prefill_failed";
    const officialPortalFailure =
      errorCode.startsWith("official_portal") ||
      result.checkpoint === "white_screen" ||
      result.checkpoint === "network_blocked" ||
      result.checkpoint === "portal_error";
    const newAttempts = officialPortalFailure ? MAX_ATTEMPTS : item.attempts + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS
      ? (liveAssisted ? "vn_live_assisted_failed" : "vn_prefill_failed")
      : (liveAssisted ? "vn_live_assisted_pending" : "vn_prefill_pending");
    const failedAt = new Date().toISOString();
    await updateVnQueueRow(
      item.id,
      {
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        vn_result_payload: buildVnQueuePayload(result, tracePath, finalScreenshotPath),
        official_status: "official_portal_error",
        error_code: errorCode,
        error_message: errorMsg,
        current_stage: result.checkpoint ?? "failed",
        official_portal_url: result.url,
        official_trace_url: tracePath ?? null,
        heartbeat_at: failedAt,
        updated_at: failedAt,
      },
      {
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        updated_at: failedAt,
      },
    );
    await markSubmissionFailed(item.application_id, errorMsg);
    if (newStatus === "vn_prefill_failed" || newStatus === "vn_live_assisted_failed") {
      await sendFailureAlert(item.application_id, `[VN] ${errorMsg}`);
    }
    console.error(`[vn] Run ${runId} failed at ${result.failedStep}: ${errorMsg}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newAttempts = item.attempts + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS
      ? (liveAssisted ? "vn_live_assisted_failed" : "vn_prefill_failed")
      : (liveAssisted ? "vn_live_assisted_pending" : "vn_prefill_pending");
    const failedAt = new Date().toISOString();
    await updateVnQueueRow(
      item.id,
      {
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        official_status: "official_portal_error",
        error_code: "vietnam_unhandled_error",
        error_message: errorMsg,
        current_stage: "failed",
        official_trace_url: tracePath ?? null,
        heartbeat_at: failedAt,
        updated_at: failedAt,
      },
      {
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        updated_at: failedAt,
      },
    );
    await markSubmissionFailed(item.application_id, errorMsg);
    if (newStatus === "vn_prefill_failed" || newStatus === "vn_live_assisted_failed") {
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
  const runId = createRunId("au");
  console.log(
    `[au] Starting run ${runId} for application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({ status: "au_prefill_processing", updated_at: new Date().toISOString() })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

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
        console.warn(
          `[au] Review screenshot capture failed for application=${redactIdentifier(item.application_id)}: ${msg}`,
        );
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

      console.log(
        `[au] Run ${runId} stopped_at_review — trnCaptured=${Boolean(trn)}, screenshotCaptured=${Boolean(screenshotStoragePath)}`,
      );
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

async function enqueueSgacLiveAfterDryRun(item: SubmissionQueueItem): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("submission_queue")
    .insert({
      application_id: item.application_id,
      status: "sgac_live_assisted_pending",
      mode: "live_assisted",
      provider: "sg_arrival_card_live",
      attempts: 0,
      last_error: null,
      current_stage: "queued_after_dry_run",
      heartbeat_at: now,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`SGAC dry-run passed but live submission could not be queued: ${error.message}`);
  }

  await setSubmissionStatus(item.application_id, "waiting");
  const row = data as { id?: string | null } | null;
  return row?.id ?? null;
}

async function processSgacLiveItem(item: SubmissionQueueItem): Promise<void> {
  console.log(
    `[sgac] Processing live submission application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: "sgac_live_assisted_processing",
      current_stage: "mapping_answers",
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

  let lastPayloadSummary: SgArrivalCardSubmissionResult["payloadSummary"] | undefined;
  let artifactOwnerId: string | null = null;
  let portalHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

  function stopPortalHeartbeat(): void {
    if (!portalHeartbeatTimer) return;
    clearInterval(portalHeartbeatTimer);
    portalHeartbeatTimer = null;
  }

  async function uploadSgacScreenshots(paths: string[]): Promise<string[]> {
    if (!artifactOwnerId) return paths;
    const uploaded: string[] = [];
    for (const filePath of paths) {
      try {
        uploaded.push(
          await uploadArtifact({
            authUserId: artifactOwnerId,
            applicationId: item.application_id,
            country: "SG",
            kind: "sgac-screenshot",
            ext: "png",
            contentType: "image/png",
            filePath,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[sgac] Failed to upload screenshot artifact: ${message}`);
        uploaded.push(filePath);
      }
    }
    return uploaded;
  }

  try {
    const { profile, application } = await loadApplicantData(item.application_id);
    artifactOwnerId = profile.auth_user_id ?? null;
    const answers = await loadDs160Answers(item.application_id);
    const sgacApplication = buildCountrySubmissionApplication(profile, application, answers);
    const provider = getCountrySubmissionProvider(application.country, application.visa_type);
    if (!provider || provider.countryCode !== "SG" || application.visa_type !== "SG_ARRIVAL_CARD") {
      throw new Error(
        `SGAC live submission requires SG_ARRIVAL_CARD; got country=${application.country} visa_type=${application.visa_type}`,
      );
    }

    const validation = provider.validate(sgacApplication);
    const payload = provider.mapToSubmissionPayload(sgacApplication, {
      dryRun: false,
      idempotencyKey: `sgac-live:${item.id}`,
    });
    const payloadSummary = {
      purposeOfTravel: payload.countrySpecific.purpose_of_travel ?? payload.trip.purpose ?? null,
      arrivalDate: payload.trip.arrivalDate ?? null,
      modeOfTravel: payload.countrySpecific.mode_of_travel ?? null,
      transportNumber: payload.countrySpecific.transport_number ?? null,
      accommodationAddressProvided: Boolean(payload.countrySpecific.accommodation_address?.trim()),
    };
    lastPayloadSummary = payloadSummary;

    if (!validation.ok) {
      const missingFields = validation.missingRequiredFields;
      const message = `SGAC live validation failed: missing ${missingFields.join(", ")}.`;
      const result: SgArrivalCardSubmissionResult = {
        country: "SG",
        visaType: "SG_ARRIVAL_CARD",
        status: "validation_failed",
        mode: "live_assisted",
        provider: "sg_arrival_card_live",
        applicationId: item.application_id,
        submitted: false,
        confirmationNumber: null,
        referenceNumber: null,
        portalUrl: SGAC_OFFICIAL_PORTAL_URL,
        portalResponseSummary: "SG Arrival Card was not submitted because required VIZA form data is missing.",
        errorDetails: {
          code: "sgac_validation_failed",
          message,
          missingFields,
        },
        artifacts: { screenshots: [], logs: [], traces: [] },
        payloadSummary,
      };
      await writeSubmissionResult(item.application_id, result, "failed");
      await supabase
        .from("submission_queue")
        .update({
          status: "sgac_live_assisted_failed",
          attempts: item.attempts + 1,
          last_error: message,
          error_code: "sgac_validation_failed",
          error_message: message,
          current_stage: "validation_failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      return;
    }

    await supabase
      .from("submission_queue")
      .update({
        current_stage: "running_ica_portal",
        official_portal_url: SGAC_OFFICIAL_PORTAL_URL,
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    const portalPayload = normalizeSgacPortalPayload(payload);
    portalHeartbeatTimer = setInterval(() => {
      void supabase
        .from("submission_queue")
        .update({
          current_stage: "running_ica_portal",
          heartbeat_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("status", "sgac_live_assisted_processing")
        .then(({ error }) => {
          if (error) {
            console.warn(
              `[sgac] Heartbeat update failed for queue=${redactIdentifier(item.id)}: ${error.message}`,
            );
          }
        });
    }, 60_000);

    let portalResult: Awaited<ReturnType<typeof runSgacPortalSubmission>>;
    try {
      portalResult = await runSgacPortalSubmission(portalPayload, {
        headless: process.env.SGAC_PLAYWRIGHT_HEADLESS !== "false",
        stopBeforeSubmit: process.env.SGAC_STOP_BEFORE_SUBMIT === "1",
      });
    } finally {
      stopPortalHeartbeat();
    }
    const screenshotArtifacts = await uploadSgacScreenshots(portalResult.screenshots);

    const result: SgArrivalCardSubmissionResult = {
      country: "SG",
      visaType: "SG_ARRIVAL_CARD",
      status: portalResult.submitted ? "submitted" : "official_portal_error",
      mode: "live_assisted",
      provider: "sg_arrival_card_live",
      applicationId: item.application_id,
      submitted: portalResult.submitted,
      confirmationNumber: portalResult.confirmationNumber ?? null,
      referenceNumber: portalResult.referenceNumber ?? null,
      portalUrl: portalResult.portalUrl,
      portalResponseSummary: portalResult.portalResponseSummary,
      errorDetails: portalResult.submitted
        ? undefined
        : {
            code: "sgac_stopped_before_submit",
            message:
              "ICA SGAC runner reached Review, but final submit was disabled by SGAC_STOP_BEFORE_SUBMIT.",
          },
      artifacts: { screenshots: screenshotArtifacts, logs: portalResult.logs, traces: [] },
      payloadSummary,
    };

    await writeSubmissionResult(item.application_id, result, portalResult.submitted ? "completed" : "failed");
    await supabase
      .from("submission_queue")
      .update({
        status: portalResult.submitted ? "done" : "sgac_live_assisted_failed",
        last_error: null,
        error_code: result.errorDetails?.code ?? null,
        error_message: result.errorDetails?.message ?? null,
        current_stage: portalResult.submitted ? "submitted" : "stopped_before_submit",
        official_portal_url: portalResult.portalUrl,
        official_confirmation_number_encrypted: portalResult.confirmationNumber
          ? encryptSecret(portalResult.confirmationNumber)
          : null,
        live_submitted_at: portalResult.submitted ? new Date().toISOString() : null,
        live_screenshot_url: screenshotArtifacts[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  } catch (err) {
    stopPortalHeartbeat();
    const errorMsg = err instanceof Error ? err.message : String(err);
    const screenshots =
      err instanceof SgacPortalError ? await uploadSgacScreenshots(err.screenshotPaths) : [];
    const isValidationError = err instanceof SgacPortalValidationError;
    const result: SgArrivalCardSubmissionResult = {
      country: "SG",
      visaType: "SG_ARRIVAL_CARD",
      status: isValidationError ? "validation_failed" : "official_portal_error",
      mode: "live_assisted",
      provider: "sg_arrival_card_live",
      applicationId: item.application_id,
      submitted: false,
      confirmationNumber: null,
      referenceNumber: null,
      portalUrl: SGAC_OFFICIAL_PORTAL_URL,
      portalResponseSummary:
        err instanceof SgacPortalError && err.portalSummary
          ? err.portalSummary
          : isValidationError
            ? "SG Arrival Card was not submitted because VIZA could not map all required data into the ICA portal payload."
            : "SG Arrival Card submission failed before an ICA confirmation could be captured.",
      errorDetails: {
        code: isValidationError
          ? err.code
          : err instanceof SgacPortalError
            ? err.code
            : "sgac_live_worker_error",
        message: errorMsg,
        missingFields: isValidationError ? err.missingFields : undefined,
      },
      artifacts: { screenshots, logs: [], traces: [] },
      payloadSummary: lastPayloadSummary,
    };
    await writeSubmissionResult(item.application_id, result, "failed");
    await supabase
      .from("submission_queue")
      .update({
        status: "sgac_live_assisted_failed",
        attempts: item.attempts + 1,
        last_error: errorMsg,
        error_code: result.errorDetails?.code ?? "sgac_live_worker_error",
        error_message: errorMsg,
        current_stage: isValidationError ? "portal_payload_validation_failed" : "failed",
        live_screenshot_url: screenshots[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    console.error(`[sgac] Live submission failed: ${errorMsg}`);
  }
}

async function processDryRunItem(
  item: SubmissionQueueItem,
  source: "global_dry_run" | "legacy_fallback" | "ds160_default_dry_run",
): Promise<void> {
  console.log(
    `[dry-run] Processing application=${redactIdentifier(item.application_id)} via ${source} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: item.status === "sgac_dry_run_pending" ? "sgac_dry_run_processing" : "processing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

  try {
    const { profile, application } = await loadApplicantData(item.application_id);
    const isUsDs160 =
      application.visa_type.toUpperCase() === "DS160" ||
      application.country.toLowerCase().includes("united_states") ||
      application.country.toLowerCase() === "us";
    const answers = await loadDs160Answers(item.application_id, { prepareForCeac: isUsDs160 });
    const dryRunApplication = buildCountrySubmissionApplication(
      profile,
      application,
      answers,
    );
    const result = await runDryRunSubmission(dryRunApplication, {
      dryRun: true,
      idempotencyKey: `submission-queue:${item.id}`,
    });
    const isSgacDryRun =
      isSgArrivalCardQueueItem(item, application) &&
      item.status.startsWith("sgac_dry_run_") &&
      result.status === "submitted_mock";
    const validationFailed =
      result.status === "unsupported" &&
      result.message.startsWith("Dry-run validation failed:");
    const resultStatus =
      result.status === "submitted_mock" ? "submitted_mock" : "unsupported";

    if (validationFailed) {
      await markSubmissionFailed(item.application_id, result.message);
    } else if (isSgacDryRun) {
      const liveJobId = await enqueueSgacLiveAfterDryRun(item);
      console.log(
        `[sgac] Dry-run passed for application=${redactIdentifier(item.application_id)}; queued live job=${redactIdentifier(liveJobId)}`,
      );
    } else {
      await writeSubmissionResult(item.application_id, result, resultStatus);
    }

    await supabase
      .from("submission_queue")
      .update({
        status: result.status === "submitted_mock" ? "done" : failedStatusForQueueStatus(item.status),
        last_error: result.status === "unsupported" ? result.message : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    console.log(
      `[dry-run] application=${redactIdentifier(item.application_id)} -> ${result.status} (${result.targetCountry})`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[dry-run] Error processing application=${redactIdentifier(item.application_id)}:`, errorMsg);
    await incrementFailure(item.id, item.attempts, errorMsg);
    await markSubmissionFailed(item.application_id, errorMsg);
  }
}

// ─── Main processing loop ────────────────────────────────────────────────────

async function processItem(item: SubmissionQueueItem): Promise<void> {
  if (!isLegacyRealSubmitEnabled()) {
    await processDryRunItem(item, "legacy_fallback");
    return;
  }

  console.log(
    `[queue] Processing application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await markProcessing(item.id);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "viza-submission-"));
  console.log(`[queue] Temp dir: ${tempDir}`);

  try {
    const { profile, application, documents } = await loadApplicantData(item.application_id);
    const localDocPaths = await downloadDocuments(documents, tempDir);
    const confirmationNumber = await submitApplication(profile, application, localDocPaths);

    await updateApplicationSubmitted(item.application_id, confirmationNumber);
    await markDone(item.id);
    console.log(`[queue] Done — application=${redactIdentifier(item.application_id)}`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[queue] Error processing application=${redactIdentifier(item.application_id)}:`, errorMsg);

    await incrementFailure(item.id, item.attempts, errorMsg);

    const newAttempts = item.attempts + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      console.error(
        `[queue] Max attempts reached for application=${redactIdentifier(item.application_id)} — sending alert`,
      );
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

async function pollOnce(): Promise<void> {
  console.log("[poll] Checking submission_queue for pending items...");
  await markStaleQueueItemsTimedOut();
  try {
    const processedUsAppointmentJobs = await pollUSAppointmentAssistedJobs(
      createUSAppointmentRunnerRepository(),
    );
    if (processedUsAppointmentJobs > 0) {
      console.log(
        `[poll] Processed ${processedUsAppointmentJobs} US appointment assisted job(s).`,
      );
    }
  } catch (err) {
    console.error("[poll] US appointment runner failed:", err);
  }

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

  const targetJobId = process.env.SUBMISSION_SERVICE_TARGET_JOB_ID?.trim();
  if (targetJobId) {
    items = items.filter((item) => item.id === targetJobId);
    if (items.length === 0) {
      console.log(`[poll] No pending items matched target job ${redactIdentifier(targetJobId)}.`);
      return;
    }
  }

  console.log(`[poll] Found ${items.length} pending item(s).`);

  // Process sequentially to avoid parallel browser sessions overwhelming the host
  for (const rawItem of items) {
    const item = await normalizeSgacQueueItem(await normalizeVietnamQueueItem(rawItem));
    if (isDryRunQueueItem(item) || (isSubmissionDryRunMode() && !isLiveAssistedQueueItem(item))) {
      await processDryRunItem(item, "global_dry_run");
    } else if (isDs160Job(item)) {
      const liveRequested = isDs160LiveAssistedQueueItem(item);
      if (!liveRequested) {
        await processDryRunItem(item, "ds160_default_dry_run");
        continue;
      }

      const ds160Config = loadDs160SubmissionConfig();
      if (ds160Config.mode !== "live_assisted") {
        await processDs160LiveConfigBlockedItem(
          item,
          "DS-160 live assisted was requested, but DS160_SUBMISSION_MODE is not live_assisted.",
        );
        continue;
      }

      const liveStartError = validateDs160LiveStart(ds160Config);
      if (liveStartError) {
        await processDs160LiveConfigBlockedItem(item, liveStartError);
        continue;
      }

      await processDs160Item(item, ds160Config);
    } else if (isFvJob(item)) {
      const franceConfig = loadFranceSubmissionConfig();
      if (!isLiveAssistedQueueItem(item)) {
        await processDryRunItem(item, "global_dry_run");
        continue;
      }

      const liveStartError = validateFranceLiveStart(franceConfig);
      if (liveStartError) {
        await processFvConfigBlockedItem(item, liveStartError);
        continue;
      }

      await processFvItem(item, franceConfig);
    } else if (isUkJob(item)) {
      await processUkItem(item);
    } else if (isVnJob(item)) {
      await processVnItem(item);
    } else if (isSgacJob(item)) {
      await processSgacLiveItem(item);
    } else if (isAuJob(item)) {
      await processAuItem(item);
    } else {
      await processItem(item);
    }
  }
}

let pollInFlight = false;

async function poll(): Promise<void> {
  if (pollInFlight) {
    console.log("[poll] Previous poll is still running; skipping this tick.");
    return;
  }

  pollInFlight = true;
  try {
    await pollOnce();
  } finally {
    pollInFlight = false;
  }
}

// QUE-002: runner_job consumer wiring. Runs alongside the legacy
// submission_queue poll. Stops cleanly on SIGTERM for Cloud Run shutdown.
const RUNNER_WORKER_ID = `submission-service-${process.pid}`;
const runnerAbort = new AbortController();
let runnerStarted = false;

function shutdownRunner(signal: string): void {
  console.log(`[main] ${signal} received — stopping runner_job consumer`);
  runnerAbort.abort();
}
process.on("SIGTERM", () => shutdownRunner("SIGTERM"));
process.on("SIGINT", () => shutdownRunner("SIGINT"));

async function main(): Promise<void> {
  // DEP-003: fail fast on misconfiguration before doing any work.
  validateEnv();

  console.log("[main] VIZA Submission Service starting...");
  console.log(`[main] Polling every ${POLL_INTERVAL_MS / 1000}s`);
  const ds160Config = loadDs160SubmissionConfig();
  console.log(
    [
      "[main] DS-160 config:",
      `mode=${ds160Config.mode}`,
      `liveEnabled=${ds160Config.liveSubmissionEnabled}`,
      `liveAssistedOnly=${ds160Config.liveAssistedOnly}`,
      `finalUserConfirmation=${ds160Config.requireFinalUserConfirmation}`,
      `reviewDiffRequired=${ds160Config.requireOfficialReviewDiffPass}`,
      `headless=${ds160Config.playwrightHeadless}`,
      `manualStartWait=${process.env.DS160_WAIT_FOR_MANUAL_START_CHECKPOINT === "true" || process.env.DS160_WAIT_FOR_MANUAL_START_CHECKPOINT === "1" ? "on" : "off"}`,
      `secretConfigured=${ds160Config.submissionSecretConfigured}`,
    ].join(" "),
  );
  console.log(`[main] Global dry-run override=${isSubmissionDryRunMode() ? "on" : "off"}`);
  const ds160LiveStartError = validateDs160LiveStart(ds160Config);
  if (ds160Config.mode === "live_assisted" && ds160LiveStartError) {
    console.warn(`[main] DS-160 live assisted startup check blocked: ${ds160LiveStartError}`);
  }
  const franceConfig = loadFranceSubmissionConfig();
  console.log(
    [
      "[main] France config:",
      `mode=${franceConfig.mode}`,
      `liveEnabled=${franceConfig.liveSubmissionEnabled}`,
      `liveAssistedOnly=${franceConfig.liveAssistedOnly}`,
      `finalUserConfirmation=${franceConfig.requireFinalUserConfirmation}`,
      `reviewDiffRequired=${franceConfig.requireOfficialReviewDiffPass}`,
      `headless=${franceConfig.playwrightHeadless}`,
      `trace=${franceConfig.captureTrace}`,
      `screenshot=${franceConfig.captureScreenshot}`,
      `paymentLive=${franceConfig.paymentLiveEnabled}`,
      `appointmentLive=${franceConfig.appointmentLiveEnabled}`,
      `secretConfigured=${franceConfig.officialReferenceEncryptionConfigured}`,
      `accountRegistration=${franceConfig.accountRegistrationEnabled}`,
      `registration2captcha=${franceConfig.registrationTwoCaptchaEnabled}`,
      `twoCaptchaConfigured=${franceConfig.twoCaptchaConfigured}`,
    ].join(" "),
  );
  const franceLiveStartError = validateFranceLiveStart(franceConfig);
  if (franceConfig.mode === "live_assisted" && franceLiveStartError) {
    console.warn(`[main] France live assisted startup check blocked: ${franceLiveStartError}`);
  }
  const usAppointmentConfig = loadUSAppointmentRunnerConfig();
  console.log(
    [
      "[main] US appointment runner:",
      `enabled=${usAppointmentConfig.enabled}`,
      `providers=${usAppointmentConfig.providerAllowlist.join(",")}`,
      `countries=${usAppointmentConfig.supportedCountries.join(",")}`,
      `batchSize=${usAppointmentConfig.batchSize}`,
      `emailTimeoutMs=${usAppointmentConfig.emailTimeoutMs}`,
      `slotCooldownMs=${usAppointmentConfig.slotCheckCooldownMs}`,
      `captchaSolving=${usAppointmentConfig.captchaSolvingEnabled}`,
      `twoCaptchaConfigured=${usAppointmentConfig.twoCaptchaConfigured}`,
    ].join(" "),
  );
  const usAppointmentStartError = validateUSAppointmentRunnerStart(usAppointmentConfig);
  if (usAppointmentStartError) {
    console.warn(`[main] US appointment runner startup check blocked: ${usAppointmentStartError}`);
  }

  // DEP-004: health server for Cloud Run probes (/health, /ready).
  startHealthServer({ isWorkerStarted: () => runnerStarted });

  // Run immediately on start, then on interval
  await poll();
  setInterval(poll, POLL_INTERVAL_MS);

  // QUE-002: start the runner_job consumer (does not block the legacy poll).
  console.log(`[main] runner_job consumer active (workerId=${RUNNER_WORKER_ID})`);
  runnerStarted = true;
  void pollAndRun(RUNNER_WORKER_ID, runnerJobHandler, {
    signal: runnerAbort.signal,
  }).catch((err) => {
    console.error("[main] runner_job consumer crashed", err);
  });
}

main().catch((err) => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
