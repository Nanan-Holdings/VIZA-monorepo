import type { Page } from "@playwright/test";
import { supabase } from "../supabase.js";
import {
  RunnerJobOwnershipLostError,
  type RunnerExecutionContext,
} from "../queue/execution-context.js";
import {
  readTwOfficialReceiptEvidence,
  type TwOfficialReceiptEvidence,
} from "./receipt.js";

/**
 * The worker never mutates takeover tables directly. These errors inherit the
 * queue ownership error so a stale/reclaimed worker cannot write a fallback
 * failure after an applicant handoff conflict.
 */
export class TwApplicantHandoffConflictError extends RunnerJobOwnershipLostError {
  readonly handoffCode = "tw_applicant_handoff_conflict" as const;

  constructor(message = "Taiwan applicant handoff ownership was lost") {
    super(message);
    this.name = "TwApplicantHandoffConflictError";
  }
}

export class TwApplicantHandoffExpiredError extends Error {
  readonly code = "tw_applicant_handoff_expired" as const;

  constructor() {
    super("Taiwan applicant handoff expired before official receipt evidence was captured");
    this.name = "TwApplicantHandoffExpiredError";
  }
}

export interface TwApplicantHandoffRegistration {
  takeoverId: string;
  applicationId: string;
  expiresAt: string;
}

interface OpenHandoffRow {
  opened: unknown;
  takeover_id: unknown;
  application_id: unknown;
  expires_at: unknown;
}

interface SettleHandoffRow {
  settled: unknown;
  job_id: unknown;
  application_id: unknown;
  handoff_status: unknown;
}

function firstRpcRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    if (data.length !== 1) return null;
    data = data[0];
  }
  const row = data;
  return row && typeof row === "object" && !Array.isArray(row)
    ? (row as Record<string, unknown>)
    : null;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseOpenHandoff(data: unknown, applicationId: string): TwApplicantHandoffRegistration {
  const row = firstRpcRow(data) as OpenHandoffRow | null;
  if (
    !row
    || row.opened !== true
    || !isNonBlankString(row.takeover_id)
    || row.application_id !== applicationId
    || !isNonBlankString(row.expires_at)
    || !Number.isFinite(Date.parse(row.expires_at))
  ) {
    throw new TwApplicantHandoffConflictError("Taiwan applicant handoff open lost job ownership");
  }
  return {
    takeoverId: row.takeover_id,
    applicationId,
    expiresAt: row.expires_at,
  };
}

function parseSettleHandoff(
  data: unknown,
  input: { jobId: string; applicationId: string },
): void {
  const row = firstRpcRow(data) as SettleHandoffRow | null;
  if (
    !row
    || row.settled !== true
    || row.job_id !== input.jobId
    || row.application_id !== input.applicationId
    || (row.handoff_status !== "completed" && row.handoff_status !== "abandoned")
  ) {
    throw new TwApplicantHandoffConflictError("Taiwan applicant handoff settlement lost job ownership");
  }
}

function requireIdentity(
  execution: RunnerExecutionContext,
  input: { jobId: string; workerId: string },
): void {
  if (execution.jobId !== input.jobId || execution.workerId !== input.workerId) {
    throw new TwApplicantHandoffConflictError("Taiwan applicant handoff identity mismatch");
  }
  execution.assertOwned();
}

export async function registerTwApplicantHandoff(input: {
  jobId: string;
  workerId: string;
  applicationId: string;
  applicantId: string;
  browserbaseSessionId: string;
  liveViewUrl: string;
  expiresAt: string;
  stoppedResult: Record<string, unknown>;
  execution: RunnerExecutionContext;
}): Promise<TwApplicantHandoffRegistration> {
  requireIdentity(input.execution, input);
  const { data, error } = await supabase.rpc("open_tw_applicant_handoff", {
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_application_id: input.applicationId,
    p_applicant_id: input.applicantId,
    p_browserbase_session_id: input.browserbaseSessionId,
    p_vnc_url: input.liveViewUrl,
    p_expires_at: input.expiresAt,
    p_stopped_result: input.stoppedResult,
  });
  if (error) throw new Error(`open_tw_applicant_handoff: ${error.message}`);
  input.execution.assertOwned();
  return parseOpenHandoff(data, input.applicationId);
}

function waitForPollOrOwnership(
  signal: AbortSignal,
  pollMs: number,
): Promise<void> {
  if (signal.aborted) return Promise.reject(new TwApplicantHandoffConflictError());
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = (): void => {
      signal.removeEventListener("abort", onAbort);
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const onAbort = (): void => {
      cleanup();
      reject(new TwApplicantHandoffConflictError());
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, pollMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function waitForTwApplicantSubmission(input: {
  page: Page;
  takeoverId: string;
  jobId: string;
  workerId: string;
  applicationId: string;
  expiresAt: string;
  execution: RunnerExecutionContext;
  /** Builds the bounded submitted payload after official receipt capture. */
  buildSubmissionResult: (receipt: TwOfficialReceiptEvidence) => Record<string, unknown>;
  pollMs?: number;
}): Promise<TwOfficialReceiptEvidence> {
  requireIdentity(input.execution, { jobId: input.jobId, workerId: input.workerId });
  const pollMs = Math.max(0, input.pollMs ?? 1_500);
  const deadline = Date.parse(input.expiresAt);
  if (!Number.isFinite(deadline)) throw new Error("Taiwan applicant handoff expiry is invalid");

  while (Date.now() < deadline) {
    input.execution.checkpoint("taiwan applicant handoff poll");
    const receipt = await readTwOfficialReceiptEvidence(input.page).catch(() => null);
    if (receipt?.caseNumber && Date.now() < deadline) {
      input.execution.checkpoint("taiwan applicant receipt settle");
      const { data, error } = await supabase.rpc("settle_tw_applicant_handoff", {
        p_takeover_id: input.takeoverId,
        p_job_id: input.jobId,
        p_worker_id: input.workerId,
        p_outcome: "completed",
        p_submission_result: input.buildSubmissionResult(receipt),
      });
      if (error) throw new Error(`settle_tw_applicant_handoff: ${error.message}`);
      input.execution.assertOwned();
      parseSettleHandoff(data, input);
      return receipt;
    }
    await waitForPollOrOwnership(input.execution.signal, pollMs);
  }

  input.execution.checkpoint("taiwan applicant handoff expiry settle");
  const { data, error } = await supabase.rpc("settle_tw_applicant_handoff", {
    p_takeover_id: input.takeoverId,
    p_job_id: input.jobId,
    p_worker_id: input.workerId,
    p_outcome: "abandoned",
    p_submission_result: null,
  });
  if (error) throw new Error(`settle_tw_applicant_handoff: ${error.message}`);
  input.execution.assertOwned();
  parseSettleHandoff(data, input);
  throw new TwApplicantHandoffExpiredError();
}
