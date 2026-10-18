/**
 * Pure model for the staff queue: every application that needs a human,
 * in one list, newest signal first, with QA and staff test data hidden.
 *
 * Sources (loaded by `data.ts`):
 *   - applications.status = staff_action_required (manual destinations,
 *     face-match review) or failed
 *   - latest runner_job per application = needs_human
 *   - latest submission_queue row per application failed, blocked,
 *     stalled, prefilled-and-waiting, or with a pending manual action
 *   - open admin_work_items linked to an application
 *   - staff-tracked cases waiting on the government or the applicant
 */

import { isQaDryRunPurpose } from "@/lib/applications/qa-safety";

export const QUEUE_REASONS = [
  "staff_action_required",
  "runner_needs_human",
  "submission_failed",
  "submission_awaiting_staff",
  "work_item",
  "awaiting_applicant",
  "awaiting_decision",
] as const;
export type QueueReason = (typeof QUEUE_REASONS)[number];

/** Reasons where a staff member must act now (the default view). */
export const ACTION_REASONS: ReadonlySet<QueueReason> = new Set([
  "staff_action_required",
  "runner_needs_human",
  "submission_failed",
  "submission_awaiting_staff",
  "work_item",
]);

export const TEST_EMAIL_PATTERN = /@(viza\.test|example\.com|test\.com|example\.invalid)$/i;

/** Application statuses that are closed: automation failures on them are stale. */
const CLOSED_STATUSES = new Set(["approved", "rejected", "completed", "cancelled", "canceled", "archived", "refunded"]);
/** Statuses where a staff-recorded submission supersedes old automation failures. */
const STAFF_RESOLVED_STATUSES = new Set([...CLOSED_STATUSES, "submitted", "awaiting_applicant"]);

export interface QueueApplicationRow {
  id: string;
  applicant_id: string;
  country: string | null;
  visa_type: string | null;
  purpose: string | null;
  status: string | null;
  external_status: string | null;
  external_reference: string | null;
  result_status: string | null;
  result_notes: string | null;
  submitted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  qa_archived_at?: string | null;
}

export interface QueueProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

export interface QueueRunnerJobRow {
  id: string;
  application_id: string;
  status: string;
  last_error: string | null;
  enqueued_at: string | null;
  finished_at: string | null;
}

export interface QueueSubmissionRow {
  id: string;
  application_id: string;
  status: string | null;
  manual_action_status: string | null;
  error_code: string | null;
  error_message: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface QueueWorkItemRow {
  id: string;
  application_id: string | null;
  kind: string;
  title: string;
  status: string;
  priority: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface QueueSourceData {
  applications: QueueApplicationRow[];
  profiles: QueueProfileRow[];
  staffEmails: string[];
  runnerJobs: QueueRunnerJobRow[];
  submissions: QueueSubmissionRow[];
  workItems: QueueWorkItemRow[];
}

export interface QueueSignal {
  reason: QueueReason;
  detail: string | null;
  at: string | null;
  sourceId: string | null;
}

export interface QueueItem {
  applicationId: string;
  applicantId: string;
  applicantName: string | null;
  applicantEmail: string | null;
  country: string | null;
  visaType: string | null;
  status: string | null;
  externalReference: string | null;
  signals: QueueSignal[];
  latestAt: string | null;
  isTest: boolean;
  needsAction: boolean;
}

function lower(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function time(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function latestBy<T>(rows: T[], key: (row: T) => string, at: (row: T) => string | null): Map<string, T> {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const current = latest.get(key(row));
    if (!current || time(at(row)) > time(at(current))) latest.set(key(row), row);
  }
  return latest;
}

export function isTestIdentity(email: string | null | undefined, staffEmails: ReadonlySet<string>): boolean {
  const normalized = lower(email);
  if (!normalized) return false;
  return TEST_EMAIL_PATTERN.test(normalized) || staffEmails.has(normalized);
}

export function isTestApplication(
  application: Pick<QueueApplicationRow, "purpose" | "qa_archived_at">,
  profile: Pick<QueueProfileRow, "email"> | undefined,
  staffEmails: ReadonlySet<string>,
): boolean {
  return (
    isQaDryRunPurpose(application.purpose) ||
    Boolean(application.qa_archived_at) ||
    isTestIdentity(profile?.email, staffEmails)
  );
}

export function isFailedSubmissionStatus(status: string | null | undefined): boolean {
  const s = lower(status);
  if (!s || s.includes("dry_run") || s === "retry_superseded") return false;
  return s === "failed" || s === "stalled" || s.endsWith("_failed") || s.endsWith("_blocked");
}

export function isAwaitingStaffSubmission(row: Pick<QueueSubmissionRow, "status" | "manual_action_status">): boolean {
  const s = lower(row.status);
  if (!s || s.includes("dry_run") || s === "retry_superseded") return false;
  const manual = lower(row.manual_action_status);
  return s.endsWith("_prefilled") || s.endsWith("_official_portal_opened") || manual === "pending" || manual === "required";
}

const OPEN_WORK_STATUSES = new Set(["open", "in_progress", "waiting_customer", "blocked"]);

export function buildStaffQueue(data: QueueSourceData, options: { includeTest?: boolean } = {}): QueueItem[] {
  const staffEmails = new Set(data.staffEmails.map(lower).filter(Boolean));
  const profiles = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const signals = new Map<string, QueueSignal[]>();
  const add = (applicationId: string, signal: QueueSignal) => {
    const list = signals.get(applicationId) ?? [];
    list.push(signal);
    signals.set(applicationId, list);
  };

  const applications = new Map(data.applications.map((application) => [application.id, application]));

  for (const application of data.applications) {
    const status = lower(application.status);
    if (status === "staff_action_required") {
      add(application.id, { reason: "staff_action_required", detail: application.result_notes, at: application.updated_at, sourceId: null });
    } else if (status === "failed") {
      add(application.id, { reason: "submission_failed", detail: application.result_notes, at: application.updated_at, sourceId: null });
    } else if (status === "awaiting_applicant") {
      add(application.id, { reason: "awaiting_applicant", detail: application.result_notes, at: application.updated_at, sourceId: null });
    } else if (status === "submitted" && lower(application.external_status) === "submitted" && !application.result_status) {
      add(application.id, {
        reason: "awaiting_decision",
        detail: application.external_reference,
        at: application.submitted_at ?? application.updated_at,
        sourceId: null,
      });
    }
  }

  const latestJobs = latestBy(data.runnerJobs, (job) => job.application_id, (job) => job.enqueued_at);
  for (const job of latestJobs.values()) {
    if (lower(job.status) !== "needs_human") continue;
    if (STAFF_RESOLVED_STATUSES.has(lower(applications.get(job.application_id)?.status))) continue;
    add(job.application_id, { reason: "runner_needs_human", detail: job.last_error, at: job.finished_at ?? job.enqueued_at, sourceId: job.id });
  }

  const liveSubmissions = data.submissions.filter((row) => lower(row.status) !== "retry_superseded");
  const latestSubmissions = latestBy(liveSubmissions, (row) => row.application_id, (row) => row.updated_at ?? row.created_at);
  for (const row of latestSubmissions.values()) {
    if (STAFF_RESOLVED_STATUSES.has(lower(applications.get(row.application_id)?.status))) continue;
    const detail = row.error_message ?? row.last_error ?? row.error_code ?? row.status;
    if (isFailedSubmissionStatus(row.status)) {
      add(row.application_id, { reason: "submission_failed", detail, at: row.updated_at ?? row.created_at, sourceId: row.id });
    } else if (isAwaitingStaffSubmission(row)) {
      add(row.application_id, { reason: "submission_awaiting_staff", detail: row.status, at: row.updated_at ?? row.created_at, sourceId: row.id });
    }
  }

  for (const item of data.workItems) {
    if (!item.application_id || !OPEN_WORK_STATUSES.has(lower(item.status))) continue;
    add(item.application_id, { reason: "work_item", detail: `${item.priority.toUpperCase()} ${item.title}`, at: item.updated_at ?? item.created_at, sourceId: item.id });
  }

  const items: QueueItem[] = [];
  for (const [applicationId, list] of signals) {
    const application = applications.get(applicationId);
    if (!application) continue;
    const status = lower(application.status);
    if (status === "archived" || application.qa_archived_at) continue;
    const profile = profiles.get(application.applicant_id);
    const isTest = isTestApplication(application, profile, staffEmails);
    if (isTest && !options.includeTest) continue;

    list.sort((a, b) => time(b.at) - time(a.at));
    items.push({
      applicationId,
      applicantId: application.applicant_id,
      applicantName: profile?.full_name ?? null,
      applicantEmail: profile?.email ?? null,
      country: application.country,
      visaType: application.visa_type,
      status: application.status,
      externalReference: application.external_reference,
      signals: list,
      latestAt: list[0]?.at ?? application.updated_at,
      isTest,
      needsAction: list.some((signal) => ACTION_REASONS.has(signal.reason)),
    });
  }

  return items.sort((a, b) => time(b.latestAt) - time(a.latestAt));
}
