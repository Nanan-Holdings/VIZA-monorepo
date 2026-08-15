export interface RequeueRpcClient {
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Requeue one failed/dead-letter runner job through the guarded database RPC.
 * A false result is a concurrent eligibility conflict, not a success.
 */
export async function requeueRunnerJob(
  client: RequeueRpcClient,
  jobId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("requeue_runner_job", {
    p_job_id: jobId,
  });
  if (error) throw new Error(`requeue_runner_job: ${error.message}`);
  return data === true;
}
