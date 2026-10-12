import { createHash } from "node:crypto";

/**
 * The runner only receives a persistent reservation for the irreversible
 * Sign and Submit click. A queue retry must reuse the same authorization id;
 * an explicitly authorized resubmission must provide a new one.
 */
export type FinalSubmissionGuardDecision =
  | {
      kind: "acquired";
      attemptId: string;
      state: "started";
    }
  | {
      kind: "already_started";
      attemptId: string;
      state: "started";
    }
  | {
      kind: "unknown";
      attemptId: string;
      state: "unknown";
    }
  | {
      kind: "confirmed";
      attemptId: string;
      state: "confirmed";
    };

export type FinalSubmissionGuardInspection =
  | { kind: "available" }
  | FinalSubmissionGuardDecision;

export interface FinalSubmissionEvidence {
  /** Official CEAC Application ID; it is hashed before it reaches Supabase. */
  officialApplicationId: string;
  /** Official confirmation number, when the confirmation surface exposes one. */
  confirmationNumber?: string | null;
  /** URL of the verified official confirmation surface. */
  confirmationPageUrl: string;
}

export interface Ds160FinalSubmissionGuard {
  /** Inspect the durable fence without creating a reservation. */
  inspect(): Promise<FinalSubmissionGuardInspection>;
  /** Atomically reserve this logical final submission before the click. */
  begin(): Promise<FinalSubmissionGuardDecision>;
  /** Persist that the result became unknowable after the reserved attempt. */
  markUnknown(errorCode?: string): Promise<void>;
  /** Persist verified official confirmation evidence. */
  markConfirmed(evidence: FinalSubmissionEvidence): Promise<void>;
}

export interface FinalSubmissionRpcResponse {
  data: unknown;
  error: { message?: string | null } | null;
}

export interface FinalSubmissionReadQuery {
  eq(column: string, value: string): FinalSubmissionReadQuery;
  maybeSingle(): PromiseLike<FinalSubmissionRpcResponse>;
}

export interface FinalSubmissionRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<FinalSubmissionRpcResponse>;
  /** Read-only query used for the pre-bootstrap duplicate fence. */
  from?: (tableName: string) => {
    select(columns: string): FinalSubmissionReadQuery;
  };
}

export interface CreateDs160FinalSubmissionGuardOptions {
  /** Supabase service-role client; no browser or applicant data is accepted. */
  client: FinalSubmissionRpcClient;
  /** VIZA application UUID, used for ownership fencing in the RPC. */
  applicationId: string;
  /** Stable logical submission authorization. New explicit retries use a new id. */
  authorizationId: string;
  /** Claimed submission_queue row UUID. */
  queueId: string;
  /** Current queue lease owner. An empty owner fails closed. */
  ownerId: string;
  /** Queue lease duration used only as a server-side validation bound. */
  leaseSeconds?: number;
}

const BEGIN_RPC = "begin_ds160_final_submission";
const UNKNOWN_RPC = "mark_ds160_final_submission_unknown";
const CONFIRMED_RPC = "confirm_ds160_final_submission";
const DEFAULT_LEASE_SECONDS = 900;
const MAX_ERROR_CODE_LENGTH = 80;

/**
 * Build the durable cross-run guard used by the CEAC final-submit path.
 *
 * The implementation deliberately talks only to narrowly scoped RPCs. The
 * RPCs own the application mutex and queue lease check, so a stale worker
 * cannot settle a reservation after another worker has taken the lease.
 */
export function createDs160FinalSubmissionGuard(
  options: CreateDs160FinalSubmissionGuardOptions,
): Ds160FinalSubmissionGuard {
  const applicationId = requireIdentifier(options.applicationId, "applicationId");
  const authorizationId = requireIdentifier(options.authorizationId, "authorizationId");
  const queueId = requireIdentifier(options.queueId, "queueId");
  const ownerId = requireIdentifier(options.ownerId, "ownerId");
  const leaseSeconds = options.leaseSeconds ?? DEFAULT_LEASE_SECONDS;

  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 60 || leaseSeconds > 7_200) {
    throw new Error("DS-160 final submission lease must be between 60 and 7200 seconds.");
  }

  let reservation: Extract<FinalSubmissionGuardDecision, { kind: "acquired" }> | null = null;

  return {
    async inspect() {
      if (reservation) return reservation;

      if (!options.client.from) {
        throw new Error("DS-160 final submission guard cannot inspect without a read client.");
      }

      const response = await options.client
        .from("ds160_final_submission_attempts")
        .select("id,state")
        .eq("application_id", applicationId)
        .eq("authorization_id", authorizationId)
        .maybeSingle();
      const row = readMaybeRpcRow(response, "ds160_final_submission_attempts read");
      if (!row) return { kind: "available" };

      const attemptId = readString(row, "id");
      const state = readState(row);
      if (state === "confirmed") return { kind: "confirmed", attemptId, state };
      if (state === "unknown") return { kind: "unknown", attemptId, state };
      return { kind: "already_started", attemptId, state: "started" };
    },

    async begin() {
      if (reservation) {
        throw new Error("DS-160 final submission reservation was already acquired in this run.");
      }

      const response = await options.client.rpc(BEGIN_RPC, {
        p_application_id: applicationId,
        p_authorization_id: authorizationId,
        p_queue_id: queueId,
        p_owner_id: ownerId,
        p_lease_seconds: leaseSeconds,
      });
      const row = readRpcRow(response, BEGIN_RPC);
      const decision = parseBeginDecision(row);
      if (decision.kind === "acquired") reservation = decision;
      return decision;
    },

    async markUnknown(errorCode) {
      const acquired = requireReservation(reservation);
      const response = await options.client.rpc(UNKNOWN_RPC, {
        p_attempt_id: acquired.attemptId,
        p_application_id: applicationId,
        p_authorization_id: authorizationId,
        p_queue_id: queueId,
        p_owner_id: ownerId,
        p_error_code: normalizeErrorCode(errorCode),
      });
      assertMutationState(response, UNKNOWN_RPC, acquired.attemptId, "unknown");
    },

    async markConfirmed(evidence) {
      const acquired = requireReservation(reservation);
      const officialApplicationId = requireIdentifier(
        evidence.officialApplicationId,
        "officialApplicationId",
      );
      const confirmationPageUrl = requireIdentifier(
        evidence.confirmationPageUrl,
        "confirmationPageUrl",
      );
      const response = await options.client.rpc(CONFIRMED_RPC, {
        p_attempt_id: acquired.attemptId,
        p_application_id: applicationId,
        p_authorization_id: authorizationId,
        p_queue_id: queueId,
        p_owner_id: ownerId,
        p_official_application_id_hash: hashSensitive(officialApplicationId),
        p_confirmation_number_hash: evidence.confirmationNumber
          ? hashSensitive(evidence.confirmationNumber)
          : null,
        p_confirmation_page_url: confirmationPageUrl,
      });
      assertMutationState(response, CONFIRMED_RPC, acquired.attemptId, "confirmed");
    },
  };
}

export function hashSensitive(value: string): string {
  return createHash("sha256").update(value.trim(), "utf8").digest("hex");
}

function requireReservation(
  reservation: Extract<FinalSubmissionGuardDecision, { kind: "acquired" }> | null,
): Extract<FinalSubmissionGuardDecision, { kind: "acquired" }> {
  if (!reservation) {
    throw new Error("DS-160 final submission must be reserved before recording its outcome.");
  }
  return reservation;
}

function requireIdentifier(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`DS-160 final submission ${name} is required.`);
  return normalized;
}

function normalizeErrorCode(value: string | undefined): string {
  const normalized = (value ?? "final_submission_unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_")
    .slice(0, MAX_ERROR_CODE_LENGTH);
  return normalized || "final_submission_unknown";
}

function readRpcRow(response: FinalSubmissionRpcResponse, functionName: string): Record<string, unknown> {
  if (response.error) {
    throw new Error(`${functionName} failed: ${response.error.message ?? "database RPC error"}`);
  }
  if (Array.isArray(response.data)) {
    if (response.data.length !== 1 || !isRecord(response.data[0])) {
      throw new Error(`${functionName} returned an invalid result.`);
    }
    return response.data[0];
  }
  if (isRecord(response.data)) return response.data;
  throw new Error(`${functionName} returned an invalid result.`);
}

function readMaybeRpcRow(
  response: FinalSubmissionRpcResponse,
  functionName: string,
): Record<string, unknown> | null {
  if (response.error) {
    throw new Error(`${functionName} failed: ${response.error.message ?? "database read error"}`);
  }
  if (response.data === null) return null;
  if (isRecord(response.data)) return response.data;
  throw new Error(`${functionName} returned an invalid result.`);
}

function parseBeginDecision(row: Record<string, unknown>): FinalSubmissionGuardDecision {
  const decision = readString(row, "decision");
  return parseExistingDecision(row, decision);
}

function parseExistingDecision(
  row: Record<string, unknown>,
  decision: string,
): FinalSubmissionGuardDecision {
  const attemptId = readString(row, "attempt_id");
  const state = readState(row);

  if (state === "confirmed") return { kind: "confirmed", attemptId, state };
  if (state === "unknown") return { kind: "unknown", attemptId, state };
  if (decision === "acquired") return { kind: "acquired", attemptId, state: "started" };
  if (decision === "already_started") return { kind: "already_started", attemptId, state: "started" };
  throw new Error("begin_ds160_final_submission returned an unsupported decision.");
}

function assertMutationState(
  response: FinalSubmissionRpcResponse,
  functionName: string,
  expectedAttemptId: string,
  expectedState: "unknown" | "confirmed",
): void {
  const row = readRpcRow(response, functionName);
  const attemptId = readString(row, "attempt_id");
  const state = readState(row);
  if (attemptId !== expectedAttemptId || state !== expectedState) {
    throw new Error(`${functionName} returned an invalid state transition.`);
  }
}

function readString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`DS-160 final submission guard response is missing ${key}.`);
  }
  return value.trim();
}

function readState(row: Record<string, unknown>): "started" | "unknown" | "confirmed" {
  const state = row.attempt_state ?? row.state;
  if (state === "started" || state === "unknown" || state === "confirmed") return state;
  throw new Error("DS-160 final submission guard returned an invalid state.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
