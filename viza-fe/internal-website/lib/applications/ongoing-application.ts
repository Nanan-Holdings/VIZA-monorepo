import {
  getCanonicalApplicationProductCountry,
} from "@/lib/visa-destinations";
import { visaFormSchemaVisaTypesMatch } from "@/lib/visa-form-schema-aliases";

export interface ApplicationLifecycleRecord {
  country?: string | null;
  visa_type?: string | null;
  purpose?: string | null;
  status?: string | null;
  submission_result_status?: string | null;
  result_status?: string | null;
  submission_result?: unknown;
}

const TERMINAL_APPLICATION_STATUSES = new Set([
  "submitted",
  "submitted_mock",
  "form_ready_for_agency",
  "completed",
  "approved",
  "rejected",
  "cancelled",
  "canceled",
  "archived",
  "failed",
  "stalled",
]);

const TERMINAL_SUBMISSION_RESULT_STATUSES = new Set([
  "completed",
  "complete",
  "submitted",
  "success",
  "done",
]);

const TERMINAL_RESULT_STATUSES = new Set([
  "approved",
  "approved_pending_document",
  "issued",
  "granted",
  "rejected",
  "refused",
  "denied",
]);

function normalize(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isOngoingApplicationRecord(
  application: ApplicationLifecycleRecord
): boolean {
  const submissionResult = asRecord(application.submission_result);
  return (
    application.purpose !== "VIZA_PLACEHOLDER_DRY_RUN" &&
    !TERMINAL_APPLICATION_STATUSES.has(
      normalize(application.status || "draft")
    ) &&
    !TERMINAL_SUBMISSION_RESULT_STATUSES.has(
      normalize(application.submission_result_status)
    ) &&
    !TERMINAL_RESULT_STATUSES.has(normalize(application.result_status)) &&
    submissionResult?.submitted !== true &&
    normalize(
      typeof submissionResult?.status === "string"
        ? submissionResult.status
        : null
    ) !== "submitted"
  );
}

export function applicationIdentityMatches(
  application: ApplicationLifecycleRecord,
  country: string,
  visaType: string
): boolean {
  if (!application.country || !application.visa_type) return false;
  const canonicalCountry = getCanonicalApplicationProductCountry(country, visaType);
  return (
    getCanonicalApplicationProductCountry(
      application.country,
      application.visa_type,
    ) === canonicalCountry &&
    visaFormSchemaVisaTypesMatch(
      application.visa_type,
      visaType,
      canonicalCountry
    )
  );
}

export function findOngoingApplicationByIdentity<
  T extends ApplicationLifecycleRecord,
>(applications: T[], country: string, visaType: string): T | null {
  return (
    applications.find(
      (application) =>
        applicationIdentityMatches(application, country, visaType) &&
        isOngoingApplicationRecord(application)
    ) ?? null
  );
}
