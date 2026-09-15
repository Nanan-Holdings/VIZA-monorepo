import { supabase } from "../supabase";

export type USAppointmentClaimOutcome = "completed" | "failed" | "skipped";

export interface USAppointmentClaimRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ownership is decided atomically by PostgreSQL before any browser is opened. */
export class SupabaseUSAppointmentClaims {
  constructor(private readonly db: USAppointmentClaimRpcClient = supabase) {}

  async claim(jobId: string, workerId: string): Promise<{ claimId: string } | null> {
    let result: { data: unknown; error: unknown };
    try {
      result = await this.db.rpc("claim_us_appointment_runner_job", {
        p_job_id: jobId,
        p_worker_id: workerId,
      });
    } catch {
      throw new Error("US_APPOINTMENT_CLAIM_FAILED");
    }
    if (result.error) throw new Error("US_APPOINTMENT_CLAIM_FAILED");
    if (result.data === null) return null;
    if (typeof result.data !== "string" || !UUID.test(result.data)) {
      throw new Error("US_APPOINTMENT_CLAIM_INVALID_RESPONSE");
    }
    return { claimId: result.data };
  }

  async finish(claimId: string, workerId: string, outcome: USAppointmentClaimOutcome): Promise<void> {
    let result: { data: unknown; error: unknown };
    try {
      result = await this.db.rpc("finish_us_appointment_runner_job", {
        p_claim_id: claimId,
        p_worker_id: workerId,
        p_outcome: outcome,
      });
    } catch {
      throw new Error("US_APPOINTMENT_CLAIM_FINISH_FAILED");
    }
    if (result.error) throw new Error("US_APPOINTMENT_CLAIM_FINISH_FAILED");
    if (result.data !== true) throw new Error("US_APPOINTMENT_CLAIM_FINISH_CONFLICT");
  }
}
