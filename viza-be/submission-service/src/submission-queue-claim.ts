import type { SubmissionQueueItem } from "./types";

export interface SubmissionQueueClaimOptions {
  workerId: string;
  limit: number;
  leaseSeconds: number;
  targetJobId?: string | null;
  maxAttempts?: number;
}

interface RpcError {
  message: string;
}

interface SubmissionQueueClaimClient {
  rpc(
    name: "claim_submission_queue_batch",
    args: {
      p_worker_id: string;
      p_limit: number;
      p_lease_seconds: number;
      p_target_job_id: string | null;
      p_max_attempts: number;
    },
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

export async function claimPendingSubmissionQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  const { data, error } = await client.rpc("claim_submission_queue_batch", {
    p_worker_id: options.workerId,
    p_limit: options.limit,
    p_lease_seconds: options.leaseSeconds,
    p_target_job_id: options.targetJobId ?? null,
    p_max_attempts: options.maxAttempts ?? 3,
  });

  if (error) {
    throw new Error(`Failed to claim submission_queue batch: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []) as SubmissionQueueItem[];
}

export function claimBatchLimitForConcurrency(concurrency: number): number {
  return Math.max(20, Math.min(Math.max(1, Math.floor(concurrency)) * 4, 100));
}
