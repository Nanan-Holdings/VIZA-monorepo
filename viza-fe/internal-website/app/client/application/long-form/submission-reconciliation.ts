import type { SubmissionResult, SubmissionResultStatus } from "@/lib/submission-result";

export type SubmissionReconciliationResult =
  | {
      kind: "accepted";
      jobId: string | null;
      submissionResultStatus: SubmissionResultStatus;
      submissionResult: SubmissionResult | null;
    }
  | {
      kind: "not_accepted";
    }
  | {
      kind: "unconfirmed";
      reason: "network_error" | "http_error" | "invalid_response";
      status?: number;
    };

export interface SubmissionReconciliationOptions {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const SUBMISSION_RESULT_STATUSES = new Set<SubmissionResultStatus>([
  "waiting",
  "scheduled",
  "processing",
  "needs_user_action",
  "needs_attention",
  "completed",
  "stalled",
  "submitted",
  "qr_ready",
  "approved",
  "rejected",
  "submitted_mock",
  "unsupported",
  "action_required",
  "stopped_at_sign",
  "stopped_at_pay",
  "stopped_at_review",
  "final_review_required",
  "blocked",
  "form_ready_for_agency",
  "form_ready_for_kvac",
  "failed",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asStatus(value: unknown): string | null {
  return typeof value === "string" ? value.trim().toLowerCase() : null;
}

function asSubmissionResultStatus(value: unknown): SubmissionResultStatus | null {
  const normalized = asStatus(value);
  return normalized && SUBMISSION_RESULT_STATUSES.has(normalized as SubmissionResultStatus)
    ? (normalized as SubmissionResultStatus)
    : null;
}

function isAcceptedStatus(value: unknown): boolean {
  const normalized = asStatus(value);
  if (!normalized) return false;
  if (
    [
      "queued",
      "pending",
      "waiting",
      "scheduled",
      "running",
      "processing",
      "needs_user_action",
      "needs_attention",
      "completed",
      "submitted",
      "qr_ready",
      "approved",
      "rejected",
      "submitted_mock",
      "action_required",
      "stalled",
      "blocked",
    ].includes(normalized)
  ) {
    return true;
  }
  return /(?:^|_)(?:pending|processing|scheduled|blocked)$/u.test(normalized);
}

function hasAcceptedSubmission(payload: Record<string, unknown>): boolean {
  const queue = asRecord(payload.queue);
  const jobId = typeof payload.jobId === "string" && payload.jobId.trim() ? payload.jobId : null;
  const queueId = typeof queue?.id === "string" && queue.id.trim() ? queue.id : null;
  const result = asRecord(payload.result);
  if (jobId || queueId || result) return true;

  return [payload.status, payload.applicationStatus, queue?.status].some(isAcceptedStatus);
}

function deriveSubmissionResultStatus(payload: Record<string, unknown>): SubmissionResultStatus {
  const applicationStatus = asSubmissionResultStatus(payload.applicationStatus);
  if (applicationStatus) return applicationStatus;

  const status = asStatus(payload.status);
  if (status === "queued" || status === "pending" || status === "waiting") return "waiting";
  if (status === "running") return "processing";
  const directStatus = asSubmissionResultStatus(status);
  if (directStatus) return directStatus;
  if (status?.endsWith("_processing")) return "processing";
  if (status?.endsWith("_scheduled")) return "scheduled";
  if (status?.endsWith("_blocked")) return "blocked";

  const queue = asRecord(payload.queue);
  const queueStatus = asStatus(queue?.status);
  if (queueStatus === "queued" || queueStatus === "pending") return "waiting";
  if (queueStatus === "running" || queueStatus === "processing") return "processing";
  const directQueueStatus = asSubmissionResultStatus(queueStatus);
  if (directQueueStatus) return directQueueStatus;
  if (queueStatus?.endsWith("_processing")) return "processing";
  if (queueStatus?.endsWith("_scheduled")) return "scheduled";
  if (queueStatus?.endsWith("_blocked")) return "blocked";

  const result = asRecord(payload.result);
  return asSubmissionResultStatus(result?.status) ?? "waiting";
}

/**
 * A browser transport error is ambiguous after the enqueue request has been
 * sent: the server may have committed the queue before the response was lost.
 * Keep ordinary validation/auth errors out of this recovery path.
 */
export function isSubmissionTransportError(error: unknown): boolean {
  if (!(error instanceof Error) || error.name === "AbortError") return false;
  if (error.name === "NetworkError" || error.name === "FetchError") return true;
  if (error.name !== "TypeError") return false;
  const message = error.message.trim().toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed")
  );
}

export async function reconcileSubmissionStatus(
  applicationId: string,
  options: SubmissionReconciliationOptions = {},
): Promise<SubmissionReconciliationResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? 8_000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", forwardAbort, { once: true });
  try {
    const response = await fetchImpl(
      `/api/applications/${encodeURIComponent(applicationId)}/submission-status`,
      {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      return { kind: "unconfirmed", reason: "http_error", status: response.status };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { kind: "unconfirmed", reason: "invalid_response" };
    }
    const record = asRecord(payload);
    if (!record) return { kind: "unconfirmed", reason: "invalid_response" };
    if (!hasAcceptedSubmission(record)) return { kind: "not_accepted" };

    const queue = asRecord(record.queue);
    const jobId =
      typeof record.jobId === "string" && record.jobId.trim()
        ? record.jobId
        : typeof queue?.id === "string" && queue.id.trim()
          ? queue.id
          : null;
    return {
      kind: "accepted",
      jobId,
      submissionResultStatus: deriveSubmissionResultStatus(record),
      submissionResult: (asRecord(record.result) as SubmissionResult | null) ?? null,
    };
  } catch {
    return { kind: "unconfirmed", reason: "network_error" };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }
}
