import type { SubmissionQueueItem } from "./types";

export interface SubmissionQueueClaimOptions {
  workerId: string;
  limit: number;
  leaseSeconds: number;
  targetJobId?: string | null;
  maxAttempts?: number;
}

interface RpcError {
  code?: string;
  message: string;
}

interface SubmissionQueueClaimClient {
  rpc(
    name: "claim_submission_queue_batch" | "claim_vn_cloud_submission_queue_batch",
    args: {
      p_worker_id: string;
      p_limit: number;
      p_lease_seconds: number;
      p_target_job_id: string | null;
      p_max_attempts: number;
    },
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

async function claimSubmissionQueueItems(
  client: SubmissionQueueClaimClient,
  rpcName: "claim_submission_queue_batch" | "claim_vn_cloud_submission_queue_batch",
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  const { data, error } = await client.rpc(rpcName, {
    p_worker_id: options.workerId,
    p_limit: options.limit,
    p_lease_seconds: options.leaseSeconds,
    p_target_job_id: options.targetJobId ?? null,
    p_max_attempts: options.maxAttempts ?? 3,
  });

  if (error) {
    throw new Error(`Failed to claim submission_queue batch via ${rpcName}: ${error.message}`);
  }

  return (Array.isArray(data) ? data : []) as SubmissionQueueItem[];
}

export async function claimPendingSubmissionQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  return claimSubmissionQueueItems(client, "claim_submission_queue_batch", options);
}

export async function claimPendingVietnamCloudQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  return claimSubmissionQueueItems(client, "claim_vn_cloud_submission_queue_batch", options);
}

export function isSubmissionQueueClaimRpcUnavailableError(error: unknown): boolean {
  const maybeRecord = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const code = typeof maybeRecord.code === "string" ? maybeRecord.code : "";
  const message = error instanceof Error ? error.message : String(maybeRecord.message ?? error);

  return (
    code === "PGRST202" ||
    /claim_submission_queue_batch/i.test(message) &&
      (/schema cache/i.test(message) ||
        /could not find/i.test(message) ||
        /does not exist/i.test(message) ||
        /unknown function/i.test(message))
  );
}

export function claimBatchLimitForConcurrency(concurrency: number): number {
  return Math.max(20, Math.min(Math.max(1, Math.floor(concurrency)) * 4, 100));
}
