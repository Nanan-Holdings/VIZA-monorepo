import type { SubmissionQueueItem } from "./types";

export interface SubmissionQueueClaimOptions {
  workerId: string;
  limit: number;
  leaseSeconds: number;
  targetJobId?: string | null;
  maxAttempts?: number;
  providerAllowlist?: string[] | null;
  allowFailed?: boolean;
}

interface RpcError {
  code?: string;
  message: string;
}

interface SubmissionQueueClaimClient {
  rpc(
    name:
      | "claim_submission_queue_batch"
      | "claim_vn_cloud_submission_queue_batch"
      | "claim_indonesia_submission_queue_batch",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: RpcError | null }>;
}

async function claimSubmissionQueueItems(
  client: SubmissionQueueClaimClient,
  rpcName:
    | "claim_vn_cloud_submission_queue_batch"
    | "claim_indonesia_submission_queue_batch",
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
  const providerAllowlist = options.providerAllowlist
    ?.map((provider) => provider.trim())
    .filter(Boolean);
  const { data, error } = await client.rpc("claim_submission_queue_batch", {
    p_worker_id: options.workerId,
    p_limit: options.limit,
    p_lease_seconds: options.leaseSeconds,
    p_target_job_id: options.targetJobId ?? null,
    p_max_attempts: options.maxAttempts ?? 3,
    p_provider_allowlist:
      providerAllowlist && providerAllowlist.length > 0 ? providerAllowlist : null,
    p_allow_failed: options.allowFailed ?? false,
  });

  if (error) {
    throw new Error(
      `Failed to claim submission_queue batch via claim_submission_queue_batch: ${error.message}`,
    );
  }

  return (Array.isArray(data) ? data : []) as SubmissionQueueItem[];
}

export async function claimPendingVietnamCloudQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  return claimSubmissionQueueItems(client, "claim_vn_cloud_submission_queue_batch", options);
}

export async function claimPendingIndonesiaQueueItems(
  client: SubmissionQueueClaimClient,
  options: SubmissionQueueClaimOptions,
): Promise<SubmissionQueueItem[]> {
  return claimSubmissionQueueItems(
    client,
    "claim_indonesia_submission_queue_batch",
    options,
  );
}

export function claimBatchLimitForConcurrency(concurrency: number): number {
  return Math.max(20, Math.min(Math.max(1, Math.floor(concurrency)) * 4, 100));
}
