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
  isSubmittedResult,
  handleConfirmApplicationPage,
  fillRetrieveApplicationForm,
  retrievalUrlFor,
  mergeUsProofStoragePaths,
  waitForDs160ConfirmationPage,
  selectDs160PhotoDocument,
  buildPhotoFileFromDownloadedDocument,
  type CeacRunResult,
  type ConfirmApplicationResult,
} from "./ceac";
import { writeSubmissionResult, markSubmissionFailed, setSubmissionStatus } from "./result-writer";
import {
  applyVietnamAnswerAliases,
  buildCountrySubmissionApplication,
  getCountrySubmissionProvider,
  runDryRunSubmission,
} from "./country-submissions";
import type { SubmissionPayload } from "./country-submissions/types";
import { pollAndRun } from "./queue/worker";
import { runnerJobHandler } from "./queue/handler";
import { validateEnv } from "./config/validate-env";
import { startHealthServer } from "./health-server";
import { decryptSecret, encryptSecret } from "./secret-cipher";
import { applicantVault } from "./applicant-vault";
import type {
  FrSubmissionResult,
  GenericEvisaSubmissionResult,
  GenericSubmissionResult,
  UkSubmissionResult,
  UsSubmissionResult,
  VnSubmissionResult,
  SgArrivalCardSubmissionResult,
  DigitalArrivalCardSubmissionResult,
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
import {
  ensureApplicantInboxAlias,
  ensureApplicantInboxAliasForDomain,
  generateApplicantInboxAlias,
} from "./inbox/alias";
import { createSupabaseMailboxProvider } from "./france-visas/mailbox-provider";
import {
  startUkSession,
  orchestrateUkFill,
  isUkGateError,
  serializeUkError,
  resumeUkApplication,
} from "./uk";
import { fillVietnamApplication, type FillVietnamResult } from "./vietnam";
import { applyVietnamOfficialLookupEmail } from "./vietnam/official-email";
import {
  activateVietnamStatusTracking,
  enqueueDueVietnamStatusChecks,
  enqueueVietnamEmailTriggeredChecks,
  processQueuedVietnamStatusChecks,
} from "./vietnam/status-tracking";
import { resumeVietnamOfficialPayment } from "./vietnam/payment-resume";
import { consumeVietnamCardSession } from "./vietnam/card-session.js";
import { consumeIndonesiaCardSession } from "./indonesia/card-session.js";
import {
  normalizeVietnamProgressStage,
  shouldPersistVietnamProgressStage,
  type VietnamProgressStage,
} from "./vietnam/progress";
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
import {
  readSubmissionQueueConcurrency,
  runSubmissionQueueBatch,
} from "./queue-scheduler";
import {
  claimBatchLimitForConcurrency,
  claimPendingSubmissionQueueItems,
  isSubmissionQueueClaimRpcUnavailableError,
} from "./submission-queue-claim";
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
import { evaluateSgacSubmissionWindow } from "./sgac/date-window";
import {
  MDAC_OFFICIAL_PORTAL_URL,
  MdacPortalValidationError,
  normalizeMdacPortalPayload,
} from "./mdac/normalize";
import { MdacPortalError, runMdacPortalSubmission } from "./mdac/runner";
import {
  TDAC_OFFICIAL_PORTAL_URL,
  TdacPortalValidationError,
  normalizeTdacPortalPayload,
} from "./tdac/normalize";
import { TdacPortalError, runTdacPortalSubmission } from "./tdac/runner";
import {
  PH_ETRAVEL_OFFICIAL_PORTAL_URL,
  PhEtravelPortalValidationError,
  normalizePhEtravelPortalPayload,
} from "./ph-etravel/normalize";
import { evaluatePhEtravelSubmissionWindow } from "./ph-etravel/date-window";
import { PhEtravelPortalError, runPhEtravelPortalSubmission } from "./ph-etravel/runner";
import { hasOfficialArrivalCardSuccess } from "./arrival-card-success-guard";
import {
  VN_PREARRIVAL_OFFICIAL_PORTAL_URL,
  VnPrearrivalPortalValidationError,
  normalizeVnPrearrivalPortalPayload,
  routeVnPrearrivalEmailAnswers,
} from "./vn-prearrival/normalize";
import { evaluateVietnamPrearrivalSubmissionWindow } from "./vn-prearrival/date-window";
import { VnPrearrivalPortalError, runVietnamPrearrivalPortalSubmission } from "./vn-prearrival/runner";
import {
  choosePhEtravelAccountPlan,
  loadPhEtravelAccount,
  upsertPhEtravelAccount,
} from "./ph-etravel/account";
import { createPhEtravelMailboxProvider } from "./ph-etravel/mailbox-provider";
import {
  INDONESIA_B1_EVOA_PORTAL_URL,
  INDONESIA_C1_PORTAL_URL,
  runIndonesiaLiveSubmission,
} from "./indonesia";
import { hasPreparedIndonesiaPortalAccount } from "./indonesia/managed-account";

const POLL_INTERVAL_MS = Number.parseInt(
  process.env.VIZA_SUBMISSION_POLL_INTERVAL_MS ?? "30000",
  10,
);
const MAX_ATTEMPTS = 3;
const SUBMISSION_QUEUE_WORKER_ID =
  process.env.SUBMISSION_SERVICE_WORKER_ID?.trim() || `submission-service-${process.pid}`;
const parsedSubmissionQueueLeaseSeconds = Number.parseInt(
  process.env.SUBMISSION_SERVICE_QUEUE_LEASE_SECONDS ?? "900",
  10,
);
const SUBMISSION_QUEUE_LEASE_SECONDS = Number.isFinite(parsedSubmissionQueueLeaseSeconds)
  ? Math.max(60, parsedSubmissionQueueLeaseSeconds)
  : 900;
const STALE_QUEUE_TIMEOUT_MS = Number.parseInt(
  process.env.VIZA_SUBMISSION_QUEUE_STALE_MS ?? String(10 * 60 * 1000),
  10,
);
const DS160_LIVE_PROCESSING_TIMEOUT_MS = Math.max(
  STALE_QUEUE_TIMEOUT_MS,
  (Number.parseInt(process.env.DS160_LIVE_MAX_DURATION_SECONDS ?? "1800", 10) + 300) * 1000,
);
const STALE_QUEUE_STATUSES: SubmissionQueueItem["status"][] = [
  "pending",
  "processing",
  "ds160_prefill_pending",
  "ds160_prefill_processing",
  "ds160_live_assisted_pending",
  "ds160_live_assisted_processing",
  "ds160_proof_pending",
  "ds160_proof_processing",
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
  "vn_payment_pending",
  "vn_payment_processing",
  "vn_prearrival_dry_run_pending",
  "vn_prearrival_dry_run_processing",
  "vn_prearrival_live_assisted_scheduled",
  "vn_prearrival_live_assisted_pending",
  "vn_prearrival_live_assisted_processing",
  "sgac_dry_run_pending",
  "sgac_dry_run_processing",
  "sgac_live_assisted_pending",
  "sgac_live_assisted_processing",
  "mdac_dry_run_pending",
  "mdac_dry_run_processing",
  "mdac_live_assisted_pending",
  "mdac_live_assisted_processing",
  "tdac_dry_run_pending",
  "tdac_dry_run_processing",
  "tdac_live_assisted_scheduled",
  "tdac_live_assisted_pending",
  "tdac_live_assisted_processing",
  "id_c1_live_assisted_pending",
  "id_c1_live_assisted_processing",
  "id_c1_payment_processing",
  "id_b1_evoa_live_assisted_pending",
  "id_b1_evoa_live_assisted_processing",
  "id_b1_evoa_payment_processing",
  "phetravel_dry_run_pending",
  "phetravel_dry_run_processing",
  "phetravel_live_assisted_scheduled",
  "phetravel_live_assisted_pending",
  "phetravel_live_assisted_processing",
  "vn_prefill_pending",
  "vn_prefill_processing",
  "au_prefill_pending",
  "au_prefill_processing",
];

function parseProviderAllowlist(): Set<string> {
  const raw =
    process.env.SUBMISSION_SERVICE_PROVIDER_ALLOWLIST?.trim() ||
    process.env.VIZA_SUBMISSION_PROVIDER_ALLOWLIST?.trim() ||
    "";
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

const SUBMISSION_PROVIDER_ALLOWLIST = parseProviderAllowlist();
const TARGET_FAILED_RETRY_ENABLED = /^(1|true|yes|on)$/i.test(
  process.env.SUBMISSION_SERVICE_TARGET_RETRY_FAILED ?? "",
);
const LEGACY_US_APPOINTMENT_POLL_ENABLED = readBooleanEnv(
  "SUBMISSION_SERVICE_LEGACY_US_APPOINTMENT_POLL_ENABLED",
  true,
);
const RUNNER_JOB_CONSUMER_ENABLED = readBooleanEnv(
  "SUBMISSION_SERVICE_RUNNER_JOB_CONSUMER_ENABLED",
  true,
);
// Cloud country workers consume only their runner_job bucket. Keep legacy
// submission_queue polling on by default for backwards-compatible local runs.
const LEGACY_SUBMISSION_QUEUE_ENABLED = readBooleanEnv(
  "SUBMISSION_SERVICE_LEGACY_QUEUE_ENABLED",
  true,
);
const RUNNER_JOB_COUNTRY = process.env.RUNNER_JOB_COUNTRY?.trim().toLowerCase() || undefined;

function isSubmissionDryRunMode(): boolean {
  return process.env.VIZA_SUBMISSION_DRY_RUN === "1";
}

function isDryRunQueueItem(item: SubmissionQueueItem): boolean {
  return (
    item.mode === "dry_run" ||
    item.status.startsWith("vn_dry_run_") ||
    item.status.startsWith("sgac_dry_run_") ||
    item.status.startsWith("mdac_dry_run_") ||
    item.status.startsWith("tdac_dry_run_") ||
    item.status.startsWith("phetravel_dry_run_") ||
    item.status.startsWith("vn_prearrival_dry_run_")
  );
}

function isLiveAssistedQueueItem(item: SubmissionQueueItem): boolean {
  return (
    item.mode === "live_assisted" ||
    item.status.startsWith("ds160_live_assisted_") ||
    item.status.startsWith("ds160_proof_") ||
    item.status.startsWith("france_live_") ||
    item.status.startsWith("vn_live_assisted_") ||
    item.status.startsWith("vn_prearrival_live_assisted_") ||
    item.status.startsWith("sgac_live_assisted_") ||
    item.status.startsWith("mdac_live_assisted_") ||
    item.status.startsWith("tdac_live_assisted_") ||
    item.status.startsWith("id_c1_payment_") ||
    item.status.startsWith("id_c1_live_assisted_") ||
    item.status.startsWith("id_b1_evoa_payment_") ||
    item.status.startsWith("id_b1_evoa_live_assisted_") ||
    item.status.startsWith("phetravel_live_assisted_") ||
    item.provider === "france_visas_live" ||
    item.provider === "vietnam_evisa_live" ||
    item.provider === "vietnam_prearrival_live" ||
    item.provider === "sg_arrival_card_live" ||
    item.provider === "malaysia_mdac_live" ||
    item.provider === "thailand_tdac_live" ||
    item.provider === "indonesia_c1_live" ||
    item.provider === "indonesia_b1_evoa_live" ||
    item.provider === "philippines_etravel_live" ||
    item.provider === "ceac_proof"
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

async function fetchPendingItems(input: {
  concurrency: number;
  targetJobId?: string | null;
}): Promise<SubmissionQueueItem[]> {
  if (input.targetJobId && TARGET_FAILED_RETRY_ENABLED) {
    let query = supabase
      .from("submission_queue")
      .select("*")
      .eq("id", input.targetJobId)
      .in("status", [
        "mdac_live_assisted_failed",
        "tdac_live_assisted_failed",
        "phetravel_live_assisted_failed",
      ])
      .limit(1);
    if (SUBMISSION_PROVIDER_ALLOWLIST.size > 0) {
      query = query.in("provider", Array.from(SUBMISSION_PROVIDER_ALLOWLIST));
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed targeted arrival-card retry select: ${error.message}`);
    }
    return (data ?? []) as SubmissionQueueItem[];
  }

  let items: SubmissionQueueItem[];
  try {
    if (SUBMISSION_PROVIDER_ALLOWLIST.size > 0) {
      let query = supabase
        .from("submission_queue")
        .select("*")
        .in("status", STALE_QUEUE_STATUSES.filter((status) =>
          status.endsWith("_pending") || status.endsWith("_scheduled") || status === "pending"
        ))
        .lt("attempts", MAX_ATTEMPTS)
        .order("created_at", { ascending: true })
        .limit(input.targetJobId ? 1 : claimBatchLimitForConcurrency(input.concurrency));
      if (input.targetJobId) {
        query = query.eq("id", input.targetJobId);
      } else {
        query = query.in("provider", Array.from(SUBMISSION_PROVIDER_ALLOWLIST));
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed provider-filtered submission_queue select: ${error.message}`);
      }
      items = ((data ?? []) as SubmissionQueueItem[]).filter((item) =>
        input.targetJobId ? SUBMISSION_PROVIDER_ALLOWLIST.has(item.provider ?? "") : true,
      );
      return items.sort((left, right) => queuePriority(left) - queuePriority(right));
    }

    items = await claimPendingSubmissionQueueItems(supabase, {
      workerId: SUBMISSION_QUEUE_WORKER_ID,
      limit: input.targetJobId ? 1 : claimBatchLimitForConcurrency(input.concurrency),
      leaseSeconds: SUBMISSION_QUEUE_LEASE_SECONDS,
      targetJobId: input.targetJobId ?? null,
      maxAttempts: MAX_ATTEMPTS,
    });
    if (items.length === 0) {
      items = await selectPendingItemsFallback(input);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isSubmissionQueueClaimRpcUnavailableError(error)) {
      throw error;
    }
    console.warn(`[poll] claim_submission_queue_batch unavailable; using local select fallback: ${message}`);
    items = await selectPendingItemsFallback(input);
  }
  return items.sort((left, right) => queuePriority(left) - queuePriority(right));
}

async function selectPendingItemsFallback(input: {
  concurrency: number;
  targetJobId?: string | null;
}): Promise<SubmissionQueueItem[]> {
  const query = supabase
    .from("submission_queue")
    .select("*")
    .in("status", STALE_QUEUE_STATUSES.filter((status) =>
      status.endsWith("_pending") || status.endsWith("_scheduled") || status === "pending"
    ))
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(input.targetJobId ? 1 : claimBatchLimitForConcurrency(input.concurrency));
  const { data, error: selectError } = input.targetJobId
    ? await query.eq("id", input.targetJobId)
    : await query;
  if (selectError) {
    throw new Error(`Failed fallback submission_queue select: ${selectError.message}`);
  }
  return (data ?? []) as SubmissionQueueItem[];
}

function queuePriority(item: SubmissionQueueItem): number {
  if (item.status === "sgac_live_assisted_scheduled") return 0;
  if (item.status === "sgac_live_assisted_pending") return 0;
  if (item.status === "mdac_live_assisted_scheduled") return 0;
  if (item.status === "mdac_live_assisted_pending") return 0;
  if (item.status === "tdac_live_assisted_scheduled") return 0;
  if (item.status === "tdac_live_assisted_pending") return 0;
  if (item.status === "id_c1_live_assisted_pending") return 0;
  if (item.status === "id_b1_evoa_live_assisted_pending") return 0;
  if (item.status === "phetravel_live_assisted_scheduled") return 0;
  if (item.status === "phetravel_live_assisted_pending") return 0;
  if (item.status === "vn_prearrival_live_assisted_scheduled") return 0;
  if (item.status === "vn_prearrival_live_assisted_pending") return 0;
  if (item.status === "sgac_dry_run_pending") return 1;
  if (item.status === "mdac_dry_run_pending") return 1;
  if (item.status === "tdac_dry_run_pending") return 1;
  if (item.status === "phetravel_dry_run_pending") return 1;
  if (item.status === "vn_prearrival_dry_run_pending") return 1;
  if (item.status === "vn_live_assisted_pending") return 2;
  if (item.status === "vn_dry_run_pending") return 3;
  return 10;
}

function isDs160Job(item: SubmissionQueueItem): boolean {
  return item.status === "ds160_prefill_pending" || item.status === "ds160_live_assisted_pending";
}

function isDs160ProofJob(item: SubmissionQueueItem): boolean {
  return item.status === "ds160_proof_pending" || item.provider === "ceac_proof";
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
  return (
    item.status === "vn_prefill_pending" ||
    item.status === "vn_live_assisted_pending" ||
    item.status === "vn_payment_pending"
  );
}

function isSgacJob(item: SubmissionQueueItem): boolean {
  return item.status === "sgac_live_assisted_pending" || item.status === "sgac_live_assisted_scheduled";
}

function isMdacJob(item: SubmissionQueueItem): boolean {
  return (
    item.status === "mdac_live_assisted_pending" ||
    item.status === "mdac_live_assisted_scheduled" ||
    item.provider === "malaysia_mdac_live"
  );
}

function isTdacJob(item: SubmissionQueueItem): boolean {
  return (
    item.status === "tdac_live_assisted_pending" ||
    item.status === "tdac_live_assisted_scheduled" ||
    item.provider === "thailand_tdac_live"
  );
}

function isPhEtravelJob(item: SubmissionQueueItem): boolean {
  return (
    item.status === "phetravel_live_assisted_pending" ||
    item.status === "phetravel_live_assisted_scheduled" ||
    item.provider === "philippines_etravel_live"
  );
}

function isVietnamPrearrivalJob(item: SubmissionQueueItem): boolean {
  return (
    item.status === "vn_prearrival_live_assisted_pending" ||
    item.status === "vn_prearrival_live_assisted_scheduled" ||
    item.provider === "vietnam_prearrival_live"
  );
}

function isIndonesiaJob(item: SubmissionQueueItem): boolean {
  return (
    item.status === "id_c1_live_assisted_pending" ||
    item.status === "id_b1_evoa_live_assisted_pending" ||
    item.provider === "indonesia_c1_live" ||
    item.provider === "indonesia_b1_evoa_live"
  );
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
const VIETNAM_PREARRIVAL_TYPES = new Set(["VN_PREARRIVAL_DECLARATION"]);

const SINGAPORE_COUNTRY_ALIASES = new Set(["SG", "SINGAPORE"]);
const SG_ARRIVAL_CARD_TYPES = new Set(["SG_ARRIVAL_CARD"]);
const MALAYSIA_COUNTRY_ALIASES = new Set(["MY", "MALAYSIA"]);
const MY_MDAC_TYPES = new Set(["MY_MDAC_ARRIVAL_CARD"]);
const THAILAND_COUNTRY_ALIASES = new Set(["TH", "THAILAND"]);
const TH_TDAC_TYPES = new Set(["TH_TDAC_ARRIVAL_CARD"]);
const PHILIPPINES_COUNTRY_ALIASES = new Set(["PH", "PHILIPPINES"]);
const PH_ETRAVEL_TYPES = new Set(["PH_ETRAVEL_ARRIVAL_CARD", "PH_ETRAVEL_DEPARTURE_CARD"]);

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

function isMalaysiaMdacApplicationMetadata(application: QueueRoutingApplication | null): boolean {
  if (!application) return false;
  return (
    MALAYSIA_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country)) &&
    MY_MDAC_TYPES.has(normalizeQueueRoutingValue(application.visa_type))
  );
}

function isThailandTdacApplicationMetadata(application: QueueRoutingApplication | null): boolean {
  if (!application) return false;
  return (
    THAILAND_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country)) &&
    TH_TDAC_TYPES.has(normalizeQueueRoutingValue(application.visa_type))
  );
}

function isPhilippinesEtravelApplicationMetadata(application: QueueRoutingApplication | null): boolean {
  if (!application) return false;
  return (
    PHILIPPINES_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country)) &&
    PH_ETRAVEL_TYPES.has(normalizeQueueRoutingValue(application.visa_type))
  );
}

function isVietnamPrearrivalApplicationMetadata(application: QueueRoutingApplication | null): boolean {
  if (!application) return false;
  return (
    VIETNAM_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country)) &&
    VIETNAM_PREARRIVAL_TYPES.has(normalizeQueueRoutingValue(application.visa_type))
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

function isMdacQueueItem(
  item: SubmissionQueueItem,
  application: QueueRoutingApplication | null = null,
): boolean {
  return (
    item.status.startsWith("mdac_") ||
    item.provider === "malaysia_mdac_dry_run" ||
    item.provider === "malaysia_mdac_live" ||
    isMalaysiaMdacApplicationMetadata(application)
  );
}

function isTdacQueueItem(
  item: SubmissionQueueItem,
  application: QueueRoutingApplication | null = null,
): boolean {
  return (
    item.status.startsWith("tdac_") ||
    item.provider === "thailand_tdac_dry_run" ||
    item.provider === "thailand_tdac_live" ||
    isThailandTdacApplicationMetadata(application)
  );
}

function isVietnamQueueMetadata(item: SubmissionQueueItem, application: QueueRoutingApplication | null): boolean {
  return (
    (item.status.startsWith("vn_") && !item.status.startsWith("vn_prearrival_")) ||
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
  if (item.status.startsWith("vn_payment_")) return item;

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

function isPhEtravelQueueItem(
  item: SubmissionQueueItem,
  application: QueueRoutingApplication | null = null,
): boolean {
  return (
    item.status.startsWith("phetravel_") ||
    item.provider === "philippines_etravel_dry_run" ||
    item.provider === "philippines_etravel_live" ||
    isPhilippinesEtravelApplicationMetadata(application)
  );
}

function isVietnamPrearrivalQueueItem(
  item: SubmissionQueueItem,
  application: QueueRoutingApplication | null = null,
): boolean {
  return (
    item.status.startsWith("vn_prearrival_") ||
    item.provider === "vietnam_prearrival_dry_run" ||
    item.provider === "vietnam_prearrival_live" ||
    isVietnamPrearrivalApplicationMetadata(application)
  );
}

async function normalizeSgacQueueItem(item: SubmissionQueueItem): Promise<SubmissionQueueItem> {
  const application = await loadQueueRoutingApplication(item.application_id);
  if (!isSgArrivalCardQueueItem(item, application)) return item;
  if (item.status === "sgac_live_assisted_scheduled") return item;

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

async function normalizeDigitalArrivalCardQueueItem(item: SubmissionQueueItem): Promise<SubmissionQueueItem> {
  if (
    TARGET_FAILED_RETRY_ENABLED
    && process.env.SUBMISSION_SERVICE_TARGET_JOB_ID?.trim() === item.id
  ) {
    return item;
  }

  const application = await loadQueueRoutingApplication(item.application_id);
  const isMdac = isMdacQueueItem(item, application);
  const isTdac = isTdacQueueItem(item, application);
  const isPhEtravel = isPhEtravelQueueItem(item, application);
  const isVnPrearrival = isVietnamPrearrivalQueueItem(item, application);
  if (!isMdac && !isTdac && !isPhEtravel && !isVnPrearrival) return item;
  if (isMdac && item.status === "mdac_live_assisted_scheduled") return item;
  if (isTdac && item.status === "tdac_live_assisted_scheduled") return item;
  if (isPhEtravel && item.status === "phetravel_live_assisted_scheduled") return item;
  if (isVnPrearrival && item.status === "vn_prearrival_live_assisted_scheduled") return item;

  const liveRequested = isLiveAssistedQueueItem(item);
  const expectedStatus: SubmissionQueueItem["status"] = isMdac
    ? liveRequested
      ? "mdac_live_assisted_pending"
      : "mdac_dry_run_pending"
    : isTdac
      ? liveRequested
        ? "tdac_live_assisted_pending"
        : "tdac_dry_run_pending"
      : isPhEtravel
        ? liveRequested
          ? "phetravel_live_assisted_pending"
          : "phetravel_dry_run_pending"
        : liveRequested
          ? "vn_prearrival_live_assisted_pending"
          : "vn_prearrival_dry_run_pending";
  const expectedProvider = isMdac
    ? liveRequested
      ? "malaysia_mdac_live"
      : "malaysia_mdac_dry_run"
    : isTdac
      ? liveRequested
        ? "thailand_tdac_live"
        : "thailand_tdac_dry_run"
      : isPhEtravel
        ? liveRequested
          ? "philippines_etravel_live"
          : "philippines_etravel_dry_run"
        : liveRequested
          ? "vietnam_prearrival_live"
          : "vietnam_prearrival_dry_run";
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
    console.error(`[arrival-card] Failed to normalize queue ${redactIdentifier(item.id)}: ${error.message}`);
    return item;
  }

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

  const normalizedDocuments = ((documents ?? []) as Array<ApplicationDocument & { filename?: string | null }>).map((doc) => ({
    ...doc,
    file_name: doc.file_name ?? doc.filename ?? null,
  }));

  return { profile, application, documents: normalizedDocuments };
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

function firstLocalDocumentPath(
  localDocPaths: Map<string, string>,
  documentTypes: readonly string[]
): string | undefined {
  for (const documentType of documentTypes) {
    const localPath = localDocPaths.get(documentType);
    if (localPath) return localPath;
  }
  return undefined;
}

async function loadReusableApplicantDocuments(
  applicantId: string,
  currentApplicationId: string,
  currentDocuments: ApplicationDocument[],
): Promise<ApplicationDocument[]> {
  const documentsById = new Map<string, ApplicationDocument>();
  for (const doc of currentDocuments) {
    documentsById.set(doc.id, doc);
  }

  const { data: applications, error: appError } = await supabase
    .from("applications")
    .select("id")
    .eq("applicant_id", applicantId);
  if (appError) {
    console.warn(`[indonesia] Could not load sibling applications for reusable documents: ${appError.message}`);
    return Array.from(documentsById.values());
  }

  const applicationIds = ((applications ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter((id) => id && id !== currentApplicationId);
  if (applicationIds.length === 0) return Array.from(documentsById.values());

  const { data: siblingDocs, error: docsError } = await supabase
    .from("application_documents")
    .select("*")
    .in("application_id", applicationIds);
  if (docsError) {
    console.warn(`[indonesia] Could not load reusable applicant documents: ${docsError.message}`);
    return Array.from(documentsById.values());
  }

  for (const doc of (siblingDocs ?? []) as Array<ApplicationDocument & { filename?: string | null }>) {
    documentsById.set(doc.id, {
      ...doc,
      file_name: doc.file_name ?? doc.filename ?? null,
    });
  }
  return Array.from(documentsById.values());
}

function firstLocalDocumentPathMatching(
  localDocPaths: Map<string, string>,
  patterns: readonly RegExp[],
): string | undefined {
  const matches = Array.from(localDocPaths.entries()).filter(([documentType]) =>
    patterns.some((pattern) => pattern.test(documentType)),
  );
  const imageMatch = matches.find(([, localPath]) =>
    /\.(?:jpe?g|png|webp)$/i.test(localPath),
  );
  if (imageMatch) return imageMatch[1];
  const nonPdfMatch = matches.find(([, localPath]) => !/\.pdf$/i.test(localPath));
  if (nonPdfMatch) return nonPdfMatch[1];
  return matches[0]?.[1];
}

async function downloadLatestUserPhotoDocument(
  authUserId: string | null | undefined,
  tempDir: string,
): Promise<string | undefined> {
  if (!authUserId) return undefined;

  const { data: folders, error: folderError } = await supabase.storage
    .from("application-documents")
    .list(authUserId, { limit: 100 });
  if (folderError) {
    console.warn(`[phetravel] Could not list user photo folders: ${folderError.message}`);
    return undefined;
  }

  const candidates: Array<{ path: string; createdAt: string }> = [];
  for (const folder of folders ?? []) {
    if (folder.metadata?.size) continue;
    const { data: files, error: fileError } = await supabase.storage
      .from("application-documents")
      .list(`${authUserId}/${folder.name}/photo`, { limit: 20 });
    if (fileError) continue;
    for (const file of files ?? []) {
      if (!/\.(?:jpe?g|png|webp)$/i.test(file.name)) continue;
      candidates.push({
        path: `${authUserId}/${folder.name}/photo/${file.name}`,
        createdAt: file.created_at ?? file.updated_at ?? "",
      });
    }
  }

  candidates.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const latest = candidates[0];
  if (!latest) return undefined;

  const { data, error } = await supabase.storage
    .from("application-documents")
    .download(latest.path);
  if (error || !data) {
    console.warn(`[phetravel] Could not download reusable user photo: ${error?.message}`);
    return undefined;
  }

  const ext = path.extname(latest.path) || ".jpg";
  const localPath = path.join(tempDir, `ph-etravel-profile-photo${ext}`);
  fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
  console.log("[phetravel] Reusing latest user photo for eGovPH profile onboarding.");
  return localPath;
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
  if (status.startsWith("ds160_proof_")) return "ds160_proof_failed";
  if (status.startsWith("ds160_")) return "ds160_prefill_failed";
  if (status.startsWith("fv_")) return "fv_prefill_failed";
  if (status.startsWith("uk_")) return "uk_prefill_failed";
  if (status.startsWith("vn_live_assisted_")) return "vn_live_assisted_failed";
  if (status.startsWith("vn_dry_run_")) return "vn_dry_run_failed";
  if (status.startsWith("vn_prearrival_live_assisted_")) return "vn_prearrival_live_assisted_failed";
  if (status.startsWith("vn_prearrival_dry_run_")) return "vn_prearrival_dry_run_failed";
  if (status.startsWith("vn_prearrival_")) return "vn_prearrival_blocked";
  if (status.startsWith("vn_")) return "vn_prefill_failed";
  if (status.startsWith("sgac_live_assisted_")) return "sgac_live_assisted_failed";
  if (status.startsWith("sgac_dry_run_")) return "sgac_dry_run_failed";
  if (status.startsWith("sgac_")) return "sgac_blocked";
  if (status.startsWith("mdac_live_assisted_")) return "mdac_live_assisted_failed";
  if (status.startsWith("mdac_dry_run_")) return "mdac_dry_run_failed";
  if (status.startsWith("mdac_")) return "mdac_blocked";
  if (status.startsWith("tdac_live_assisted_")) return "tdac_live_assisted_failed";
  if (status.startsWith("tdac_dry_run_")) return "tdac_dry_run_failed";
  if (status.startsWith("tdac_")) return "tdac_blocked";
  if (status.startsWith("id_c1_live_assisted_")) return "id_c1_live_assisted_failed";
  if (status.startsWith("id_c1_payment_")) return "id_c1_payment_failed";
  if (status.startsWith("id_b1_evoa_live_assisted_")) return "id_b1_evoa_live_assisted_failed";
  if (status.startsWith("id_b1_evoa_payment_")) return "id_b1_evoa_payment_failed";
  if (status.startsWith("phetravel_live_assisted_")) return "phetravel_live_assisted_failed";
  if (status.startsWith("phetravel_dry_run_")) return "phetravel_dry_run_failed";
  if (status.startsWith("phetravel_")) return "phetravel_blocked";
  if (status.startsWith("au_")) return "au_prefill_failed";
  return "failed";
}

function isPendingQueueStatus(status: SubmissionQueueItem["status"]): boolean {
  return status === "pending" || status.endsWith("_pending");
}

function timeoutForQueueStatus(status: SubmissionQueueItem["status"]): number {
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
    if (isPendingQueueStatus(item.status)) return false;
    const timeoutMs = timeoutForQueueStatus(item.status);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return false;
    const cutoffMs = Date.now() - timeoutMs;
    const lastTouched = item.updated_at || item.created_at;
    const touchedMs = lastTouched ? Date.parse(lastTouched) : Number.NaN;
    return Number.isFinite(touchedMs) && touchedMs < cutoffMs;
  });
  for (const item of staleItems) {
    const timeoutMs = timeoutForQueueStatus(item.status);
    const timedOutStatus = failedStatusForQueueStatus(item.status);
    const reason = `Submission job failed: worker heartbeat stopped for ${Math.round(timeoutMs / 1000)}s in status ${item.status}.`;
    await supabase
      .from("submission_queue")
      .update({
        status: timedOutStatus,
        attempts: Math.max(item.attempts, MAX_ATTEMPTS),
        last_error: reason,
        error_code: "queue_processing_timed_out",
        error_message: reason,
        current_stage: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await markSubmissionFailed(item.application_id, reason);
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

type Ds160ProofLocalPaths = {
  confirmationPdfPath?: string;
  applicationPdfPath?: string;
  emailConfirmationPdfPath?: string;
};

type Ds160ProofStoragePaths = {
  confirmationPdfStoragePath?: string;
  applicationPdfStoragePath?: string;
  emailConfirmationPdfStoragePath?: string;
};

async function captureDs160ProofArtifacts(
  page: import("@playwright/test").Page,
  tempDir: string,
): Promise<Ds160ProofLocalPaths> {
  const paths: Ds160ProofLocalPaths = {};
  const confirmationPdfPath = path.join(tempDir, "ds160-confirmation.pdf");
  try {
    await page.emulateMedia({ media: "print" }).catch(() => undefined);
    await page.pdf({
      path: confirmationPdfPath,
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
    });
    paths.confirmationPdfPath = confirmationPdfPath;
    // This is the same official confirmation content CEAC's Email
    // Confirmation action sends. We expose it as a downloadable copy instead
    // of triggering an outbound CEAC email from the worker.
    paths.emailConfirmationPdfPath = confirmationPdfPath;
  } catch (err) {
    console.warn(
      `[ds160] Could not capture confirmation PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const printApplicationButton = page
    .locator(
      [
        'input[type="submit"][value*="Print Application" i]',
        'input[type="button"][value*="Print Application" i]',
        'button:has-text("Print Application")',
        'a:has-text("Print Application")',
      ].join(", "),
    )
    .first();
  if ((await printApplicationButton.count().catch(() => 0)) === 0) {
    return paths;
  }
  const printApplicationDisabled = await printApplicationButton
    .evaluate((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLButtonElement) {
        return element.disabled;
      }
      return element.getAttribute("aria-disabled") === "true";
    })
    .catch(() => false);
  if (printApplicationDisabled) {
    console.warn("[ds160] CEAC Print Application control is disabled on the submitted confirmation page.");
    return paths;
  }

  const applicationPdfPath = path.join(tempDir, "ds160-application.pdf");
  try {
    await page.evaluate(() => {
      window.print = () => undefined;
    }).catch(() => undefined);
    const popupPromise = page.waitForEvent("popup", { timeout: 8_000 }).catch(() => null);
    try {
      await printApplicationButton.click({ force: true, timeout: 10_000 });
    } catch {
      await printApplicationButton.evaluate((element) => {
        if (element instanceof HTMLElement) element.click();
      });
    }
    const popup = await popupPromise;
    if (popup) {
      await popup.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => undefined);
      await popup.pdf({
        path: applicationPdfPath,
        format: "Letter",
        printBackground: true,
        preferCSSPageSize: true,
      });
      await popup.close().catch(() => undefined);
      paths.applicationPdfPath = applicationPdfPath;
    }
  } catch (err) {
    console.warn(
      `[ds160] Could not capture application PDF from CEAC Print Application: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return paths;
}

async function uploadDs160ProofArtifacts(
  localPaths: Ds160ProofLocalPaths,
  applicationId: string,
  authUserId: string,
): Promise<Ds160ProofStoragePaths> {
  const uploaded: Ds160ProofStoragePaths = {};

  if (localPaths.confirmationPdfPath && fs.existsSync(localPaths.confirmationPdfPath)) {
    uploaded.confirmationPdfStoragePath = await uploadArtifact({
      authUserId,
      applicationId,
      country: "US",
      kind: "confirmation",
      ext: "pdf",
      contentType: "application/pdf",
      filePath: localPaths.confirmationPdfPath,
    });
  }

  if (localPaths.applicationPdfPath && fs.existsSync(localPaths.applicationPdfPath)) {
    uploaded.applicationPdfStoragePath = await uploadArtifact({
      authUserId,
      applicationId,
      country: "US",
      kind: "application",
      ext: "pdf",
      contentType: "application/pdf",
      filePath: localPaths.applicationPdfPath,
    });
  }

  if (localPaths.emailConfirmationPdfPath && fs.existsSync(localPaths.emailConfirmationPdfPath)) {
    uploaded.emailConfirmationPdfStoragePath =
      uploaded.confirmationPdfStoragePath ??
      await uploadArtifact({
        authUserId,
        applicationId,
        country: "US",
        kind: "email-confirmation",
        ext: "pdf",
        contentType: "application/pdf",
        filePath: localPaths.emailConfirmationPdfPath,
      });
  }

  return uploaded;
}

async function processDs160ProofItem(
  item: SubmissionQueueItem,
  config: Ds160SubmissionConfig,
): Promise<void> {
  const runId = createRunId("ds160-proof");
  console.log(
    `[ceac-proof] Starting proof recovery ${runId} for application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: "ds160_proof_processing",
      current_stage: "retrieving_confirmation",
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ceac-proof-"));
  let session: Awaited<ReturnType<typeof startCeacSession>> | null = null;
  const heartbeatTimer = setInterval(() => {
    void supabase
      .from("submission_queue")
      .update({
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id)
      .eq("status", "ds160_proof_processing");
  }, 60_000);

  try {
    const { profile } = await loadApplicantData(item.application_id);
    const { data: application, error } = await supabase
      .from("applications")
      .select("submission_result")
      .eq("id", item.application_id)
      .single();
    if (error) throw new Error(`Failed to load submitted DS-160 result: ${error.message}`);
    const currentResult = application?.submission_result as Partial<UsSubmissionResult> | null;
    if (!currentResult || currentResult.country !== "US" || currentResult.status !== "submitted") {
      throw new Error("DS-160 proof recovery requires an existing submitted US result.");
    }
    const securityAnswer =
      currentResult.securityAnswer ??
      (currentResult.securityAnswerCipher ? decryptSecret(currentResult.securityAnswerCipher) : null);
    if (!securityAnswer) {
      throw new Error("DS-160 proof recovery requires the stored security answer.");
    }

    session = await startCeacSession({
      headless: config.playwrightHeadless,
      acceptDownloads: true,
      runId,
      captchaMaxAttempts: 3,
    });
    await session.page.goto(retrievalUrlFor(currentResult.applicationId ?? ""), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await fillRetrieveApplicationForm(session.page, {
      applicationId: currentResult.applicationId ?? "",
      surnameFirstFive: currentResult.surnameFirst5 ?? "",
      yearOfBirth: String(currentResult.yearOfBirth ?? ""),
      securityAnswer,
    });
    await waitForDs160ConfirmationPage(session.page);

    const ownerId = profile.auth_user_id ?? profile.id;
    const proofStoragePaths = await uploadDs160ProofArtifacts(
      await captureDs160ProofArtifacts(session.page, tempDir),
      item.application_id,
      ownerId,
    );
    const merged = mergeUsProofStoragePaths(currentResult, proofStoragePaths);
    await writeSubmissionResult(item.application_id, merged, "submitted");

    await supabase
      .from("submission_queue")
      .update({
        status: "done",
        current_stage: "proof_artifacts_ready",
        ceac_result_payload: {
          status: "proof_artifacts_ready",
          proofStoragePaths,
          captchaSolve: session.captchaSolve?.telemetry ?? [],
        },
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    console.log(
      `[ceac-proof] Proof recovery ${runId} completed for application=${redactIdentifier(item.application_id)}`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newAttempts = item.attempts + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? "ds160_proof_failed" : "ds160_proof_pending";
    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        error_code: "ds160_proof_recovery_failed",
        error_message: errorMsg,
        current_stage: "proof_recovery_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    console.error(
      `[ceac-proof] Proof recovery ${runId} failed for application=${redactIdentifier(item.application_id)}: ${errorMsg}`,
    );
  } finally {
    clearInterval(heartbeatTimer);
    if (session) await session.close();
    if (process.env.DS160_KEEP_TEMP === "1") {
      console.warn(`[ceac-proof] Keeping temp dir for diagnostics: ${tempDir}`);
    } else {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup */ }
    }
  }
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
    const { profile, documents } = await loadApplicantData(item.application_id);
    const answers = await loadDs160Answers(item.application_id, { prepareForCeac: true });
    const startLocationCode = resolveCeacStartLocationCode(answers);
    const photoDocument = selectDs160PhotoDocument(documents);
    const documentPaths = photoDocument
      ? await downloadDocuments([photoDocument], tempDir)
      : new Map<string, string>();
    const photoFile = buildPhotoFileFromDownloadedDocument(photoDocument, documentPaths);
    const passportNumberForSignature = answers["passport_number"]?.trim();

    if (liveAssisted && !photoFile) {
      throw new Error("DS-160 live submission requires an uploaded applicant photo before CEAC submission.");
    }

    if (liveAssisted && !passportNumberForSignature) {
      throw new Error("DS-160 live submission requires passport_number for the final signature step.");
    }

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
    // checkpoints, .dat capture, photo upload, and final Sign and Submit.
    const { result, datArtifact, sectionCoverage } = await orchestrateFill(session, {
      answers,
      profile: profile as unknown as Record<string, unknown>,
      tracker,
      runId,
      outputDir: tempDir,
      photo: photoFile,
      finalSubmit: passportNumberForSignature
        ? { passportNumber: passportNumberForSignature }
        : undefined,
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

    if (isSubmittedResult(result)) {
      await supabase
        .from("submission_queue")
        .update({
          status: "ds160_submitted",
          current_stage: "submitted",
          ceac_result_payload: { ...result, sectionCoverage, ...captchaTelemetry } as unknown as Record<string, unknown>,
          live_submitted_at: result.submittedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      const applicationId = result.applicationId ?? confirm.applicationId;
      const ownerId = profile.auth_user_id ?? profile.id;
      const proofStoragePaths = await uploadDs160ProofArtifacts(
        await captureDs160ProofArtifacts(session.page, tempDir),
        item.application_id,
        ownerId,
      );
      const usPayload: UsSubmissionResult = {
        country: "US",
        status: "submitted",
        applicationId,
        confirmationNumber: result.confirmationNumber ?? applicationId,
        submittedAt: result.submittedAt,
        surnameFirst5: surnameFirstFive,
        yearOfBirth: Number(yearOfBirth) || 0,
        securityQuestion: confirm.securityQuestionText,
        securityAnswerCipher: encryptSecret(confirm.securityAnswer),
        embassyOrConsulate:
          answers["consular_post"] ??
          answers["embassy_or_consulate"] ??
          answers["location_where_applying_for_visa"] ??
          "Pending — confirm at appointment",
        retrievalUrl: `https://ceac.state.gov/GenNIV/Default.aspx?ApplicationID=${applicationId}`,
        ...(storagePath ? { datStoragePath: storagePath } : {}),
        ...proofStoragePaths,
        finalSubmissionMode: "external_verified",
        evidence: {
          source: "ceac_confirmation_page",
          submittedAt: result.submittedAt,
          confirmationText:
            "This confirms the submission of the Nonimmigrant visa application for:",
        },
      };
      await writeSubmissionResult(item.application_id, usPayload, "submitted");

      console.log(
        `[ceac] Run ${runId} submitted for application=${redactIdentifier(item.application_id)} ceac=${redactIdentifier(applicationId)}`,
      );
    } else if (isSuccessResult(result)) {
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
    if (process.env.DS160_KEEP_TEMP === "1") {
      console.warn(`[ceac] Keeping temp dir for diagnostics: ${tempDir}`);
    } else {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup */ }
    }
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

function missingColumnNameFromPostgrestError(error: { message?: string; code?: string }): string | null {
  const message = error.message ?? "";
  const quoted = message.match(/Could not find the '([^']+)' column/i);
  if (quoted?.[1]) return quoted[1];
  const dotted = message.match(/column\s+(?:public\.)?submission_queue\.([a-z0-9_]+)/i);
  if (dotted?.[1]) return dotted[1];
  if (error.code === "PGRST204") {
    const plain = message.match(/\b([a-z][a-z0-9_]+)\b(?=.*schema cache)/i);
    return plain?.[1] ?? null;
  }
  return null;
}

async function updateSubmissionQueueCompat(
  queueId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const remaining = { ...payload };
  const removed = new Set<string>();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabase
      .from("submission_queue")
      .update(remaining)
      .eq("id", queueId);
    if (!error) return;

    const missingColumn = missingColumnNameFromPostgrestError(error);
    if (!missingColumn || !(missingColumn in remaining) || removed.has(missingColumn)) {
      throw new Error(`submission_queue update failed: ${error.message}`);
    }

    delete remaining[missingColumn];
    removed.add(missingColumn);
    console.warn(
      `[queue] submission_queue.${missingColumn} is not available in this schema; retrying without it.`,
    );
  }

  throw new Error("submission_queue update failed after removing unsupported columns.");
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
  const writeFvStage = async (
    currentStage: string,
    patch: Record<string, unknown> = {},
  ): Promise<void> => {
    const now = new Date().toISOString();
    await updateSubmissionQueueCompat(item.id, {
      current_stage: currentStage,
      heartbeat_at: now,
      updated_at: now,
      ...patch,
    });
  };

  await writeFvStage("starting", {
    status: liveAssisted ? "france_live_processing" : "fv_prefill_processing",
    mode: liveAssisted ? "live_assisted" : "dry_run",
    provider: liveAssisted ? "france_visas_live" : "france_visas_dry_run",
    manual_action_status: liveAssisted ? null : undefined,
    live_started_at: liveAssisted ? new Date().toISOString() : undefined,
    live_checkpoint: liveAssisted ? null : undefined,
  });
  await setSubmissionStatus(item.application_id, "processing");

  const heartbeatTimer = setInterval(() => {
    const now = new Date().toISOString();
    void updateSubmissionQueueCompat(item.id, {
      heartbeat_at: now,
      updated_at: now,
    }).catch((error) => {
      console.warn(
        `[fv] Heartbeat update failed for queue=${redactIdentifier(item.id)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }, 45_000);

  try {
    await writeFvStage("loading_application_data");
    const { profile, application, documents } = await loadApplicantData(item.application_id);
    await writeFvStage("loading_answers");
    const rawAnswers = await loadRawAnswers(item.application_id);
    const answerMap = buildAnswerMap(rawAnswers);

    await writeFvStage("loading_official_account");
    let account = await loadFvAccount(application.applicant_id, item.application_id, item.id);
    if (!account) {
      if (liveAssisted) {
        try {
          await writeFvStage("account_registration", {
            live_checkpoint: "account_registration",
            official_status: "account_registration_in_progress",
          });
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

    await writeFvStage("normalizing_answers");
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
    await writeFvStage("running_official_portal");
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
        continueAfterConfirmation:
          liveAssisted && process.env.FRANCE_CONTINUE_AFTER_CONFIRMATION_ENABLED !== "false",
        stepTimeoutMs: Math.min(config.liveMaxDurationSeconds * 1000, 30 * 60 * 1000),
        onOfficialPortalOpened: liveAssisted
          ? async ({ url }) => {
              const now = new Date().toISOString();
              await updateSubmissionQueueCompat(item.id, {
                  status: "france_live_official_portal_opened",
                  current_stage: "official_portal_opened",
                  heartbeat_at: now,
                  official_status: "official_portal_opened",
                  official_confirmation_url: url,
                  updated_at: now,
                });
            }
          : undefined,
      },
    );

    if (result.status === "prefilled") {
      await writeFvStage("official_record_confirmed");
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
      const lodgedAtVisaCentre =
        liveAssisted && result.postConfirmationContinue?.clickedSubmitToVisaCenter === true;

      await updateSubmissionQueueCompat(item.id, {
          status: "fv_prefilled",
          current_stage: lodgedAtVisaCentre ? "submitted_to_visa_center" : liveAssisted ? "submitted" : "prefilled",
          heartbeat_at: new Date().toISOString(),
          last_error: null,
          error_code: null,
          error_message: null,
          mode: liveAssisted ? "live_assisted" : "dry_run",
          provider: liveAssisted ? "france_visas_live" : "france_visas_dry_run",
          fv_result_payload: result as unknown as Record<string, unknown>,
          official_application_id_encrypted: officialReferenceCipher,
          official_application_reference_encrypted: officialReferenceCipher,
          review_diff_status: liveAssisted ? "not_run" : "not_run",
          manual_action_status: liveAssisted ? "completed" : null,
          payment_status: liveAssisted ? "manual_required" : "manual_required",
          appointment_status: lodgedAtVisaCentre ? "booked" : "manual_required",
          official_status: lodgedAtVisaCentre
            ? "lodged_at_visa_centre"
            : liveAssisted ? "official_record_confirmed" : "draft_prefilled",
          fv_application_reference: liveAssisted ? null : result.applicationReference,
          fv_pdf_storage_path: pdfStoragePath,
          updated_at: new Date().toISOString(),
        });

      // User-facing FrSubmissionResult. In live mode the runner continues
      // through the France-Visas visa-center handoff when the official page
      // exposes it, then surfaces the full reference plus downloadable PDF as
      // proof. Offline payment/biometrics still happen at the visa center.
      const frPayload: FrSubmissionResult = {
        country: "FR",
        status: lodgedAtVisaCentre ? "submitted" : liveAssisted ? "final_review_required" : "stopped_at_pay",
        mode: liveAssisted ? "live_assisted" : "dry_run",
        provider: liveAssisted ? "france_visas_live" : "france_visas_dry_run",
        applicationReference: officialReference,
        reviewDiffStatus: liveAssisted ? "not_run" : undefined,
        manualAction: undefined,
        paymentStatus: "manual_required",
        appointmentStatus: lodgedAtVisaCentre ? "booked" : "manual_required",
        officialStatus: lodgedAtVisaCentre
          ? "lodged_at_visa_centre"
          : liveAssisted ? "official_record_confirmed" : "draft_prefilled",
        fieldFallbacks: result.fieldFallbacks,
        postConfirmationContinue: result.postConfirmationContinue,
        ...(pdfStoragePath ? { printablePdfStoragePath: pdfStoragePath } : {}),
      };
      await writeSubmissionResult(
        item.application_id,
        frPayload,
        liveAssisted ? "completed" : "stopped_at_pay",
      );
      const logReference = liveAssisted && officialReference
        ? redactOfficialReference(officialReference)
        : result.applicationReference ?? "(none)";
      console.log(`[fv] Run ${runId} prefilled — ref=${logReference}, pdf=${pdfStoragePath ?? "(none)"}`);
    } else {
      await writeFvStage("official_portal_failed");
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

      await updateSubmissionQueueCompat(item.id, {
          status: newStatus,
          current_stage: result.failedStep ?? "failed",
          heartbeat_at: new Date().toISOString(),
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
        });

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

    await updateSubmissionQueueCompat(item.id, {
        status: newStatus,
        current_stage: isNormalizationFailure
          ? "normalization_failed"
          : isGateFailure
            ? (manualActionType ?? "manual_action_required")
            : "failed",
        heartbeat_at: new Date().toISOString(),
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
      });

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
  } finally {
    clearInterval(heartbeatTimer);
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
    captchaSolves: diagnostics.captchaSolves,
    validationErrors: diagnostics.validationErrors,
    fieldFallbacks: diagnostics.fieldFallbacks,
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

  if (result.status === "submitted_pending_pay" || result.status === "submitted_paid") {
    return {
      ...base,
      registrationCodeCaptured: true,
      submittedAtIso: result.submittedAtIso,
      fieldsFilled: result.fieldsFilled,
      fieldsSkipped: result.fieldsSkipped,
      fieldFallbacks: result.fieldFallbacks,
      ...(result.status === "submitted_paid"
        ? {
            paymentReceiptReference: result.paymentReceiptReference,
            redactedCard: result.redactedCard,
          }
        : {}),
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

const DEFAULT_INDONESIA_ALIAS_DOMAIN = "haggstorm.com";

function parseAliasDomain(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  const at = normalized.lastIndexOf("@");
  if (at < 0 || at === normalized.length - 1) return null;
  return normalized.slice(at + 1);
}

function normalizeAliasDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\./, "")
    .replace(/^@/, "");
}

function parseIndonesiaManagedAliasDomains(currentDomain: string | null): string[] {
  const domains: string[] = [];
  const envValue = process.env.INDONESIA_MANAGED_ALIAS_DOMAINS;
  const legacyValue = process.env.INDONESIA_MANAGED_ALIAS_DOMAIN;

  const collect = (value: string | undefined) => {
    if (!value) return;
    value
      .split(/[,\s;|]+/)
      .map((domain) => normalizeAliasDomain(domain))
      .filter(Boolean)
      .forEach((domain) => {
        if (!domains.includes(domain)) {
          domains.push(domain);
        }
      });
  };

  collect(envValue);
  if (domains.length === 0) {
    collect(legacyValue);
  }
  if (domains.length === 0) {
    domains.push(DEFAULT_INDONESIA_ALIAS_DOMAIN);
  }

  const normalizedCurrent = normalizeAliasDomain(currentDomain ?? "");
  if (normalizedCurrent && !domains.includes(normalizedCurrent)) {
    domains.unshift(normalizedCurrent);
  }
  return domains;
}

function isManagedIndonesiaAliasEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return /^appl-[0-9a-z]{26}@/.test(normalized);
}

function shouldRotateIndonesiaAlias(result: { status?: string; actionType?: string | null; message?: string; actionInstructions?: string | null }, managedEmail: string): boolean {
  if (!managedEmail || !isManagedIndonesiaAliasEmail(managedEmail)) return false;
  if (result.status !== "action_required") return false;
  if (result.actionType !== "official_account_registration_form_reached") return false;
  const haystack = `${result.actionType ?? ""} ${result.message ?? ""} ${result.actionInstructions ?? ""}`.toLowerCase();
  return (
    /indonesia_account_email_verification_not_found_yet/.test(haystack) ||
    /silahkan\s+periksa\s+kembali\s+email/.test(haystack) ||
    /check\s+your\s+email/.test(haystack) ||
    /indonesia_account_registration_errors/.test(haystack)
  );
}

function generatePhEtravelMpin(): string {
  const value = randomBytes(4).readUInt32BE(0) % 1_000_000;
  return value.toString().padStart(6, "0");
}

function derivePhEtravelAccountEmail(baseAlias: string): string {
  const [localPart, domain] = baseAlias.toLowerCase().split("@");
  if (!localPart || !domain) return baseAlias.toLowerCase();
  return `${localPart}-ph${randomBytes(3).toString("hex")}@${domain}`;
}

const PH_ETRAVEL_RETRYABLE_ACCOUNT_ERROR_CODES = new Set([
  "ph_etravel_official_account_required",
  "ph_etravel_official_login_verification_required",
  "ph_etravel_official_mpin_invalid",
  "ph_etravel_official_registration_verification_required",
  "ph_etravel_registration_turnstile_blocked",
  "ph_etravel_registration_request_rejected",
  "ph_etravel_registration_otp_continue_disabled",
  "ph_etravel_otp_continue_disabled",
]);

function isRetryablePhEtravelPortalError(error: unknown): error is PhEtravelPortalError {
  if (!(error instanceof PhEtravelPortalError)) return false;
  return PH_ETRAVEL_RETRYABLE_ACCOUNT_ERROR_CODES.has(error.code);
}

async function loadOrCreatePhEtravelAccountPlan(input: {
  applicantId: string;
  forceCreateNew?: boolean;
  existingAccount?: Awaited<ReturnType<typeof loadPhEtravelAccount>>;
}): Promise<ReturnType<typeof choosePhEtravelAccountPlan>> {
  const alias = await ensureApplicantInboxAlias(input.applicantId);
  const aliasEmail = derivePhEtravelAccountEmail(alias.alias);
  const generatedPassword = `VizaPH-${randomBytes(9).toString("base64url")}9!`;
  const generatedMpin = generatePhEtravelMpin();

  return choosePhEtravelAccountPlan({
    existingAccount: input.forceCreateNew ? null : input.existingAccount,
    aliasEmail,
    generatedPassword,
    generatedMpin,
  });
}

async function markPhEtravelPlanFailed(input: {
  applicantId: string;
  plan: ReturnType<typeof choosePhEtravelAccountPlan>;
}): Promise<void> {
  await upsertPhEtravelAccount({
    applicantId: input.applicantId,
    email: input.plan.email,
    password: input.plan.password,
    mpin: input.plan.mpin,
    status: "failed",
  });
}

type VnOfficialFeeIntentRow = {
  id: string;
  user_id: string;
  fee_quote_id: string | null;
  mode: string | null;
  provider: string | null;
  official_fee_amount: number | string | null;
  official_fee_currency: string | null;
  status: string | null;
};

function readVnRegistrationCodeFromResult(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const code = (value as { registrationCode?: unknown }).registrationCode;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

async function loadVnRegistrationCode(applicationId: string, item: SubmissionQueueItem): Promise<string | null> {
  if (item.vn_registration_code_encrypted) {
    try {
      return decryptSecret(item.vn_registration_code_encrypted);
    } catch {
      return null;
    }
  }
  const { data } = await supabase
    .from("applications")
    .select("submission_result")
    .eq("id", applicationId)
    .maybeSingle();
  return readVnRegistrationCodeFromResult((data as { submission_result?: unknown } | null)?.submission_result);
}

async function getVietnamOfficialLookupEmail(applicantId: string): Promise<string> {
  const alias = await ensureApplicantInboxAlias(applicantId);
  return alias.alias.trim().toLowerCase();
}

function readAnswerValue(
  answers: Record<string, string>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = answers[key]?.trim();
    if (value) return value;
  }
  return null;
}

async function activatePaidVietnamTracking(
  applicationId: string,
  officialLookupEmail?: string,
): Promise<void> {
  const { profile } = await loadApplicantData(applicationId);
  const lookupEmail =
    officialLookupEmail ?? (await getVietnamOfficialLookupEmail(profile.id));
  await activateVietnamStatusTracking({
    applicationId,
    applicantId: profile.id,
    authUserId: profile.auth_user_id,
    officialLookupEmail: lookupEmail,
  });
}

async function getLatestVnOfficialFeeIntent(applicationId: string): Promise<VnOfficialFeeIntentRow | null> {
  const { data, error } = await supabase
    .from("official_fee_payment_intents")
    .select("id, user_id, fee_quote_id, mode, provider, official_fee_amount, official_fee_currency, status")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to load official fee intent: ${error.message}`);
  }
  return (data ?? null) as VnOfficialFeeIntentRow | null;
}

async function nextOfficialFeeAttemptNumber(intentId: string): Promise<number> {
  const { data, error } = await supabase
    .from("official_fee_payment_attempts")
    .select("attempt_number")
    .eq("official_fee_payment_intent_id", intentId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Failed to load official fee attempts: ${error.message}`);
  const first = (data ?? [])[0] as { attempt_number?: number | string } | undefined;
  const current = Number(first?.attempt_number ?? 0);
  return Number.isFinite(current) ? current + 1 : 1;
}

async function insertVnOfficialFeeAttempt(input: {
  applicationId: string;
  intent: VnOfficialFeeIntentRow;
  status: "manual_review" | "succeeded" | "failed";
  registrationCode: string | null;
  message: string;
  receiptNumber?: string | null;
  receiptUrl?: string | null;
  screenshotUrl?: string | null;
}): Promise<{ attemptId: string; receiptId: string | null }> {
  const now = new Date().toISOString();
  const amount = Number(input.intent.official_fee_amount ?? 25);
  const currency = input.intent.official_fee_currency ?? "USD";
  const attemptNumber = await nextOfficialFeeAttemptNumber(input.intent.id);
  const { data: attempt, error: attemptError } = await supabase
    .from("official_fee_payment_attempts")
    .insert({
      official_fee_payment_intent_id: input.intent.id,
      application_id: input.applicationId,
      attempt_number: attemptNumber,
      provider: input.intent.provider ?? "vietnam_evisa_official_fee",
      mode: input.intent.mode ?? "manual",
      status: input.status,
      request_payload_redacted_json: {
        application_id: input.applicationId,
        registration_code_present: Boolean(input.registrationCode),
        amount,
        currency,
        provider: input.intent.provider,
      },
      response_payload_redacted_json: {
        message: input.message,
        dry_run_only: input.status === "succeeded" && process.env.VN_OFFICIAL_PAYMENT_DRY_RUN_RECEIPT === "true",
      },
      official_receipt_number: input.receiptNumber ?? null,
      official_receipt_url: input.receiptUrl ?? null,
      screenshot_url: input.screenshotUrl ?? null,
      error_code: input.status === "manual_review" ? "manual_payment_required" : input.status === "failed" ? "payment_failed" : null,
      error_message: input.status === "succeeded" ? null : input.message,
      started_at: now,
      finished_at: now,
    })
    .select("id")
    .single();
  if (attemptError || !attempt) {
    throw new Error(`Failed to insert official fee attempt: ${attemptError?.message ?? "empty response"}`);
  }

  let receiptId: string | null = null;
  if (input.status === "succeeded") {
    const { data: receipt, error: receiptError } = await supabase
      .from("official_fee_receipts")
      .insert({
        application_id: input.applicationId,
        user_id: input.intent.user_id,
        official_fee_payment_intent_id: input.intent.id,
        country_code: "VN",
        receipt_number: input.receiptNumber ?? null,
        receipt_url: input.receiptUrl ?? null,
        receipt_file_url: null,
        amount,
        currency,
        paid_at: now,
        source: process.env.VN_OFFICIAL_PAYMENT_DRY_RUN_RECEIPT === "true" ? "dry_run" : "vietnam_evisa_portal",
        raw_receipt_redacted_json: {
          registration_code_present: Boolean(input.registrationCode),
          receipt_number: input.receiptNumber ?? null,
          amount,
          currency,
        },
        created_at: now,
      })
      .select("id")
      .single();
    if (receiptError || !receipt) {
      throw new Error(`Failed to insert official fee receipt: ${receiptError?.message ?? "empty response"}`);
    }
    receiptId = (receipt as { id: string }).id;
  }

  return { attemptId: (attempt as { id: string }).id, receiptId };
}

async function updateVnOfficialFeeIntent(intentId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("official_fee_payment_intents")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", intentId);
  if (error) throw new Error(`Failed to update official fee intent: ${error.message}`);
}

function isVnOfficialFeeIntentExecutable(intent: VnOfficialFeeIntentRow | null): boolean {
  return ["admin_approved", "ready", "pending"].includes(intent?.status ?? "");
}

function isVnOfficialFeeSchemaMissing(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown } | null;
  const message = typeof value?.message === "string" ? value.message.toLowerCase() : String(error).toLowerCase();
  return (
    value?.code === "PGRST204" ||
    value?.code === "PGRST205" ||
    message.includes("official_fee_payment_intents") ||
    message.includes("official_fee_quotes") ||
    message.includes("schema cache") ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

async function hasVnOfficialFeeFallbackAuthorization(applicationId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("consent_events")
    .select("id")
    .eq("application_id", applicationId)
    .eq("consent_type", "official_fee_payment_authorization")
    .eq("accepted", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isVnOfficialFeeSchemaMissing(error)) return false;
    throw new Error(`Failed to load fallback official fee authorization: ${error.message}`);
  }
  return Boolean(data);
}

async function processVnPaymentItem(item: SubmissionQueueItem): Promise<void> {
  const startedAt = new Date().toISOString();
  await updateVnQueueRow(
    item.id,
    {
      status: "vn_payment_processing",
      current_stage: "official_fee_payment_starting",
      payment_status: "processing",
      heartbeat_at: startedAt,
      updated_at: startedAt,
    },
    { status: "vn_payment_processing", updated_at: startedAt },
  );

  try {
    let intent: VnOfficialFeeIntentRow | null = null;
    let fallbackAuthorized = false;
    try {
      intent = await getLatestVnOfficialFeeIntent(item.application_id);
    } catch (error) {
      if (isVnOfficialFeeSchemaMissing(error)) {
        fallbackAuthorized = await hasVnOfficialFeeFallbackAuthorization(item.application_id);
      } else {
        throw error;
      }
    }
    const autopayEnabled = readBooleanEnv("VN_OFFICIAL_PAYMENT_AUTOPAY", false);
    const directOneTimeCardAuthorized =
      autopayEnabled &&
      readBooleanEnv("VN_LOCAL_CARD_SESSION_ENABLED", false) &&
      item.payment_status === "authorized";
    if (!intent && !fallbackAuthorized && directOneTimeCardAuthorized) {
      fallbackAuthorized = true;
      console.log(
        `[vn] Payment queue ${item.id} proceeding with queue-scoped one-time card authorization without an official-fee intent.`,
      );
    }
    if (!intent && !fallbackAuthorized) {
      throw new Error("No authorized official_fee_payment_intent found for Vietnam payment.");
    }
    if (intent && !["admin_approved", "ready", "manual_review", "failed", "pending"].includes(intent.status ?? "")) {
      throw new Error(`Official fee intent is not executable from status ${intent.status ?? "(empty)"}.`);
    }

    const registrationCode = await loadVnRegistrationCode(item.application_id, item);
    const dryRunReceipt = readBooleanEnv("VN_OFFICIAL_PAYMENT_DRY_RUN_RECEIPT", false);
    const now = new Date().toISOString();

    if (autopayEnabled && !dryRunReceipt) {
      const { profile } = await loadApplicantData(item.application_id);
      const answers = await loadDs160Answers(item.application_id).catch(() => ({}));
      const email = await getVietnamOfficialLookupEmail(profile.id);
      const dateOfBirth = readAnswerValue(answers, [
        "date_of_birth",
        "birth_date",
        "dob",
      ]) ?? profile.date_of_birth ?? null;
      if (!registrationCode || !email || !dateOfBirth) {
        throw new Error("Vietnam payment resume requires registration code, email, and date of birth.");
      }

      const diagnosticsDir = path.resolve("diag-out", "vn-payment", item.id);
      fs.mkdirSync(diagnosticsDir, { recursive: true });
      const screenshotPath = path.join(diagnosticsDir, "payment-resume.png");
      const cardSession = await consumeVietnamCardSessionWithGrace(
        item.application_id,
        readBooleanEnv("VN_LOCAL_CARD_SESSION_ENABLED", false),
      );
      const payment = await resumeVietnamOfficialPayment({
        registrationCode,
        email,
        dateOfBirth,
        headless: readBooleanEnv("VN_PLAYWRIGHT_HEADLESS", false),
        screenshotPath,
        timeoutMs: readNumberEnv("VN_PAYMENT_RESUME_TIMEOUT_MS", 180_000),
        card: cardSession,
      });
      if (payment.status === "paid") {
        const receiptNumber = payment.receiptReference;
        const feeEvidence = intent
          ? await insertVnOfficialFeeAttempt({
              applicationId: item.application_id,
              intent,
              status: "succeeded",
              registrationCode,
              message: "Vietnam official fee payment completed through the official payment resume flow.",
              receiptNumber,
              screenshotUrl: screenshotPath,
            })
          : { attemptId: null, receiptId: null };
        if (intent) await updateVnOfficialFeeIntent(intent.id, "succeeded");

        const vnPayload: VnSubmissionResult = {
          country: "VN",
          status: "submitted_pending_email",
          mode: "live_assisted",
          provider: "vietnam_evisa_live",
          portalUrl: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
          checkpoint: "official_fee_paid",
          registrationCode,
          submittedAtIso: now,
          noticeText: "Your e-visa PDF will be emailed within ~3 working days.",
          paymentStatus: "paid",
        };
        await writeSubmissionResult(item.application_id, vnPayload, "completed");
        await updateVnQueueRow(
          item.id,
          {
            status: "vn_payment_paid",
            last_error: null,
            current_stage: "official_fee_paid",
            payment_status: "paid",
            official_status: "payment_submitted",
            manual_action_status: "completed",
            vn_result_payload: {
              ...(item.vn_result_payload ?? {}),
              status: "payment_submitted",
              officialFeePaymentIntentId: intent?.id ?? null,
              officialFeePaymentAttemptId: feeEvidence.attemptId,
              officialFeeReceiptId: feeEvidence.receiptId,
              receiptNumber,
              registrationCodeCaptured: true,
              screenshotPath,
            },
            heartbeat_at: now,
            updated_at: now,
          },
          {
            status: "vn_payment_paid",
            last_error: null,
            updated_at: now,
          },
        );
        await supabase
          .from("applications")
          .update({
            official_fee_status: "official_fee_payment_succeeded",
            ...(intent ? { official_fee_payment_intent_id: intent.id } : {}),
            ...(feeEvidence.receiptId ? { official_fee_receipt_id: feeEvidence.receiptId } : {}),
            external_status: "submitted_to_official_portal",
            external_reference: registrationCode,
            external_status_updated_at: now,
            updated_at: now,
          })
          .eq("id", item.application_id);
        await activatePaidVietnamTracking(item.application_id, email);
        return;
      }

      const message = `Vietnam official payment resume did not complete automatically: ${payment.reason}`;
      await updateVnQueueRow(
        item.id,
        {
          status: "vn_blocked",
          attempts: item.attempts + 1,
          last_error: message,
          current_stage: "official_fee_manual_review",
          payment_status: payment.status === "declined" ? "failed" : "manual_review",
          official_status: "payment_authorized",
          error_code: payment.status === "declined" ? "payment_declined" : "manual_payment_required",
          error_message: message,
          vn_result_payload: {
            ...(item.vn_result_payload ?? {}),
            status: "payment_manual_review",
            officialFeePaymentIntentId: intent?.id ?? null,
            officialFeeSchemaFallback: fallbackAuthorized,
            registrationCodeCaptured: true,
            paymentResumeUrl: payment.url,
            screenshotPath,
          },
          heartbeat_at: now,
          updated_at: now,
        },
        {
          status: "vn_blocked",
          attempts: item.attempts + 1,
          last_error: message,
          updated_at: now,
        },
      );
      return;
    }

    if (!dryRunReceipt || !intent) {
      const message = autopayEnabled
        ? "Vietnam official payment is authorized, but queued payment resume is not implemented for the fixed-card pilot. Re-run the live Vietnam runner through the official payment page or use operator payment."
        : "Vietnam official payment is authorized, but VN_OFFICIAL_PAYMENT_AUTOPAY is disabled. Operator payment is required.";
      const { attemptId } = intent
        ? await insertVnOfficialFeeAttempt({
            applicationId: item.application_id,
            intent,
            status: "manual_review",
            registrationCode,
            message,
          })
        : { attemptId: null };
      if (intent) await updateVnOfficialFeeIntent(intent.id, "manual_review");
      await Promise.all([
        updateVnQueueRow(
          item.id,
          {
            status: "vn_blocked",
            attempts: item.attempts + 1,
            last_error: message,
            current_stage: "official_fee_manual_review",
            payment_status: "manual_review",
            official_status: "payment_authorized",
            error_code: "manual_payment_required",
            error_message: message,
            vn_result_payload: {
              ...(item.vn_result_payload ?? {}),
              status: "payment_manual_review",
              officialFeePaymentIntentId: intent?.id ?? null,
              officialFeePaymentAttemptId: attemptId,
              officialFeeSchemaFallback: fallbackAuthorized,
              registrationCodeCaptured: Boolean(registrationCode),
            },
            heartbeat_at: now,
            updated_at: now,
          },
          {
            status: "vn_blocked",
            attempts: item.attempts + 1,
            last_error: message,
            updated_at: now,
          },
        ),
        intent
          ? supabase
              .from("applications")
              .update({
                official_fee_status: "official_fee_payment_manual_review",
                official_fee_payment_intent_id: intent.id,
                updated_at: now,
              })
              .eq("id", item.application_id)
          : Promise.resolve({ error: null }),
      ]);
      return;
    }

    const receiptNumber = `VN-EVISA-${registrationCode ?? item.application_id.slice(0, 8)}-${Date.now().toString(36)}`;
    const { attemptId, receiptId } = await insertVnOfficialFeeAttempt({
      applicationId: item.application_id,
      intent,
      status: "succeeded",
      registrationCode,
      message: dryRunReceipt
        ? "Dry-run Vietnam official fee receipt captured. No real payment was made."
        : "Vietnam official fee payment completed by the configured payment provider.",
      receiptNumber,
      receiptUrl: process.env.VN_OFFICIAL_PAYMENT_RECEIPT_URL ?? null,
    });
    await updateVnOfficialFeeIntent(intent.id, "succeeded");

    const vnPayload: VnSubmissionResult = {
      country: "VN",
      status: "submitted_pending_email",
      mode: "live_assisted",
      provider: "vietnam_evisa_live",
      portalUrl: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
      checkpoint: "official_fee_paid",
      ...(registrationCode ? { registrationCode } : {}),
      submittedAtIso: now,
      noticeText: "Your e-visa PDF will be emailed within ~3 working days.",
      paymentStatus: "paid",
    };
    await writeSubmissionResult(item.application_id, vnPayload, "completed");
    await Promise.all([
      updateVnQueueRow(
        item.id,
        {
          status: "vn_payment_paid",
          last_error: null,
          current_stage: "official_fee_paid",
          payment_status: "paid",
          official_status: "payment_submitted",
          manual_action_status: "completed",
          vn_result_payload: {
            ...(item.vn_result_payload ?? {}),
            status: "payment_submitted",
            officialFeePaymentIntentId: intent.id,
            officialFeePaymentAttemptId: attemptId,
            officialFeeReceiptId: receiptId,
            receiptNumber,
            registrationCodeCaptured: Boolean(registrationCode),
          },
          heartbeat_at: now,
          updated_at: now,
        },
        { status: "vn_payment_paid", last_error: null, updated_at: now },
      ),
      supabase
        .from("applications")
        .update({
          official_fee_status: "official_fee_payment_succeeded",
          official_fee_payment_intent_id: intent.id,
          official_fee_receipt_id: receiptId,
          external_status: "submitted_to_official_portal",
          external_reference: registrationCode,
          external_status_updated_at: now,
          updated_at: now,
        })
        .eq("id", item.application_id),
    ]);
    if (!dryRunReceipt) {
      await activatePaidVietnamTracking(item.application_id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failedAt = new Date().toISOString();
    await updateVnQueueRow(
      item.id,
      {
        status: "vn_payment_failed",
        attempts: item.attempts + 1,
        last_error: message,
        current_stage: "official_fee_payment_failed",
        payment_status: "failed",
        official_status: "payment_failed",
        error_code: "official_fee_payment_failed",
        error_message: message,
        heartbeat_at: failedAt,
        updated_at: failedAt,
      },
      {
        status: "vn_payment_failed",
        attempts: item.attempts + 1,
        last_error: message,
        updated_at: failedAt,
      },
    );
  }
}

async function persistVietnamProgressStage(
  queueId: string,
  stage: VietnamProgressStage,
  previousStage: { value: string | null },
): Promise<void> {
  const normalizedStage = normalizeVietnamProgressStage(stage);
  if (!shouldPersistVietnamProgressStage(previousStage.value, normalizedStage)) return;
  previousStage.value = normalizedStage;
  const now = new Date().toISOString();
  await updateVnQueueRow(
    queueId,
    {
      current_stage: normalizedStage,
      heartbeat_at: now,
      updated_at: now,
    },
    {
      updated_at: now,
    },
  );
}

async function processVnItem(item: SubmissionQueueItem): Promise<void> {
  const liveAssisted = item.status !== "vn_dry_run_pending" && item.mode !== "dry_run";
  const processingStatus = liveAssisted ? "vn_live_assisted_processing" : "vn_prefill_processing";
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
  const currentVnProgressStage = { value: "starting" as string | null };

  await updateVnQueueRow(
    item.id,
    {
      status: processingStatus,
      mode: liveAssisted ? "live_assisted" : "dry_run",
      provider: liveAssisted ? "vietnam_evisa_live" : "vietnam_evisa_dry_run",
      current_stage: "starting",
      started_at: now,
      heartbeat_at: now,
      official_status: "processing",
      updated_at: now,
    },
    {
      status: processingStatus,
      updated_at: now,
    },
  );
  await setSubmissionStatus(item.application_id, "processing");

  const heartbeatTimer = setInterval(() => {
    const heartbeatAt = new Date().toISOString();
    void supabase
      .from("submission_queue")
      .update({
        heartbeat_at: heartbeatAt,
        updated_at: heartbeatAt,
      })
      .eq("id", item.id)
      .eq("status", processingStatus);
  }, 60_000);
  heartbeatTimer.unref?.();

  try {
    const { profile, application, documents } = await loadApplicantData(item.application_id);
    const officialPaymentAutopayEnabled = liveAssisted && readBooleanEnv("VN_OFFICIAL_PAYMENT_AUTOPAY", false);
    const oneTimeCardPaymentEnabled =
      officialPaymentAutopayEnabled &&
      (readBooleanEnv("VN_LOCAL_CARD_SESSION_ENABLED", false) ||
        readBooleanEnv("VN_CLOUD_CARD_SESSION_ENABLED", false));
    const envFixedCardPaymentEnabled =
      officialPaymentAutopayEnabled && readBooleanEnv("VN_FIXED_CARD_ENABLED", false);
    const oneTimeFixedCard = await consumeVietnamCardSessionWithGrace(
      item.application_id,
      oneTimeCardPaymentEnabled,
    );
    let officialFeeIntent: VnOfficialFeeIntentRow | null = null;
    let officialFeeFallbackAuthorized = false;
    if (oneTimeCardPaymentEnabled || envFixedCardPaymentEnabled) {
      try {
        officialFeeIntent = await getLatestVnOfficialFeeIntent(item.application_id);
      } catch (error) {
        if (isVnOfficialFeeSchemaMissing(error)) {
          officialFeeFallbackAuthorized = await hasVnOfficialFeeFallbackAuthorization(item.application_id);
        } else {
          console.warn(
            `[vn] Run ${runId} could not load official fee intent; fixed-card payment will stay disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
    const queueAuthorizedOneTimeCard = Boolean(oneTimeFixedCard);
    if (queueAuthorizedOneTimeCard) {
      officialFeeFallbackAuthorized = true;
      console.log(
        `[vn] Run ${runId} using queue-scoped one-time card authorization for application=${item.application_id.slice(0, 4)}...${item.application_id.slice(-4)} payment_status=${item.payment_status ?? "(empty)"}`,
      );
    }
    const answers = applyVietnamAnswerAliases(
      await loadDs160Answers(item.application_id),
      profile,
      application,
    );
    const officialLookupEmail = liveAssisted
      ? await getVietnamOfficialLookupEmail(profile.id)
      : null;
    if (officialLookupEmail) {
      Object.assign(
        answers,
        applyVietnamOfficialLookupEmail(answers, officialLookupEmail),
      );
    }
    const vnDocsDir = fs.mkdtempSync(path.join(os.tmpdir(), `${runId}-docs-`));
    const localDocPaths = await downloadDocuments(documents, vnDocsDir);
    const portraitPath = firstLocalDocumentPath(localDocPaths, [
      "photo",
      "applicant_photo",
      "portrait_photo",
    ]);
    const passportPath = firstLocalDocumentPath(localDocPaths, [
      "passport_copy",
      "passport_scan",
      "passport_photo",
      "passport",
    ]);
    if (portraitPath) answers.portrait_photo = portraitPath;
    if (passportPath) {
      answers.passport_copy = passportPath;
      answers.passport_photo = passportPath;
    }
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
        allowFixedCardPayment: isVnOfficialFeeIntentExecutable(officialFeeIntent) || officialFeeFallbackAuthorized,
        fixedCard: oneTimeFixedCard,
        onProgress: async (stage) => {
          await persistVietnamProgressStage(item.id, stage, currentVnProgressStage);
        },
      },
    );

    if (result.status === "submitted_pending_pay" || result.status === "submitted_paid") {
      const paid = result.status === "submitted_paid";
      let officialFeeAttemptId: string | null = null;
      let officialFeeReceiptId: string | null = null;
      if (paid) {
        let intent = officialFeeIntent;
        if (!intent && !officialFeeFallbackAuthorized) {
          try {
            intent = await getLatestVnOfficialFeeIntent(item.application_id);
          } catch (error) {
            if (isVnOfficialFeeSchemaMissing(error)) {
              officialFeeFallbackAuthorized = await hasVnOfficialFeeFallbackAuthorization(item.application_id);
            } else {
              throw error;
            }
          }
        }
        if (intent && isVnOfficialFeeIntentExecutable(intent)) {
          officialFeeIntent = intent;
          const feeEvidence = await insertVnOfficialFeeAttempt({
            applicationId: item.application_id,
            intent,
            status: "succeeded",
            registrationCode: result.registrationCode,
            message: "Vietnam official fee payment completed by the configured fixed-card payment pilot.",
            receiptNumber: result.paymentReceiptReference,
            screenshotUrl: finalScreenshotPath ?? null,
          });
          officialFeeAttemptId = feeEvidence.attemptId;
          officialFeeReceiptId = feeEvidence.receiptId;
          await updateVnOfficialFeeIntent(intent.id, "succeeded");
        } else if (!officialFeeFallbackAuthorized) {
          throw new Error("Vietnam official fee payment completed without an executable authorized intent.");
        }
      }
      const vnPayload: VnSubmissionResult = {
        country: "VN",
        status: "submitted_pending_email",
        mode: liveAssisted ? "live_assisted" : "dry_run",
        provider: liveAssisted ? "vietnam_evisa_live" : "vietnam_evisa_dry_run",
        portalUrl: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
        checkpoint: paid ? "official_fee_paid" : "registration_code_visible",
        ...(result.registrationCode ? { registrationCode: result.registrationCode } : {}),
        submittedAtIso: result.submittedAtIso,
        noticeText: "Your e-visa PDF will be emailed within ~3 working days.",
        paymentStatus: paid ? "paid" : "manual_required",
      };
      await writeSubmissionResult(item.application_id, vnPayload, paid ? "completed" : "needs_user_action");
      const completedAt = new Date().toISOString();
      await updateVnQueueRow(
        item.id,
        {
          status: paid ? "vn_payment_paid" : "vn_prefilled",
          mode: liveAssisted ? "live_assisted" : "dry_run",
          provider: liveAssisted ? "vietnam_evisa_live" : "vietnam_evisa_dry_run",
          vn_result_payload: buildVnQueuePayload(result, tracePath, finalScreenshotPath),
          ...(result.registrationCode ? { vn_registration_code_encrypted: encryptSecret(result.registrationCode) } : {}),
          official_status: paid ? "payment_submitted" : "registration_code_captured",
          current_stage: paid ? "official_fee_paid" : "payment_required",
          manual_action_status: paid ? "completed" : "pending",
          payment_status: paid ? "paid" : "manual_required",
          ...(paid && officialFeeIntent
            ? { official_fee_payment_intent_id: officialFeeIntent.id }
            : {}),
          ...(officialFeeAttemptId ? { official_fee_payment_attempt_id: officialFeeAttemptId } : {}),
          ...(officialFeeReceiptId ? { official_fee_receipt_id: officialFeeReceiptId } : {}),
          official_portal_url: process.env.VN_OFFICIAL_BASE_URL ?? "https://evisa.gov.vn/",
          official_trace_url: tracePath ?? null,
          heartbeat_at: completedAt,
          updated_at: completedAt,
        },
        {
          status: paid ? "vn_payment_paid" : "vn_prefilled",
          last_error: null,
          updated_at: completedAt,
        },
      );
      if (paid) {
        await supabase
          .from("applications")
          .update({
            official_fee_status: "official_fee_payment_succeeded",
            ...(officialFeeIntent ? { official_fee_payment_intent_id: officialFeeIntent.id } : {}),
            ...(officialFeeReceiptId ? { official_fee_receipt_id: officialFeeReceiptId } : {}),
            external_status: "submitted_to_official_portal",
            external_reference: result.registrationCode ?? result.paymentReceiptReference,
            external_status_updated_at: completedAt,
            updated_at: completedAt,
          })
          .eq("id", item.application_id);
        await activatePaidVietnamTracking(
          item.application_id,
          officialLookupEmail ?? undefined,
        );
      }
      console.log(
        paid
          ? `[vn] Run ${runId} submitted and paid — receipt/reference captured`
          : `[vn] Run ${runId} prefilled — registration code captured`,
      );
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
  } finally {
    clearInterval(heartbeatTimer);
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

function buildScheduledSgacResult(input: {
  applicationId: string;
  arrivalDate: string | null | undefined;
  earliestSubmissionDate: string;
}): SgArrivalCardSubmissionResult & { scheduledFor: string } {
  return {
    country: "SG",
    visaType: "SG_ARRIVAL_CARD",
    status: "scheduled",
    mode: "live_assisted",
    provider: "sg_arrival_card_live",
    applicationId: input.applicationId,
    submitted: false,
    confirmationNumber: null,
    referenceNumber: null,
    portalUrl: SGAC_OFFICIAL_PORTAL_URL,
    portalResponseSummary:
      `ICA accepts SG Arrival Card submissions within three days including arrival day. This application is scheduled for ${input.earliestSubmissionDate}.`,
    scheduledFor: input.earliestSubmissionDate,
    artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
    payloadSummary: {
      arrivalDate: input.arrivalDate ?? null,
      purposeOfTravel: null,
      modeOfTravel: null,
      transportNumber: null,
      accommodationAddressProvided: false,
    },
  };
}

function buildScheduledMdacResult(input: {
  applicationId: string;
  arrivalDate: string | null | undefined;
  departureDate?: string | null | undefined;
  earliestSubmissionDate: string;
}): DigitalArrivalCardSubmissionResult & { scheduledFor: string } {
  return {
    country: "MY",
    visaType: "MY_MDAC_ARRIVAL_CARD",
    status: "scheduled",
    mode: "live_assisted",
    provider: "malaysia_mdac_live",
    applicationId: input.applicationId,
    submitted: false,
    confirmationNumber: null,
    referenceNumber: null,
    portalUrl: MDAC_OFFICIAL_PORTAL_URL,
    portalResponseSummary:
      `Malaysia MDAC accepts submissions within three days before arrival. This application is scheduled for ${input.earliestSubmissionDate}.`,
    scheduledFor: input.earliestSubmissionDate,
    artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
    payloadSummary: {
      arrivalDate: input.arrivalDate ?? null,
      departureDate: input.departureDate ?? null,
      modeOfTravel: null,
      transportNumber: null,
      accommodationAddressProvided: false,
    },
  };
}

function buildScheduledTdacResult(input: {
  applicationId: string;
  arrivalDate: string | null | undefined;
  departureDate?: string | null | undefined;
  earliestSubmissionDate: string;
}): DigitalArrivalCardSubmissionResult & { scheduledFor: string } {
  return {
    country: "TH",
    visaType: "TH_TDAC_ARRIVAL_CARD",
    status: "scheduled",
    mode: "live_assisted",
    provider: "thailand_tdac_live",
    applicationId: input.applicationId,
    submitted: false,
    confirmationNumber: null,
    referenceNumber: null,
    portalUrl: TDAC_OFFICIAL_PORTAL_URL,
    portalResponseSummary:
      `Thailand TDAC accepts submissions within three days before arrival. This application is scheduled for ${input.earliestSubmissionDate}.`,
    scheduledFor: input.earliestSubmissionDate,
    artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
    payloadSummary: {
      arrivalDate: input.arrivalDate ?? null,
      departureDate: input.departureDate ?? null,
      modeOfTravel: null,
      transportNumber: null,
      accommodationAddressProvided: false,
    },
  };
}

function buildScheduledPhEtravelResult(input: {
  applicationId: string;
  visaType?: "PH_ETRAVEL_ARRIVAL_CARD" | "PH_ETRAVEL_DEPARTURE_CARD";
  arrivalDate: string | null | undefined;
  departureDate?: string | null | undefined;
  earliestSubmissionDate: string;
}): DigitalArrivalCardSubmissionResult & { scheduledFor: string } {
  return {
    country: "PH",
    visaType: input.visaType ?? "PH_ETRAVEL_ARRIVAL_CARD",
    status: "scheduled",
    mode: "live_assisted",
    provider: "philippines_etravel_live",
    applicationId: input.applicationId,
    submitted: false,
    confirmationNumber: null,
    referenceNumber: null,
    portalUrl: PH_ETRAVEL_OFFICIAL_PORTAL_URL,
    portalResponseSummary:
      `Philippines eTravel normally accepts submissions within 72 hours before ${input.visaType === "PH_ETRAVEL_DEPARTURE_CARD" ? "departure" : "arrival"}. This application is scheduled for ${input.earliestSubmissionDate}.`,
    scheduledFor: input.earliestSubmissionDate,
    artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
    payloadSummary: {
      arrivalDate: input.arrivalDate ?? null,
      departureDate: input.departureDate ?? null,
      modeOfTravel: null,
      transportNumber: null,
      accommodationAddressProvided: false,
    },
  };
}

function buildScheduledVietnamPrearrivalResult(input: {
  applicationId: string;
  arrivalDate: string | null | undefined;
  earliestSubmissionDate: string;
}): DigitalArrivalCardSubmissionResult & { scheduledFor: string } {
  return {
    country: "VN",
    visaType: "VN_PREARRIVAL_DECLARATION",
    status: "scheduled",
    mode: "live_assisted",
    provider: "vietnam_prearrival_live",
    applicationId: input.applicationId,
    submitted: false,
    confirmationNumber: null,
    referenceNumber: null,
    portalUrl: VN_PREARRIVAL_OFFICIAL_PORTAL_URL,
    portalResponseSummary:
      `Vietnam Pre-Arrival Information Declaration is scheduled for the 72-hour pre-arrival window on ${input.earliestSubmissionDate}.`,
    scheduledFor: input.earliestSubmissionDate,
    artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
    payloadSummary: {
      arrivalDate: input.arrivalDate ?? null,
      departureDate: null,
      modeOfTravel: null,
      transportNumber: null,
      accommodationAddressProvided: false,
    },
  };
}

async function enqueueSgacLiveAfterDryRun(
  item: SubmissionQueueItem,
  answers: Record<string, string>,
): Promise<string | null> {
  const now = new Date().toISOString();
  const window = evaluateSgacSubmissionWindow(answers.arrival_date ?? answers.intended_arrival_date);
  const scheduled = window.status === "scheduled";
  const { data, error } = await supabase
    .from("submission_queue")
    .insert({
      application_id: item.application_id,
      status: scheduled ? "sgac_live_assisted_scheduled" : "sgac_live_assisted_pending",
      mode: "live_assisted",
      provider: "sg_arrival_card_live",
      attempts: 0,
      last_error: null,
      current_stage: scheduled ? "scheduled_for_ica_window" : "queued_after_dry_run",
      heartbeat_at: scheduled ? null : now,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`SGAC dry-run passed but live submission could not be queued: ${error.message}`);
  }

  if (scheduled) {
    await writeSubmissionResult(
      item.application_id,
      buildScheduledSgacResult({
        applicationId: item.application_id,
        arrivalDate: answers.arrival_date ?? answers.intended_arrival_date,
        earliestSubmissionDate: window.earliestSubmissionDate,
      }),
      "scheduled",
    );
  } else {
    await setSubmissionStatus(item.application_id, "waiting");
  }
  const row = data as { id?: string | null } | null;
  return row?.id ?? null;
}

async function enqueueDigitalArrivalCardLiveAfterDryRun(
  item: SubmissionQueueItem,
  code: ArrivalCardCode,
  answers: Record<string, string>,
): Promise<string | null> {
  const now = new Date().toISOString();
  const isMdac = code === "MDAC";
  const isTdac = code === "TDAC";
  const isPhDeparture = code === "PH_ETRAVEL" && answers.travel_type?.toUpperCase() === "DEPARTURE";
  const arrivalDateAnswer = code === "PH_ETRAVEL"
    ? answers.flight_arrival_date ?? answers.arrival_date ?? answers.intended_arrival_date
    : answers.arrival_date ?? answers.intended_arrival_date;
  const departureDateAnswer = code === "PH_ETRAVEL"
    ? answers.flight_departure_date ?? answers.departure_date ?? answers.intended_departure_date
    : answers.departure_date ?? answers.intended_departure_date;
  const phWindowDate = isPhDeparture ? departureDateAnswer : arrivalDateAnswer;
  const window = code === "PH_ETRAVEL"
    ? evaluatePhEtravelSubmissionWindow(phWindowDate)
    : evaluateSgacSubmissionWindow(arrivalDateAnswer);
  if (window.status === "past") {
    throw new Error(`${code} ${isPhDeparture ? "departure" : "arrival"} date is already in the past. Please update the travel dates before submitting.`);
  }
  if (window.status === "invalid") {
    throw new Error(`${code} ${isPhDeparture ? "departure" : "arrival"} date must use YYYY-MM-DD.`);
  }
  const scheduled = window.status === "scheduled";
  const queuedStatus: SubmissionQueueItem["status"] = isMdac
    ? scheduled
      ? "mdac_live_assisted_scheduled"
      : "mdac_live_assisted_pending"
    : isTdac
      ? scheduled
        ? "tdac_live_assisted_scheduled"
        : "tdac_live_assisted_pending"
      : scheduled
        ? "phetravel_live_assisted_scheduled"
        : "phetravel_live_assisted_pending";
  const provider = isMdac
    ? "malaysia_mdac_live"
    : isTdac
      ? "thailand_tdac_live"
      : "philippines_etravel_live";
  const scheduledStage = isMdac
    ? "scheduled_for_mdac_window"
    : isTdac
      ? "scheduled_for_tdac_window"
      : "scheduled_for_phetravel_window";
  const { data, error } = await supabase
    .from("submission_queue")
    .insert({
      application_id: item.application_id,
      status: queuedStatus,
      mode: "live_assisted",
      provider,
      attempts: 0,
      last_error: null,
      current_stage: scheduled ? scheduledStage : "queued_after_dry_run",
      heartbeat_at: scheduled ? null : now,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`${code} dry-run passed but live submission could not be queued: ${error.message}`);
  }

  if (scheduled) {
    await writeSubmissionResult(
      item.application_id,
      isMdac
        ? buildScheduledMdacResult({
            applicationId: item.application_id,
            arrivalDate: answers.arrival_date ?? answers.intended_arrival_date,
            departureDate: answers.departure_date ?? answers.intended_departure_date,
            earliestSubmissionDate: window.earliestSubmissionDate,
          })
        : isTdac
          ? buildScheduledTdacResult({
              applicationId: item.application_id,
              arrivalDate: answers.arrival_date ?? answers.intended_arrival_date,
              departureDate: answers.departure_date ?? answers.intended_departure_date,
              earliestSubmissionDate: window.earliestSubmissionDate,
            })
          : buildScheduledPhEtravelResult({
              applicationId: item.application_id,
              visaType: isPhDeparture ? "PH_ETRAVEL_DEPARTURE_CARD" : "PH_ETRAVEL_ARRIVAL_CARD",
              arrivalDate: arrivalDateAnswer,
              departureDate: departureDateAnswer,
              earliestSubmissionDate: window.earliestSubmissionDate,
            }),
      "scheduled",
    );
  } else {
    await setSubmissionStatus(item.application_id, "waiting");
  }
  const row = data as { id?: string | null } | null;
  return row?.id ?? null;
}

async function enqueueVietnamPrearrivalLiveAfterDryRun(
  item: SubmissionQueueItem,
  answers: Record<string, string>,
): Promise<string | null> {
  const now = new Date().toISOString();
  const arrivalDateAnswer = answers.arrival_date ?? answers.intended_arrival_date;
  const window = evaluateVietnamPrearrivalSubmissionWindow(arrivalDateAnswer);
  if (window.status === "past") {
    throw new Error("Vietnam Pre-Arrival declaration arrival date is already in the past. Please update the travel dates before submitting.");
  }
  if (window.status === "invalid") {
    throw new Error("Vietnam Pre-Arrival declaration arrival date must use YYYY-MM-DD.");
  }
  const scheduled = window.status === "scheduled";
  const { data, error } = await supabase
    .from("submission_queue")
    .insert({
      application_id: item.application_id,
      status: scheduled ? "vn_prearrival_live_assisted_scheduled" : "vn_prearrival_live_assisted_pending",
      mode: "live_assisted",
      provider: "vietnam_prearrival_live",
      attempts: 0,
      last_error: null,
      current_stage: scheduled ? "scheduled_for_vn_prearrival_window" : "queued_after_dry_run",
      heartbeat_at: scheduled ? null : now,
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Vietnam Pre-Arrival dry-run passed but live submission could not be queued: ${error.message}`);
  }

  if (scheduled) {
    await writeSubmissionResult(
      item.application_id,
      buildScheduledVietnamPrearrivalResult({
        applicationId: item.application_id,
        arrivalDate: arrivalDateAnswer,
        earliestSubmissionDate: window.earliestSubmissionDate,
      }),
      "scheduled",
    );
  } else {
    await setSubmissionStatus(item.application_id, "waiting");
  }
  const row = data as { id?: string | null } | null;
  return row?.id ?? null;
}

async function promoteSgacScheduledIfDue(item: SubmissionQueueItem): Promise<SubmissionQueueItem | null> {
  if (item.status !== "sgac_live_assisted_scheduled") return item;
  const answers = await loadDs160Answers(item.application_id);
  const window = evaluateSgacSubmissionWindow(answers.arrival_date ?? answers.intended_arrival_date);
  if (window.status === "scheduled") {
    await supabase
      .from("submission_queue")
      .update({
        current_stage: "scheduled_for_ica_window",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await writeSubmissionResult(
      item.application_id,
      buildScheduledSgacResult({
        applicationId: item.application_id,
        arrivalDate: answers.arrival_date ?? answers.intended_arrival_date,
        earliestSubmissionDate: window.earliestSubmissionDate,
      }),
      "scheduled",
    );
    return null;
  }

  if (window.status === "past" || window.status === "invalid") {
    const message = window.status === "past"
      ? "SGAC scheduled submission missed the ICA submission window because the arrival date is in the past."
      : "SGAC scheduled submission cannot run because the arrival date is invalid.";
    await supabase
      .from("submission_queue")
      .update({
        status: "sgac_live_assisted_failed",
        last_error: message,
        error_code: `sgac_arrival_date_${window.status}`,
        error_message: message,
        current_stage: "validation_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await markSubmissionFailed(item.application_id, message);
    return null;
  }

  const now = new Date().toISOString();
  await supabase
    .from("submission_queue")
    .update({
      status: "sgac_live_assisted_pending",
      current_stage: "ica_window_open",
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "waiting");
  return {
    ...item,
    status: "sgac_live_assisted_pending",
    current_stage: "ica_window_open",
    heartbeat_at: now,
    updated_at: now,
  };
}

async function promoteMdacScheduledIfDue(item: SubmissionQueueItem): Promise<SubmissionQueueItem | null> {
  if (item.status !== "mdac_live_assisted_scheduled") return item;
  const answers = await loadDs160Answers(item.application_id);
  const window = evaluateSgacSubmissionWindow(answers.arrival_date ?? answers.intended_arrival_date);
  if (window.status === "scheduled") {
    await supabase
      .from("submission_queue")
      .update({
        current_stage: "scheduled_for_mdac_window",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await writeSubmissionResult(
      item.application_id,
      buildScheduledMdacResult({
        applicationId: item.application_id,
        arrivalDate: answers.arrival_date ?? answers.intended_arrival_date,
        departureDate: answers.departure_date ?? answers.intended_departure_date,
        earliestSubmissionDate: window.earliestSubmissionDate,
      }),
      "scheduled",
    );
    return null;
  }

  if (window.status === "past" || window.status === "invalid") {
    const message = window.status === "past"
      ? "MDAC scheduled submission missed the official submission window because the arrival date is in the past."
      : "MDAC scheduled submission cannot run because the arrival date is invalid.";
    await supabase
      .from("submission_queue")
      .update({
        status: "mdac_live_assisted_failed",
        last_error: message,
        error_code: `mdac_arrival_date_${window.status}`,
        error_message: message,
        current_stage: "validation_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await markSubmissionFailed(item.application_id, message);
    return null;
  }

  const now = new Date().toISOString();
  await supabase
    .from("submission_queue")
    .update({
      status: "mdac_live_assisted_pending",
      current_stage: "mdac_window_open",
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "waiting");
  return {
    ...item,
    status: "mdac_live_assisted_pending",
    current_stage: "mdac_window_open",
    heartbeat_at: now,
    updated_at: now,
  };
}

async function promoteTdacScheduledIfDue(item: SubmissionQueueItem): Promise<SubmissionQueueItem | null> {
  if (item.status !== "tdac_live_assisted_scheduled") return item;
  const answers = await loadDs160Answers(item.application_id);
  const window = evaluateSgacSubmissionWindow(answers.arrival_date ?? answers.intended_arrival_date);
  if (window.status === "scheduled") {
    await supabase
      .from("submission_queue")
      .update({
        current_stage: "scheduled_for_tdac_window",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await writeSubmissionResult(
      item.application_id,
      buildScheduledTdacResult({
        applicationId: item.application_id,
        arrivalDate: answers.arrival_date ?? answers.intended_arrival_date,
        departureDate: answers.departure_date ?? answers.intended_departure_date,
        earliestSubmissionDate: window.earliestSubmissionDate,
      }),
      "scheduled",
    );
    return null;
  }

  if (window.status === "past" || window.status === "invalid") {
    const message = window.status === "past"
      ? "TDAC scheduled submission missed the official submission window because the arrival date is in the past."
      : "TDAC scheduled submission cannot run because the arrival date is invalid.";
    await supabase
      .from("submission_queue")
      .update({
        status: "tdac_live_assisted_failed",
        last_error: message,
        error_code: `tdac_arrival_date_${window.status}`,
        error_message: message,
        current_stage: "validation_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await markSubmissionFailed(item.application_id, message);
    return null;
  }

  const now = new Date().toISOString();
  await supabase
    .from("submission_queue")
    .update({
      status: "tdac_live_assisted_pending",
      current_stage: "tdac_window_open",
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "waiting");
  return {
    ...item,
    status: "tdac_live_assisted_pending",
    current_stage: "tdac_window_open",
    heartbeat_at: now,
    updated_at: now,
  };
}

async function promotePhEtravelScheduledIfDue(item: SubmissionQueueItem): Promise<SubmissionQueueItem | null> {
  if (item.status !== "phetravel_live_assisted_scheduled") return item;
  const answers = await loadDs160Answers(item.application_id);
  const arrivalDateAnswer = answers.flight_arrival_date ?? answers.arrival_date ?? answers.intended_arrival_date;
  const departureDateAnswer = answers.flight_departure_date ?? answers.departure_date ?? answers.intended_departure_date;
  const isDeparture = answers.travel_type?.toUpperCase() === "DEPARTURE";
  const window = evaluatePhEtravelSubmissionWindow(isDeparture ? departureDateAnswer : arrivalDateAnswer);
  if (window.status === "scheduled") {
    await supabase
      .from("submission_queue")
      .update({
        current_stage: "scheduled_for_phetravel_window",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await writeSubmissionResult(
      item.application_id,
      buildScheduledPhEtravelResult({
        applicationId: item.application_id,
        visaType: isDeparture ? "PH_ETRAVEL_DEPARTURE_CARD" : "PH_ETRAVEL_ARRIVAL_CARD",
        arrivalDate: arrivalDateAnswer,
        departureDate: departureDateAnswer,
        earliestSubmissionDate: window.earliestSubmissionDate,
      }),
      "scheduled",
    );
    return null;
  }

  if (window.status === "past" || window.status === "invalid") {
    const message = window.status === "past"
      ? `Philippines eTravel scheduled submission missed the official 72-hour window because the ${isDeparture ? "departure" : "arrival"} date is in the past.`
      : `Philippines eTravel scheduled submission cannot run because the ${isDeparture ? "departure" : "arrival"} date is invalid.`;
    await supabase
      .from("submission_queue")
      .update({
        status: "phetravel_live_assisted_failed",
        last_error: message,
        error_code: `phetravel_${isDeparture ? "departure" : "arrival"}_date_${window.status}`,
        error_message: message,
        current_stage: "validation_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await markSubmissionFailed(item.application_id, message);
    return null;
  }

  const now = new Date().toISOString();
  await supabase
    .from("submission_queue")
    .update({
      status: "phetravel_live_assisted_pending",
      current_stage: "phetravel_window_open",
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "waiting");
  return {
    ...item,
    status: "phetravel_live_assisted_pending",
    current_stage: "phetravel_window_open",
    heartbeat_at: now,
    updated_at: now,
  };
}

async function promoteVietnamPrearrivalScheduledIfDue(item: SubmissionQueueItem): Promise<SubmissionQueueItem | null> {
  if (item.status !== "vn_prearrival_live_assisted_scheduled") return item;
  const answers = await loadDs160Answers(item.application_id);
  const arrivalDateAnswer = answers.arrival_date ?? answers.intended_arrival_date;
  const window = evaluateVietnamPrearrivalSubmissionWindow(arrivalDateAnswer);
  if (window.status === "scheduled") {
    await supabase
      .from("submission_queue")
      .update({
        current_stage: "scheduled_for_vn_prearrival_window",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await writeSubmissionResult(
      item.application_id,
      buildScheduledVietnamPrearrivalResult({
        applicationId: item.application_id,
        arrivalDate: arrivalDateAnswer,
        earliestSubmissionDate: window.earliestSubmissionDate,
      }),
      "scheduled",
    );
    return null;
  }

  if (window.status === "past" || window.status === "invalid") {
    const message = window.status === "past"
      ? "Vietnam Pre-Arrival scheduled submission missed the official 72-hour window because the arrival date is in the past."
      : "Vietnam Pre-Arrival scheduled submission cannot run because the arrival date is invalid.";
    await supabase
      .from("submission_queue")
      .update({
        status: "vn_prearrival_live_assisted_failed",
        last_error: message,
        error_code: `vn_prearrival_arrival_date_${window.status}`,
        error_message: message,
        current_stage: "validation_failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    await markSubmissionFailed(item.application_id, message);
    return null;
  }

  const now = new Date().toISOString();
  await supabase
    .from("submission_queue")
    .update({
      status: "vn_prearrival_live_assisted_pending",
      current_stage: "vn_prearrival_window_open",
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "waiting");
  return {
    ...item,
    status: "vn_prearrival_live_assisted_pending",
    current_stage: "vn_prearrival_window_open",
    heartbeat_at: now,
    updated_at: now,
  };
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

  async function uploadSgacPdfs(paths: string[]): Promise<string[]> {
    if (!artifactOwnerId) return paths;
    const uploaded: string[] = [];
    for (const filePath of paths) {
      try {
        uploaded.push(
          await uploadArtifact({
            authUserId: artifactOwnerId,
            applicationId: item.application_id,
            country: "SG",
            kind: "sgac-confirmation-pdf",
            ext: "pdf",
            contentType: "application/pdf",
            filePath,
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[sgac] Failed to upload confirmation PDF artifact: ${message}`);
        uploaded.push(filePath);
      }
    }
    return uploaded;
  }

  try {
    const { profile, application, documents } = await loadApplicantData(item.application_id);
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
        artifacts: { screenshots: [], pdfs: [], logs: [], traces: [] },
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
    const pdfArtifacts = await uploadSgacPdfs(portalResult.pdfs);

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
      confirmationPdfStoragePath: pdfArtifacts[0] ?? null,
      artifacts: { screenshots: screenshotArtifacts, pdfs: pdfArtifacts, logs: portalResult.logs, traces: [] },
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
      artifacts: { screenshots, pdfs: [], logs: [], traces: [] },
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

type ArrivalCardCode = "MDAC" | "TDAC" | "PH_ETRAVEL";

function arrivalCardLogCode(code: ArrivalCardCode): string {
  return code === "PH_ETRAVEL" ? "phetravel" : code.toLowerCase();
}

function arrivalCardPayloadSummary(payload: SubmissionPayload): DigitalArrivalCardSubmissionResult["payloadSummary"] {
  const accommodationAddress =
    payload.countrySpecific.address_in_malaysia ??
    payload.countrySpecific.address_in_thailand ??
    payload.countrySpecific.philippines_address ??
    payload.countrySpecific.address_in_vietnam ??
    payload.trip.accommodationAddress ??
    "";
  return {
    arrivalDate: payload.trip.arrivalDate ?? null,
    departureDate: payload.trip.departureDate ?? null,
    modeOfTravel: payload.countrySpecific.mode_of_travel ?? payload.countrySpecific.transport_type ?? null,
    transportNumber:
      payload.countrySpecific.transport_number ??
      payload.countrySpecific.flight_number ??
      payload.countrySpecific.flight_or_transport_number ??
      payload.countrySpecific.vehicle_or_vessel_number ??
      null,
    accommodationAddressProvided: Boolean(accommodationAddress.trim()),
  };
}

async function uploadArrivalCardArtifacts(input: {
  authUserId: string | null;
  applicationId: string;
  country: "MY" | "TH" | "PH" | "VN";
  kind: string;
  ext: "png" | "pdf";
  contentType: string;
  paths: string[];
  strict?: boolean;
}): Promise<string[]> {
  if (!input.authUserId) {
    if (input.strict) {
      throw new Error(`Cannot persist required ${input.kind} artifact without an artifact owner.`);
    }
    return input.paths;
  }
  const uploaded: string[] = [];
  for (const filePath of input.paths) {
    try {
      uploaded.push(
        await uploadArtifact({
          authUserId: input.authUserId,
          applicationId: input.applicationId,
          country: input.country,
          kind: input.kind,
          ext: input.ext,
          contentType: input.contentType,
          filePath,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[arrival-card] Failed to upload ${input.kind} artifact: ${message}`);
      if (input.strict) {
        throw new Error(`Required ${input.kind} artifact could not be persisted: ${message}`);
      }
      uploaded.push(filePath);
    }
  }
  return uploaded;
}

async function processVietnamPrearrivalLiveItem(item: SubmissionQueueItem): Promise<void> {
  console.log(
    `[vn-prearrival] Processing live submission application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: "vn_prearrival_live_assisted_processing",
      current_stage: "mapping_answers",
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

  let artifactOwnerId: string | null = null;
  let payloadSummary: DigitalArrivalCardSubmissionResult["payloadSummary"] | undefined;

  async function writeFailure(input: {
    status: DigitalArrivalCardSubmissionResult["status"];
    code: string;
    message: string;
    portalSummary: string;
    missingFields?: string[];
    screenshotPaths?: string[];
    logs?: string[];
  }): Promise<void> {
    const screenshotArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country: "VN",
      kind: "vn-prearrival-screenshot",
      ext: "png",
      contentType: "image/png",
      paths: input.screenshotPaths ?? [],
    });
    const result: DigitalArrivalCardSubmissionResult = {
      country: "VN",
      visaType: "VN_PREARRIVAL_DECLARATION",
      status: input.status,
      mode: "live_assisted",
      provider: "vietnam_prearrival_live",
      applicationId: item.application_id,
      submitted: false,
      confirmationNumber: null,
      referenceNumber: null,
      portalUrl: VN_PREARRIVAL_OFFICIAL_PORTAL_URL,
      portalResponseSummary: input.portalSummary,
      errorDetails: {
        code: input.code,
        message: input.message,
        missingFields: input.missingFields,
      },
      artifacts: { screenshots: screenshotArtifacts, pdfs: [], logs: input.logs ?? [], traces: [] },
      payloadSummary,
    };
    await writeSubmissionResult(item.application_id, result, "failed");
    await supabase
      .from("submission_queue")
      .update({
        status: "vn_prearrival_live_assisted_failed",
        attempts: item.attempts + 1,
        last_error: input.message,
        error_code: input.code,
        error_message: input.message,
        current_stage: input.status === "validation_failed" ? "validation_failed" : "official_portal_failed",
        live_screenshot_url: screenshotArtifacts[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  }

  try {
    const { profile, application } = await loadApplicantData(item.application_id);
    artifactOwnerId = profile.auth_user_id ?? null;
    if (!isVietnamPrearrivalApplicationMetadata(application)) {
      throw new Error(
        `Vietnam Pre-Arrival live submission requires VN_PREARRIVAL_DECLARATION; got country=${application.country} visa_type=${application.visa_type}`,
      );
    }

    const storedAnswers = await loadDs160Answers(item.application_id);
    const managedAlias = await ensureApplicantInboxAlias(profile.id);
    const answers = routeVnPrearrivalEmailAnswers(
      storedAnswers,
      managedAlias.alias,
      profile.email,
    );
    const arrivalCardApplication = buildCountrySubmissionApplication(profile, application, answers);
    const provider = getCountrySubmissionProvider(application.country, application.visa_type);
    if (!provider || provider.countryCode !== "VN") {
      throw new Error("Vietnam Pre-Arrival country submission provider is not registered.");
    }

    const validation = provider.validate(arrivalCardApplication);
    const payload = provider.mapToSubmissionPayload(arrivalCardApplication, {
      dryRun: false,
      idempotencyKey: `vn-prearrival-live:${item.id}`,
    });
    payloadSummary = arrivalCardPayloadSummary(payload);

    if (!validation.ok) {
      await writeFailure({
        status: "validation_failed",
        code: "vn_prearrival_validation_failed",
        message: `Vietnam Pre-Arrival live validation failed: missing ${validation.missingRequiredFields.join(", ")}.`,
        portalSummary: "Vietnam Pre-Arrival was not submitted because required VIZA form data is missing.",
        missingFields: validation.missingRequiredFields,
      });
      return;
    }

    await supabase
      .from("submission_queue")
      .update({
        current_stage: "running_vn_prearrival_portal",
        official_portal_url: VN_PREARRIVAL_OFFICIAL_PORTAL_URL,
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    const portalResult = await runVietnamPrearrivalPortalSubmission(
      normalizeVnPrearrivalPortalPayload(payload),
      {
        headless: process.env.VN_PREARRIVAL_PLAYWRIGHT_HEADLESS !== "false",
        stopBeforeSubmit: process.env.VN_PREARRIVAL_STOP_BEFORE_SUBMIT === "1",
        applicantId: profile.id,
      },
    );
    const screenshotArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country: "VN",
      kind: "vn-prearrival-screenshot",
      ext: "png",
      contentType: "image/png",
      paths: portalResult.screenshots,
    });
    const qrArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country: "VN",
      kind: "vn-prearrival-qr",
      ext: "png",
      contentType: "image/png",
      paths: portalResult.qrCodes,
      strict: true,
    });
    if (portalResult.submitted && qrArtifacts.length === 0) {
      throw new Error("Vietnam Pre-Arrival submission cannot complete without a stored QR artifact.");
    }
    const pdfArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country: "VN",
      kind: "vn-prearrival-confirmation-pdf",
      ext: "pdf",
      contentType: "application/pdf",
      paths: portalResult.pdfs,
    });
    const result: DigitalArrivalCardSubmissionResult = {
      country: "VN",
      visaType: "VN_PREARRIVAL_DECLARATION",
      status: portalResult.submitted ? "submitted" : "official_portal_error",
      mode: "live_assisted",
      provider: "vietnam_prearrival_live",
      applicationId: item.application_id,
      submitted: portalResult.submitted,
      confirmationNumber: portalResult.confirmationNumber ?? null,
      referenceNumber: portalResult.referenceNumber ?? null,
      portalUrl: portalResult.portalUrl,
      portalResponseSummary: portalResult.portalResponseSummary,
      confirmationPdfStoragePath: pdfArtifacts[0] ?? null,
      artifacts: {
        screenshots: screenshotArtifacts,
        qrCodes: qrArtifacts,
        pdfs: pdfArtifacts,
        logs: portalResult.logs,
        traces: [],
      },
      payloadSummary,
    };
    await writeSubmissionResult(item.application_id, result, portalResult.submitted ? "completed" : "failed");
    if (portalResult.submitted) {
      const officialReference = portalResult.confirmationNumber ?? portalResult.referenceNumber ?? null;
      const { error: applicationStatusError } = await supabase
        .from("applications")
        .update({
          status: "submitted",
          confirmation_number: portalResult.confirmationNumber ?? officialReference,
          external_reference: portalResult.referenceNumber ?? officialReference,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.application_id);
      if (applicationStatusError) {
        console.error(
          `[vn-prearrival] Official submission succeeded but application status sync failed: ${applicationStatusError.message}`,
        );
      }
    }
    await supabase
      .from("submission_queue")
      .update({
        status: portalResult.submitted ? "done" : "vn_prearrival_live_assisted_failed",
        last_error: portalResult.submitted ? null : portalResult.portalResponseSummary,
        error_code: portalResult.submitted ? null : "vn_prearrival_not_submitted",
        error_message: portalResult.submitted ? null : portalResult.portalResponseSummary,
        current_stage: portalResult.submitted ? "submitted" : "official_portal_error",
        official_portal_url: portalResult.portalUrl,
        official_status: portalResult.submitted ? "submitted" : "official_portal_error",
        official_confirmation_number_encrypted: portalResult.confirmationNumber
          ? encryptSecret(portalResult.confirmationNumber)
          : null,
        official_confirmation_page_url: portalResult.portalUrl,
        official_confirmation_pdf_url: pdfArtifacts[0] ?? null,
        vn_result_payload: result,
        live_submitted_at: portalResult.submitted ? new Date().toISOString() : null,
        live_screenshot_url: screenshotArtifacts[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const validationError = err instanceof VnPrearrivalPortalValidationError;
    const portalError = err instanceof VnPrearrivalPortalError;
    await writeFailure({
      status: validationError ? "validation_failed" : "official_portal_error",
      code: validationError
        ? err.code
        : portalError
          ? err.code
          : "vn_prearrival_live_worker_error",
      message: errorMsg,
      portalSummary:
        portalError && err.portalSummary
          ? err.portalSummary
          : validationError
            ? "Vietnam Pre-Arrival was not submitted because VIZA could not map all required data into the official portal payload."
            : "Vietnam Pre-Arrival submission failed before an official confirmation could be captured.",
      missingFields: validationError ? err.missingFields : undefined,
      screenshotPaths: portalError ? err.screenshotPaths : [],
      logs: portalError ? err.logs : [],
    });
  }
}

async function suppressDuplicateArrivalCardQueueAfterSuccess(
  item: SubmissionQueueItem,
  code: ArrivalCardCode,
): Promise<boolean> {
  const [{ data: application, error: applicationError }, { data: completedQueues, error: queueError }] = await Promise.all([
    supabase
      .from("applications")
      .select("submission_result_status, submission_result")
      .eq("id", item.application_id)
      .maybeSingle(),
    supabase
      .from("submission_queue")
      .select("id, mode, official_status, live_submitted_at")
      .eq("application_id", item.application_id)
      .eq("status", "done")
      .neq("id", item.id)
      .limit(20),
  ]);
  if (applicationError || queueError) {
    const message = applicationError?.message ?? queueError?.message ?? "unknown lookup error";
    console.warn(`[${arrivalCardLogCode(code)}] Could not check duplicate-success guard: ${message}`);
    return false;
  }

  const result = application?.submission_result as { submitted?: unknown } | null;
  const alreadySucceeded = hasOfficialArrivalCardSuccess({
    applicationResult: result,
    completedQueues,
  });
  if (!alreadySucceeded) return false;

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("submission_queue")
    .update({
      status: "retry_superseded",
      current_stage: "duplicate_suppressed",
      error_code: "duplicate_retry_after_success",
      error_message: `Suppressed duplicate retry job after ${code} official submission completed.`,
      last_error: null,
      heartbeat_at: now,
      updated_at: now,
    })
    .eq("id", item.id);
  if (updateError) {
    throw new Error(`Failed to suppress duplicate ${code} queue item: ${updateError.message}`);
  }
  console.warn(
    `[${arrivalCardLogCode(code)}] Suppressed duplicate queue item after an earlier official submission succeeded.`,
  );
  return true;
}

async function processDigitalArrivalCardLiveItem(item: SubmissionQueueItem, code: ArrivalCardCode): Promise<void> {
  const isMdac = code === "MDAC";
  const isTdac = code === "TDAC";
  const logCode = arrivalCardLogCode(code);
  const country = isMdac ? "MY" : isTdac ? "TH" : "PH";
  let visaType: DigitalArrivalCardSubmissionResult["visaType"] = isMdac ? "MY_MDAC_ARRIVAL_CARD" : isTdac ? "TH_TDAC_ARRIVAL_CARD" : "PH_ETRAVEL_ARRIVAL_CARD";
  const providerName = isMdac ? "malaysia_mdac_live" : isTdac ? "thailand_tdac_live" : "philippines_etravel_live";
  const targetedFailedRetry = TARGET_FAILED_RETRY_ENABLED
    && process.env.SUBMISSION_SERVICE_TARGET_JOB_ID?.trim() === item.id;
  const processingStatus: SubmissionQueueItem["status"] = targetedFailedRetry
    ? "arrival_card_targeted_retry_processing" as SubmissionQueueItem["status"]
    : isMdac
      ? "mdac_live_assisted_processing"
      : isTdac
        ? "tdac_live_assisted_processing"
        : "phetravel_live_assisted_processing";
  const failedStatus: SubmissionQueueItem["status"] = isMdac
    ? "mdac_live_assisted_failed"
    : isTdac
      ? "tdac_live_assisted_failed"
      : "phetravel_live_assisted_failed";
  const portalUrl = isMdac ? MDAC_OFFICIAL_PORTAL_URL : isTdac ? TDAC_OFFICIAL_PORTAL_URL : PH_ETRAVEL_OFFICIAL_PORTAL_URL;

  console.log(
    `[${logCode}] Processing live submission application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  if (await suppressDuplicateArrivalCardQueueAfterSuccess(item, code)) return;

  await supabase
    .from("submission_queue")
    .update({
      status: processingStatus,
      current_stage: "mapping_answers",
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

  let artifactOwnerId: string | null = null;
  let payloadSummary: DigitalArrivalCardSubmissionResult["payloadSummary"] | undefined;

  async function writeFailure(input: {
    status: DigitalArrivalCardSubmissionResult["status"];
    code: string;
    message: string;
    portalSummary: string;
    missingFields?: string[];
    screenshotPaths?: string[];
    logs?: string[];
  }): Promise<void> {
    const screenshotArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country,
      kind: `${logCode}-screenshot`,
      ext: "png",
      contentType: "image/png",
      paths: input.screenshotPaths ?? [],
    });
    const result: DigitalArrivalCardSubmissionResult = {
      country,
      visaType,
      status: input.status,
      mode: "live_assisted",
      provider: providerName,
      applicationId: item.application_id,
      submitted: false,
      confirmationNumber: null,
      referenceNumber: null,
      portalUrl,
      portalResponseSummary: input.portalSummary,
      errorDetails: {
        code: input.code,
        message: input.message,
        missingFields: input.missingFields,
      },
      artifacts: { screenshots: screenshotArtifacts, pdfs: [], logs: input.logs ?? [], traces: [] },
      payloadSummary,
    };
    await writeSubmissionResult(item.application_id, result, "failed");
    await supabase
      .from("submission_queue")
      .update({
        status: failedStatus,
        attempts: item.attempts + 1,
        last_error: input.message,
        error_code: input.code,
        error_message: input.message,
        current_stage: input.status === "validation_failed" ? "validation_failed" : "official_portal_failed",
        live_screenshot_url: screenshotArtifacts[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  }

  try {
    const { profile, application, documents } = await loadApplicantData(item.application_id);
    if (!isMdac && !isTdac && application.visa_type === "PH_ETRAVEL_DEPARTURE_CARD") {
      visaType = "PH_ETRAVEL_DEPARTURE_CARD";
    }
    artifactOwnerId = profile.auth_user_id ?? null;
    const countryMatches = isMdac
      ? MALAYSIA_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country))
      : isTdac
        ? THAILAND_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country))
        : PHILIPPINES_COUNTRY_ALIASES.has(normalizeQueueRoutingValue(application.country));
    if (!countryMatches || application.visa_type !== visaType) {
      throw new Error(
        `${code} live submission requires ${visaType}; got country=${application.country} visa_type=${application.visa_type}`,
      );
    }

    const answers = await loadDs160Answers(item.application_id);
    let phProfilePhotoPath: string | undefined;
    if (!isMdac && !isTdac) {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `viza-ph-etravel-docs-${item.application_id}-`));
      const reusableDocuments = await loadReusableApplicantDocuments(
        profile.id,
        item.application_id,
        documents,
      );
      const localDocPaths = await downloadDocuments(reusableDocuments, tempDir);
      phProfilePhotoPath = firstLocalDocumentPathMatching(localDocPaths, [
        /(^|_)(photo|portrait|visa_photo|applicant_photo|personal_photo)(_|$)/i,
        /passport.*photo/i,
      ]);
      const customsSignaturePath = firstLocalDocumentPath(localDocPaths, [
        "customs_signature_file",
        "electronic_signature",
        "signature",
        "signature_image",
      ]);
      if (customsSignaturePath) {
        answers.customs_signature_file = customsSignaturePath;
      }
      if (phProfilePhotoPath) {
        console.log("[phetravel] Using application photo for eGovPH profile onboarding.");
      } else {
        phProfilePhotoPath = await downloadLatestUserPhotoDocument(profile.auth_user_id, tempDir);
      }
    }
    const arrivalCardApplication = buildCountrySubmissionApplication(profile, application, answers);
    const provider = getCountrySubmissionProvider(application.country, application.visa_type);
    if (!provider || provider.countryCode !== country) {
      throw new Error(`${code} country submission provider is not registered.`);
    }

    const validation = provider.validate(arrivalCardApplication);
    const payload = provider.mapToSubmissionPayload(arrivalCardApplication, {
      dryRun: false,
      idempotencyKey: `${logCode}-live:${item.id}`,
    });
    payloadSummary = arrivalCardPayloadSummary(payload);

    if (!validation.ok) {
      await writeFailure({
        status: "validation_failed",
        code: `${code.toLowerCase()}_validation_failed`,
        message: `${code} live validation failed: missing ${validation.missingRequiredFields.join(", ")}.`,
        portalSummary: `${code} was not submitted because required VIZA form data is missing.`,
        missingFields: validation.missingRequiredFields,
      });
      return;
    }

    await supabase
      .from("submission_queue")
      .update({
        current_stage: isMdac ? "running_mdac_portal" : isTdac ? "running_tdac_portal" : "running_phetravel_portal",
        official_portal_url: portalUrl,
        heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    let phAccountPlan: ReturnType<typeof choosePhEtravelAccountPlan> | null = null;
    let portalResult: {
      submitted: boolean;
      confirmationNumber?: string | null;
      referenceNumber?: string | null;
      portalUrl: string;
      portalResponseSummary: string;
      screenshots: string[];
      qrCodes?: string[];
      pdfs: string[];
      logs: string[];
    };
    if (isMdac) {
      const resultMdac = await runMdacPortalSubmission(normalizeMdacPortalPayload(payload), {
        headless: readBooleanEnv("MDAC_WORKER_PLAYWRIGHT_HEADLESS", false),
        stopBeforeSubmit: process.env.MDAC_STOP_BEFORE_SUBMIT === "1",
      });
      portalResult = resultMdac;
    } else if (isTdac) {
      const resultTdac = await runTdacPortalSubmission(normalizeTdacPortalPayload(payload), {
        headless: process.env.TDAC_PLAYWRIGHT_HEADLESS !== "false",
        stopBeforeSubmit: process.env.TDAC_STOP_BEFORE_SUBMIT === "1",
      });
      portalResult = resultTdac;
    } else {
      const existingPhAccount = await loadPhEtravelAccount(profile.id);
      phAccountPlan = await loadOrCreatePhEtravelAccountPlan({
        applicantId: profile.id,
        existingAccount: existingPhAccount,
      });

      if (phAccountPlan.mode === "create_new") {
        await upsertPhEtravelAccount({
          applicantId: profile.id,
          email: phAccountPlan.email,
          password: phAccountPlan.password,
          mpin: phAccountPlan.mpin,
          status: "pending_registration",
        });
      }
      await supabase
        .from("submission_queue")
        .update({
          official_account_email_encrypted: encryptSecret(phAccountPlan.email),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      let phAttempts = 0;
      let resultPh: Awaited<ReturnType<typeof runPhEtravelPortalSubmission>>;
      while (true) {
        try {
          resultPh = await runPhEtravelPortalSubmission(normalizePhEtravelPortalPayload(payload), {
            headless: process.env.PH_ETRAVEL_PLAYWRIGHT_HEADLESS !== "false",
            stopBeforeSubmit: readBooleanEnv("PH_ETRAVEL_STOP_BEFORE_SUBMIT", true),
            applicantId: profile.id,
            profilePhotoPath: phProfilePhotoPath,
            officialAccountEmail: phAccountPlan.email,
            officialAccountPassword: phAccountPlan.password,
            officialAccountMpin: phAccountPlan.mpin,
            forceAccountRegistration: phAccountPlan.mode === "create_new",
            mailbox: createPhEtravelMailboxProvider(profile.id, phAccountPlan.email),
          });
          break;
        } catch (error) {
          if (!isRetryablePhEtravelPortalError(error) || phAttempts >= 1) {
            throw error;
          }
          phAttempts += 1;
          await markPhEtravelPlanFailed({ applicantId: profile.id, plan: phAccountPlan });
          phAccountPlan = await loadOrCreatePhEtravelAccountPlan({
            applicantId: profile.id,
            // An eGovPH account whose saved MPIN is rejected cannot be
            // repaired by repeating registration with the same alias.
            // Rotate to a fresh catch-all alias and establish credentials
            // that VIZA can persist for subsequent submissions.
            forceCreateNew: error.code === "ph_etravel_official_mpin_invalid",
            existingAccount: await loadPhEtravelAccount(profile.id),
          });
          if (phAccountPlan.mode === "create_new") {
            await upsertPhEtravelAccount({
              applicantId: profile.id,
              email: phAccountPlan.email,
              password: phAccountPlan.password,
              mpin: phAccountPlan.mpin,
              status: "pending_registration",
            });
          }
          await supabase
            .from("submission_queue")
            .update({
              official_account_email_encrypted: encryptSecret(phAccountPlan.email),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
      }
      portalResult = resultPh!;
      await upsertPhEtravelAccount({
        applicantId: profile.id,
        email: phAccountPlan.email,
        password: phAccountPlan.password,
        mpin: phAccountPlan.mpin,
        status: resultPh.submitted ? "submitted" : "authenticated",
        lastAuthenticatedAt: new Date().toISOString(),
      });
    }

    const screenshotArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country,
      kind: `${logCode}-screenshot`,
      ext: "png",
      contentType: "image/png",
      paths: portalResult.screenshots,
    });
    const pdfArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country,
      kind: `${logCode}-confirmation-pdf`,
      ext: "pdf",
      contentType: "application/pdf",
      paths: portalResult.pdfs,
    });
    const qrArtifacts = await uploadArrivalCardArtifacts({
      authUserId: artifactOwnerId,
      applicationId: item.application_id,
      country,
      kind: `${logCode}-qr`,
      ext: "png",
      contentType: "image/png",
      paths: portalResult.qrCodes ?? [],
    });
    if (!isMdac && !isTdac && portalResult.submitted && qrArtifacts.length === 0) {
      throw new Error("Philippines eTravel submission cannot complete without a stored official QR artifact.");
    }
    const result: DigitalArrivalCardSubmissionResult = {
      country,
      visaType,
      status: portalResult.submitted ? "submitted" : "official_portal_error",
      mode: "live_assisted",
      provider: providerName,
      applicationId: item.application_id,
      submitted: portalResult.submitted,
      confirmationNumber: portalResult.confirmationNumber ?? null,
      referenceNumber: portalResult.referenceNumber ?? null,
      portalUrl: portalResult.portalUrl,
      portalResponseSummary: portalResult.portalResponseSummary,
      confirmationPdfStoragePath: pdfArtifacts[0] ?? null,
      artifacts: {
        screenshots: screenshotArtifacts,
        qrCodes: qrArtifacts,
        pdfs: pdfArtifacts,
        logs: portalResult.logs,
        traces: [],
      },
      payloadSummary,
    };
    await writeSubmissionResult(item.application_id, result, portalResult.submitted ? "completed" : "failed");
    if (portalResult.submitted) {
      const officialReference = portalResult.confirmationNumber ?? portalResult.referenceNumber ?? null;
      const { error: applicationStatusError } = await supabase
        .from("applications")
        .update({
          status: "submitted",
          confirmation_number: portalResult.confirmationNumber ?? officialReference,
          external_reference: portalResult.referenceNumber ?? officialReference,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.application_id);
      if (applicationStatusError) {
        console.error(
          `[${logCode}] Official submission succeeded but application status sync failed: ${applicationStatusError.message}`,
        );
      }
    }
    await supabase
      .from("submission_queue")
      .update({
        status: portalResult.submitted ? "done" : failedStatus,
        last_error: null,
        error_code: null,
        error_message: null,
        current_stage: portalResult.submitted ? "submitted" : "official_portal_error",
        official_portal_url: portalResult.portalUrl,
        official_confirmation_number_encrypted: portalResult.confirmationNumber
          ? encryptSecret(portalResult.confirmationNumber)
          : null,
        official_confirmation_pdf_url: pdfArtifacts[0] ?? null,
        live_submitted_at: portalResult.submitted ? new Date().toISOString() : null,
        live_screenshot_url: screenshotArtifacts[0] ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (await suppressDuplicateArrivalCardQueueAfterSuccess(item, code)) return;
    const validationError = err instanceof MdacPortalValidationError || err instanceof TdacPortalValidationError || err instanceof PhEtravelPortalValidationError;
    const portalError = err instanceof MdacPortalError || err instanceof TdacPortalError || err instanceof PhEtravelPortalError;
    await writeFailure({
      status: validationError ? "validation_failed" : "official_portal_error",
      code: validationError
        ? err.code
        : portalError
          ? err.code
          : `${logCode}_live_worker_error`,
      message: errorMsg,
      portalSummary:
        portalError && err.portalSummary
          ? err.portalSummary
          : validationError
            ? `${code} was not submitted because VIZA could not map all required data into the official portal payload.`
            : `${code} submission failed before an official confirmation could be captured.`,
      missingFields: validationError ? err.missingFields : undefined,
      screenshotPaths: portalError ? err.screenshotPaths : [],
      logs: err instanceof PhEtravelPortalError ? err.logs : [],
    });
    console.error(`[${logCode}] Live submission failed: ${errorMsg}`);
  }
}

async function processIndonesiaItem(item: SubmissionQueueItem): Promise<void> {
  const isB1 = item.status.startsWith("id_b1_evoa_") || item.provider === "indonesia_b1_evoa_live";
  const provider = isB1 ? "indonesia_b1_evoa_live" : "indonesia_c1_live";
  const processingStatus: SubmissionQueueItem["status"] = isB1
    ? "id_b1_evoa_live_assisted_processing"
    : "id_c1_live_assisted_processing";
  const pendingStatus: SubmissionQueueItem["status"] = isB1
    ? "id_b1_evoa_live_assisted_pending"
    : "id_c1_live_assisted_pending";
  const failedStatus: SubmissionQueueItem["status"] = isB1
    ? "id_b1_evoa_live_assisted_failed"
    : "id_c1_live_assisted_failed";
  const paymentPendingStatus: SubmissionQueueItem["status"] = isB1
    ? "id_b1_evoa_payment_pending"
    : "id_c1_payment_pending";
  const paymentFailedStatus: SubmissionQueueItem["status"] = isB1
    ? "id_b1_evoa_payment_failed"
    : "id_c1_payment_failed";
  const paymentProcessingStatus: SubmissionQueueItem["status"] = isB1
    ? "id_b1_evoa_payment_processing"
    : "id_c1_payment_processing";
  const paymentPaidStatus: SubmissionQueueItem["status"] = isB1
    ? "id_b1_evoa_payment_paid"
    : "id_c1_payment_paid";

  console.log(
    `[indonesia] Processing ${provider} application=${redactIdentifier(item.application_id)} (attempt ${item.attempts + 1})`,
  );

  await supabase
    .from("submission_queue")
    .update({
      status: processingStatus,
      provider,
      current_stage: "preparing_managed_alias",
      last_error: null,
      error_code: null,
      error_message: null,
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", item.id);
  await setSubmissionStatus(item.application_id, "processing");

  const heartbeatTimer = setInterval(() => {
    const heartbeatAt = new Date().toISOString();
    void (async () => {
      const { error } = await supabase
        .from("submission_queue")
        .update({
          heartbeat_at: heartbeatAt,
          updated_at: heartbeatAt,
        })
        .eq("id", item.id)
        .in("status", [processingStatus, paymentProcessingStatus]);
      if (error) {
        console.error(`[indonesia] Queue heartbeat failed: ${error.message}`);
      }
    })().catch((error: unknown) => {
      console.error(
        `[indonesia] Queue heartbeat request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }, 60_000);

  try {
    const vaultOpts = {
      actor: "submission-service:indonesia",
      correlationId: item.id,
    };
    const { profile, application, documents } = await loadApplicantData(item.application_id);
    const answers = await loadDs160Answers(item.application_id);
    const managedVaultEmail = await applicantVault.get(profile.id, "indonesia.portal.email", vaultOpts);
    const managedVaultPassword = await applicantVault.get(profile.id, "indonesia.portal.password", vaultOpts);

    const existingAliasDomain = parseAliasDomain(managedVaultEmail);
    const aliasDomains = parseIndonesiaManagedAliasDomains(existingAliasDomain);

    const reusableDocuments = await loadReusableApplicantDocuments(
      profile.id,
      item.application_id,
      documents,
    );
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `viza-id-${item.application_id}-`));
    const localDocPaths = await downloadDocuments(reusableDocuments, tempDir);
    const passportImagePath = firstLocalDocumentPathMatching(localDocPaths, [
      /passport.*(copy|bio|data|scan|page|image)?/i,
      /(copy|bio|data|scan).*passport/i,
    ]);
    const photoImagePath = firstLocalDocumentPathMatching(localDocPaths, [
      /(^|_)(photo|portrait|visa_photo|applicant_photo|personal_photo)(_|$)/i,
      /passport.*photo/i,
    ]);
    const returnTicketPath = firstLocalDocumentPathMatching(localDocPaths, [
      /return_ticket/i,
      /onward_ticket/i,
      /(return|onward).*ticket/i,
      /(flight|travel).*itinerary/i,
      /travel_itinerary/i,
      /itinerary/i,
      /flight/i,
    ]);
    const bankStatementPath = firstLocalDocumentPathMatching(localDocPaths, [
      /bank.*statement/i,
      /personal.*bank/i,
      /financial.*statement/i,
      /proof.*fund/i,
      /funds?/i,
    ]);
    const passportSupportPath = firstLocalDocumentPathMatching(localDocPaths, [
      /passport.*pdf/i,
      /passport_bio_page/i,
      /passport_copy/i,
    ]);
    const vaultPortalPassword = managedVaultPassword ?? generateFvPortalPassword();
    if (!managedVaultPassword) {
      await applicantVault.set(profile.id, "indonesia.portal.password", vaultPortalPassword, {
        ...vaultOpts,
        note: "VIZA-managed Indonesia eVisa portal password",
      });
    }
    const preparedPortalAccount = hasPreparedIndonesiaPortalAccount({
      email: managedVaultEmail,
      password: vaultPortalPassword,
    });
    // Indonesia B1/C1 payment is a closed cloud workflow. Never downgrade a
    // card-authorized run to a visible/manual official-payment handoff.
    const userPaymentHandoffEnabled = true;
    const oneTimeIndonesiaCard = await consumeIndonesiaCardSessionWithGrace(
      item.application_id,
      readBooleanEnv("ID_LOCAL_CARD_SESSION_ENABLED", false) ||
        readBooleanEnv("ID_CLOUD_CARD_SESSION_ENABLED", false),
    );
    const portalProbeHeadless = readBooleanEnv("INDONESIA_PLAYWRIGHT_HEADLESS", true);
    const userPaymentHandoff = {
      enabled: userPaymentHandoffEnabled,
      waitTimeoutMs: Number.parseInt(process.env.INDONESIA_USER_PAYMENT_WAIT_MS ?? `${10 * 60 * 1000}`, 10),
      oneTimeCard: oneTimeIndonesiaCard,
      takeOneTimeCard: () => consumeIndonesiaCardSession(item.application_id),
      onWaitingForUser: async (snapshot: {
        url: string;
        title: string | null;
        state: string;
        diagnostics: string[];
      }) => {
        const isOtpCheckpoint = snapshot.state === "payment_otp_required";
        const message = isOtpCheckpoint
          ? "VIZA submitted the card and is waiting for the bank authentication result."
          : "VIZA submitted the card and is confirming the official payment result.";
        await supabase
          .from("submission_queue")
          .update({
            status: paymentProcessingStatus,
            provider,
            current_stage: isOtpCheckpoint ? "bank_authentication_processing" : "official_fee_payment_processing",
            manual_action_status: null,
            error_code: null,
            error_message: null,
            vn_result_payload: {
              ...(item.vn_result_payload ?? {}),
              actionType: "official_fee_payment_processing",
              actionInstructions: message,
              checkpoint: isOtpCheckpoint ? "bank_authentication_processing" : "official_fee_payment_processing",
              message,
              implementationStatus: "partial",
              evidence: {
                provider,
                state: snapshot.state,
                title: snapshot.title,
                diagnostics: snapshot.diagnostics.slice(-8),
              },
            },
            heartbeat_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
      },
    };

    let result: Awaited<ReturnType<typeof runIndonesiaLiveSubmission>> = {
      country: "GENERIC",
      targetCountry: "ID",
      visaType: isB1 ? "ID_B1_EVOA" : "ID_C1_TOURIST",
      status: "action_required",
      mode: "live_assisted",
      applicationId: item.application_id,
      actionType: "live_portal_recon_required",
      actionInstructions: "Preparing Indonesia managed account before portal recon.",
      implementationStatus: "partial",
      message: "Indonesia managed account prep not started.",
    };

    if (preparedPortalAccount) {
      const existingPortalEmail = managedVaultEmail!;
      await markIndonesiaQueueStage(item.id, "official_portal_running", provider);
      result = await runIndonesiaLiveSubmission({
        applicationId: item.application_id,
        visaType: application.visa_type || (isB1 ? "ID_B1_EVOA" : "ID_C1_TOURIST"),
        answers: {
          ...answers,
          email: existingPortalEmail,
          email_address: existingPortalEmail,
        },
        managedAccountAvailable: true,
        managedAccountEmail: existingPortalEmail,
        managedAccountPassword: vaultPortalPassword,
        applicantId: profile.id,
        passportImagePath,
        photoImagePath,
        returnTicketPath,
        bankStatementPath: bankStatementPath && /\.pdf$/i.test(bankStatementPath)
          ? bankStatementPath
          : undefined,
        passportSupportPath: passportSupportPath && /\.pdf$/i.test(passportSupportPath)
          ? passportSupportPath
          : undefined,
        profile: {
          fullName: profile.full_name,
          gender: profile.gender,
          dateOfBirth: profile.date_of_birth,
          placeOfBirth: profile.place_of_birth,
          nationality: profile.nationality,
          passportNumber: profile.passport_number,
          passportIssueDate: profile.passport_issue_date,
          passportExpiryDate: profile.passport_expiry_date,
          passportIssuingCountry: profile.issuing_country,
          passportIssuingAuthority: profile.issuing_authority,
          phone: profile.phone,
        },
        probeOfficialPortal: true,
        portalProbeHeadless,
        userPaymentHandoff,
        onStage: async (stage, snapshot) => {
          await markIndonesiaQueueStage(item.id, stage, provider, snapshot.url);
        },
      });
    } else {
      for (let attempt = 0; attempt < aliasDomains.length; attempt += 1) {
        const alias = await ensureApplicantInboxAliasForDomain(profile.id, aliasDomains[attempt], supabase);
        const managedAliasEmail = alias.alias;

        await applicantVault.set(profile.id, "indonesia.portal.email", managedAliasEmail, {
          ...vaultOpts,
          note: "VIZA-managed Indonesia eVisa portal alias email",
        });

        await markIndonesiaQueueStage(item.id, "official_portal_running", provider);
        result = await runIndonesiaLiveSubmission({
          applicationId: item.application_id,
          visaType: application.visa_type || (isB1 ? "ID_B1_EVOA" : "ID_C1_TOURIST"),
          answers: {
            ...answers,
            email: managedAliasEmail,
            email_address: managedAliasEmail,
          },
          managedAccountAvailable: true,
          managedAccountEmail: managedAliasEmail,
          managedAccountPassword: vaultPortalPassword,
          applicantId: profile.id,
          passportImagePath,
          photoImagePath,
          returnTicketPath,
          bankStatementPath: bankStatementPath && /\.pdf$/i.test(bankStatementPath)
            ? bankStatementPath
            : undefined,
          passportSupportPath: passportSupportPath && /\.pdf$/i.test(passportSupportPath)
            ? passportSupportPath
            : undefined,
          profile: {
            fullName: profile.full_name,
            gender: profile.gender,
            dateOfBirth: profile.date_of_birth,
            placeOfBirth: profile.place_of_birth,
            nationality: profile.nationality,
            passportNumber: profile.passport_number,
            passportIssueDate: profile.passport_issue_date,
            passportExpiryDate: profile.passport_expiry_date,
            passportIssuingCountry: profile.issuing_country,
            passportIssuingAuthority: profile.issuing_authority,
            phone: profile.phone,
          },
          probeOfficialPortal: true,
          portalProbeHeadless,
          userPaymentHandoff,
          onStage: async (stage, snapshot) => {
            await markIndonesiaQueueStage(item.id, stage, provider, snapshot.url);
          },
        });

        if (
          result.status === "action_required" &&
          result.implementationStatus === "partial" &&
          shouldRotateIndonesiaAlias(result, managedAliasEmail) &&
          attempt + 1 < aliasDomains.length
        ) {
          console.log(
            `[indonesia] ${provider} email check failed for ${redactIdentifier(managedAliasEmail)}; rotating domain`,
          );
          continue;
        }
        break;
      }
    }

    if (result.country === "ID" && result.status === "submitted") {
      const artifactStoragePath = await uploadArtifact({
        authUserId: profile.auth_user_id,
        applicationId: item.application_id,
        country: "ID",
        kind: "official-payment-success-evidence",
        ext: "pdf",
        contentType: "application/pdf",
        data: result.evidencePdf,
      });
      const submittedResult: GenericEvisaSubmissionResult = {
        country: "ID",
        status: "submitted",
        reference: result.reference,
        portalUrl: result.portalUrl,
        artifactStoragePath,
      };
      const { error: artifactPathError } = await supabase
        .from("applications")
        .update({ result_storage_path: artifactStoragePath })
        .eq("id", item.application_id);
      if (artifactPathError) {
        throw new Error(`Failed to persist Indonesia official evidence path: ${artifactPathError.message}`);
      }
      await writeSubmissionResult(item.application_id, submittedResult, "completed");
      const { error: paidQueueError } = await supabase
        .from("submission_queue")
        .update({
          status: paymentPaidStatus,
          provider,
          last_error: null,
          error_code: null,
          error_message: null,
          current_stage: "completed",
          manual_action_status: null,
          official_portal_url: result.portalUrl,
          live_submitted_at: new Date().toISOString(),
          vn_result_payload: {
            checkpoint: "completed",
            message: "Indonesia official payment and submission succeeded; official evidence was stored.",
            reference: result.reference ?? null,
            artifactStoragePath,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (paidQueueError) {
        throw new Error(`Failed to mark Indonesia payment paid: ${paidQueueError.message}`);
      }
      console.log(
        `[indonesia] ${provider} completed application=${redactIdentifier(item.application_id)} with official evidence`,
      );
      return;
    }

    const isPaymentAuthorizationRequired =
      result.status === "action_required" &&
      (result.actionType === "official_fee_payment_required" || result.actionType === "official_fee_otp_required");
    const isPaymentFailed =
      result.status === "action_required" &&
      result.actionType === "official_fee_payment_failed";

    const resultStatus = isPaymentFailed ? "failed" : result.status === "action_required" ? "action_required" : "unsupported";
    const nextQueueStatus = isPaymentAuthorizationRequired
      ? paymentPendingStatus
      : isPaymentFailed
        ? paymentFailedStatus
        : result.status === "action_required"
        ? "action_required"
        : failedStatus;
    const currentStage = isPaymentFailed
      ? "official_fee_payment_failed"
      : result.actionType === "official_fee_payment_required" || result.actionType === "official_fee_otp_required"
      ? userPaymentHandoffEnabled
        ? "user_payment_required"
        : "payment_page_visible"
      : result.actionType ?? "indonesia_live_action_required";
    const portalUrl =
      result.portalUrl ??
      (isB1 ? INDONESIA_B1_EVOA_PORTAL_URL : INDONESIA_C1_PORTAL_URL);

    const queuePayload = {
      actionType: result.actionType ?? null,
      actionInstructions: result.actionInstructions ?? null,
      checkpoint: currentStage,
      message: result.message,
      url: portalUrl,
      implementationStatus: result.implementationStatus,
      evidence: {
        provider,
        message: result.message,
        diagnostics: "operatorDiagnostics" in result
          ? result.operatorDiagnostics?.slice(-20) ?? []
          : [],
      },
    };

    await writeSubmissionResult(item.application_id, result, resultStatus);
    const { error: queueUpdateError } = await supabase
      .from("submission_queue")
      .update({
        status: nextQueueStatus,
        provider,
        last_error: null,
        error_code: result.actionType ?? null,
        error_message: result.message,
        current_stage: currentStage,
        official_portal_url: portalUrl,
        manual_action_status: result.status === "action_required"
          ? isPaymentFailed
            ? "payment_failed"
            : userPaymentHandoffEnabled && isPaymentAuthorizationRequired
            ? "user_payment_required"
            : "pending"
          : null,
        vn_result_payload: queuePayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (queueUpdateError) {
      throw new Error(`Failed to update Indonesia submission queue: ${queueUpdateError.message}`);
    }

    console.log(
      `[indonesia] ${provider} prepared managed alias for application=${redactIdentifier(item.application_id)}; action=${result.actionType ?? result.status}`,
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const newAttempts = item.attempts + 1;
    const newStatus = newAttempts >= MAX_ATTEMPTS ? failedStatus : pendingStatus;
    await supabase
      .from("submission_queue")
      .update({
        status: newStatus,
        attempts: newAttempts,
        last_error: errorMsg,
        error_code: "indonesia_live_worker_error",
        error_message: errorMsg,
        current_stage: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    if (newAttempts >= MAX_ATTEMPTS) {
      await markSubmissionFailed(item.application_id, errorMsg);
      await sendFailureAlert(item.application_id, `[ID] ${errorMsg}`);
    }
    console.error(`[indonesia] ${provider} failed for application=${redactIdentifier(item.application_id)}:`, errorMsg);
  } finally {
    clearInterval(heartbeatTimer);
  }
}

async function markIndonesiaQueueStage(
  queueId: string,
  currentStage: string,
  provider: "indonesia_c1_live" | "indonesia_b1_evoa_live",
  portalUrl?: string | null,
): Promise<void> {
  await supabase
    .from("submission_queue")
    .update({
      provider,
      current_stage: currentStage,
      last_error: null,
      error_code: null,
      error_message: null,
      ...(portalUrl ? { official_portal_url: portalUrl } : {}),
      heartbeat_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId);
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
      status:
        item.status === "sgac_dry_run_pending"
          ? "sgac_dry_run_processing"
          : item.status === "mdac_dry_run_pending"
            ? "mdac_dry_run_processing"
            : item.status === "tdac_dry_run_pending"
              ? "tdac_dry_run_processing"
              : item.status === "phetravel_dry_run_pending"
                ? "phetravel_dry_run_processing"
                : item.status === "vn_prearrival_dry_run_pending"
                  ? "vn_prearrival_dry_run_processing"
                  : "processing",
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
    const isMdacDryRun = isMdacQueueItem(item, application) && item.status.startsWith("mdac_dry_run_");
    const isTdacDryRun = isTdacQueueItem(item, application) && item.status.startsWith("tdac_dry_run_");
    const isPhEtravelDryRun = isPhEtravelQueueItem(item, application) && item.status.startsWith("phetravel_dry_run_");
    const isVietnamPrearrivalDryRun =
      isVietnamPrearrivalQueueItem(item, application) &&
      item.status.startsWith("vn_prearrival_dry_run_");
    const validationFailed =
      result.status === "unsupported" &&
      result.message.startsWith("Dry-run validation failed:");
    const resultStatus =
      result.status === "submitted_mock" ? "submitted_mock" : "unsupported";

    if (validationFailed) {
      await markSubmissionFailed(item.application_id, result.message);
    } else if (isSgacDryRun) {
      const liveJobId = await enqueueSgacLiveAfterDryRun(item, answers);
      console.log(
        `[sgac] Dry-run passed for application=${redactIdentifier(item.application_id)}; queued live job=${redactIdentifier(liveJobId)}`,
      );
    } else if (result.status === "submitted_mock" && (isMdacDryRun || isTdacDryRun || isPhEtravelDryRun)) {
      const code: ArrivalCardCode = isMdacDryRun ? "MDAC" : isTdacDryRun ? "TDAC" : "PH_ETRAVEL";
      const liveJobId = await enqueueDigitalArrivalCardLiveAfterDryRun(item, code, answers);
      console.log(
        `[${arrivalCardLogCode(code)}] Dry-run passed for application=${redactIdentifier(item.application_id)}; queued live job=${redactIdentifier(liveJobId)}`,
      );
    } else if (result.status === "submitted_mock" && isVietnamPrearrivalDryRun) {
      const liveJobId = await enqueueVietnamPrearrivalLiveAfterDryRun(item, answers);
      console.log(
        `[vn-prearrival] Dry-run passed for application=${redactIdentifier(item.application_id)}; queued live job=${redactIdentifier(liveJobId)}`,
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

async function processPendingQueueItem(rawItem: SubmissionQueueItem): Promise<void> {
  const item = await normalizeDigitalArrivalCardQueueItem(
    await normalizeSgacQueueItem(await normalizeVietnamQueueItem(rawItem)),
  );
  if (isDryRunQueueItem(item) || (isSubmissionDryRunMode() && !isLiveAssistedQueueItem(item))) {
    await processDryRunItem(item, "global_dry_run");
  } else if (isDs160ProofJob(item)) {
    const ds160Config = loadDs160SubmissionConfig();
    const liveStartError = validateDs160LiveStart(ds160Config);
    if (liveStartError) {
      await supabase
        .from("submission_queue")
        .update({
          status: "ds160_proof_failed",
          attempts: item.attempts + 1,
          last_error: liveStartError,
          error_code: "ds160_proof_config_blocked",
          error_message: liveStartError,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      return;
    }
    await processDs160ProofItem(item, ds160Config);
  } else if (isDs160Job(item)) {
    const liveRequested = isDs160LiveAssistedQueueItem(item);
    if (!liveRequested) {
      await processDryRunItem(item, "ds160_default_dry_run");
      return;
    }

    const ds160Config = loadDs160SubmissionConfig();
    if (ds160Config.mode !== "live_assisted") {
      await processDs160LiveConfigBlockedItem(
        item,
        "DS-160 live assisted was requested, but DS160_SUBMISSION_MODE is not live_assisted.",
      );
      return;
    }

    const liveStartError = validateDs160LiveStart(ds160Config);
    if (liveStartError) {
      await processDs160LiveConfigBlockedItem(item, liveStartError);
      return;
    }

    await processDs160Item(item, ds160Config);
  } else if (isFvJob(item)) {
    const franceConfig = loadFranceSubmissionConfig();
    if (!isLiveAssistedQueueItem(item)) {
      await processDryRunItem(item, "global_dry_run");
      return;
    }

    const liveStartError = validateFranceLiveStart(franceConfig);
    if (liveStartError) {
      await processFvConfigBlockedItem(item, liveStartError);
      return;
    }

    await processFvItem(item, franceConfig);
  } else if (isUkJob(item)) {
    await processUkItem(item);
  } else if (isVnJob(item)) {
    if (item.status === "vn_payment_pending") {
      await processVnPaymentItem(item);
    } else {
      await processVnItem(item);
    }
  } else if (isSgacJob(item)) {
    const dueItem = await promoteSgacScheduledIfDue(item);
    if (dueItem) {
      await processSgacLiveItem(dueItem);
    }
  } else if (isMdacJob(item)) {
    const dueItem = await promoteMdacScheduledIfDue(item);
    if (dueItem) {
      await processDigitalArrivalCardLiveItem(dueItem, "MDAC");
    }
  } else if (isTdacJob(item)) {
    const dueItem = await promoteTdacScheduledIfDue(item);
    if (dueItem) {
      await processDigitalArrivalCardLiveItem(dueItem, "TDAC");
    }
  } else if (isPhEtravelJob(item)) {
    const dueItem = await promotePhEtravelScheduledIfDue(item);
    if (dueItem) {
      await processDigitalArrivalCardLiveItem(dueItem, "PH_ETRAVEL");
    }
  } else if (isVietnamPrearrivalJob(item)) {
    const dueItem = await promoteVietnamPrearrivalScheduledIfDue(item);
    if (dueItem) {
      await processVietnamPrearrivalLiveItem(dueItem);
    }
  } else if (isIndonesiaJob(item)) {
    await processIndonesiaItem(item);
  } else if (isAuJob(item)) {
    await processAuItem(item);
  } else {
    await processItem(item);
  }
}

async function pollOnce(): Promise<void> {
  console.log("[poll] Checking submission_queue for pending items...");
  const targetJobId = process.env.SUBMISSION_SERVICE_TARGET_JOB_ID?.trim();
  if (!targetJobId) {
    try {
      const queuedDailyChecks = await enqueueDueVietnamStatusChecks();
      if (queuedDailyChecks > 0) {
        console.log(`[poll] Queued ${queuedDailyChecks} daily Vietnam official status check(s).`);
      }
      const queuedEmailChecks = await enqueueVietnamEmailTriggeredChecks();
      if (queuedEmailChecks > 0) {
        console.log(`[poll] Queued ${queuedEmailChecks} email-triggered Vietnam status check(s).`);
      }
      const processedStatusChecks = await processQueuedVietnamStatusChecks();
      if (processedStatusChecks > 0) {
        console.log(`[poll] Processed ${processedStatusChecks} Vietnam official status check(s).`);
      }
    } catch (err) {
      console.error("[poll] Vietnam official status checks failed:", err);
    }
  }
  if (LEGACY_US_APPOINTMENT_POLL_ENABLED) {
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
  }

  const concurrency = targetJobId ? 1 : readSubmissionQueueConcurrency(process.env);
  let items: SubmissionQueueItem[];
  try {
    items = await fetchPendingItems({ concurrency, targetJobId });
  } catch (err) {
    console.error("[poll] Failed to claim queue:", err);
    return;
  }

  if (items.length === 0) {
    console.log("[poll] No pending items.");
    if (!targetJobId) {
      await markStaleQueueItemsTimedOut();
    }
    return;
  }

  if (targetJobId && items.length === 0) {
    console.log(`[poll] No claimable pending item matched target job ${redactIdentifier(targetJobId)}.`);
    return;
  }

  console.log(`[poll] Found ${items.length} pending item(s).`);

  console.log(`[poll] Processing pending item(s) with concurrency=${concurrency}.`);
  await runSubmissionQueueBatch(items, processPendingQueueItem, { concurrency });

  if (!targetJobId) {
    await markStaleQueueItemsTimedOut();
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

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function consumeVietnamCardSessionWithGrace(
  applicationId: string,
  enabled: boolean,
  waitMs = 15_000,
): Promise<ReturnType<typeof consumeVietnamCardSession>> {
  if (!enabled) return null;
  const deadline = Date.now() + Math.max(0, waitMs);
  let card = consumeVietnamCardSession(applicationId);
  while (!card && Date.now() < deadline) {
    await sleepMs(500);
    card = consumeVietnamCardSession(applicationId);
  }
  return card;
}

async function consumeIndonesiaCardSessionWithGrace(
  applicationId: string,
  enabled: boolean,
  waitMs = 15_000,
): Promise<ReturnType<typeof consumeIndonesiaCardSession>> {
  if (!enabled) return null;
  const deadline = Date.now() + Math.max(0, waitMs);
  let card = consumeIndonesiaCardSession(applicationId);
  while (!card && Date.now() < deadline) {
    await sleepMs(500);
    card = consumeIndonesiaCardSession(applicationId);
  }
  return card;
}

function shutdownRunner(signal: string): void {
  console.log(`[main] ${signal} received — stopping runner_job consumer`);
  runnerAbort.abort();
}
process.on("SIGTERM", () => shutdownRunner("SIGTERM"));
process.on("SIGINT", () => shutdownRunner("SIGINT"));

async function main(): Promise<void> {
  // DEP-003: fail fast on misconfiguration before doing any work.
  validateEnv();

  // DEP-004: local handoff endpoints and Cloud Run probes should be available
  // before slower runner configuration logging and queue startup complete.
  startHealthServer({ isWorkerStarted: () => runnerStarted });

  console.log("[main] VIZA Submission Service starting...");
  console.log(`[main] Polling every ${POLL_INTERVAL_MS / 1000}s`);
  if (SUBMISSION_PROVIDER_ALLOWLIST.size > 0) {
    console.log(`[main] Provider allowlist active: ${Array.from(SUBMISSION_PROVIDER_ALLOWLIST).join(",")}`);
  }
  if (!LEGACY_US_APPOINTMENT_POLL_ENABLED) {
    console.log("[main] Legacy US appointment poll disabled by env");
  }
  if (!RUNNER_JOB_CONSUMER_ENABLED) {
    console.log("[main] runner_job consumer disabled by env");
  }
  if (!LEGACY_SUBMISSION_QUEUE_ENABLED) {
    console.log("[main] Legacy submission_queue polling disabled by env");
  }
  if (RUNNER_JOB_COUNTRY) {
    console.log(`[main] runner_job country scope=${RUNNER_JOB_COUNTRY}`);
  }
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
      `playwright=${usAppointmentConfig.playwrightEnabled}`,
      `headless=${usAppointmentConfig.playwrightHeadless}`,
      `baseUrl=${usAppointmentConfig.baseUrl}`,
    ].join(" "),
  );
  const usAppointmentStartError = validateUSAppointmentRunnerStart(usAppointmentConfig);
  if (usAppointmentStartError) {
    console.warn(`[main] US appointment runner startup check blocked: ${usAppointmentStartError}`);
  }

  if (/^(1|true|yes|on)$/i.test(process.env.SUBMISSION_SERVICE_LOCAL_ENDPOINTS_ONLY ?? "")) {
    runnerStarted = true;
    console.log("[main] Local endpoints only mode enabled; submission polling and runner_job consumer are disabled.");
    return;
  }

  // Country-scoped cloud workers must not also contend for the legacy queue.
  // A single dedicated legacy worker retains this consumer during migration.
  if (LEGACY_SUBMISSION_QUEUE_ENABLED) {
    await poll();
    setInterval(poll, POLL_INTERVAL_MS);
  }

  // QUE-002: start the runner_job consumer (does not block the legacy poll).
  if (RUNNER_JOB_CONSUMER_ENABLED) {
    console.log(`[main] runner_job consumer active (workerId=${RUNNER_WORKER_ID})`);
    runnerStarted = true;
    void pollAndRun(RUNNER_WORKER_ID, runnerJobHandler, {
      country: RUNNER_JOB_COUNTRY,
      signal: runnerAbort.signal,
    }).catch((err) => {
      console.error("[main] runner_job consumer crashed", err);
    });
  } else {
    runnerStarted = true;
  }
}

main().catch((err) => {
  console.error("[main] Fatal error:", err);
  process.exit(1);
});
