export interface VietnamStatusCheckRpcError {
  message: string;
}

export interface VietnamStatusCheckRpcClient {
  rpc(
    name:
      | "claim_vn_official_status_checks"
      | "complete_vn_official_status_check"
      | "fail_vn_official_status_check",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: VietnamStatusCheckRpcError | null }>;
}

export async function claimVietnamOfficialStatusChecks<T>(
  client: VietnamStatusCheckRpcClient,
  input: { workerId: string; limit?: number; leaseSeconds?: number },
): Promise<T[]> {
  const { data, error } = await client.rpc("claim_vn_official_status_checks", {
    p_worker_id: input.workerId,
    p_limit: input.limit ?? 5,
    p_lease_seconds: input.leaseSeconds ?? 300,
  });
  if (error) {
    throw new Error(`Failed to claim Vietnam official status checks: ${error.message}`);
  }
  return (Array.isArray(data) ? data : []) as T[];
}

export async function completeVietnamOfficialStatusCheck(
  client: VietnamStatusCheckRpcClient,
  input: {
    checkId: string;
    workerId: string;
    patch: Record<string, unknown>;
  },
): Promise<boolean> {
  const { data, error } = await client.rpc("complete_vn_official_status_check", {
    p_check_id: input.checkId,
    p_worker_id: input.workerId,
    p_patch: input.patch,
  });
  if (error) {
    throw new Error(`Failed to complete Vietnam official status check: ${error.message}`);
  }
  return data === true;
}

export async function failVietnamOfficialStatusCheck(
  client: VietnamStatusCheckRpcClient,
  input: {
    checkId: string;
    workerId: string;
    errorCode: string;
    errorMessage: string;
    rawStatusJson?: Record<string, unknown>;
  },
): Promise<boolean> {
  const { data, error } = await client.rpc("fail_vn_official_status_check", {
    p_check_id: input.checkId,
    p_worker_id: input.workerId,
    p_error_code: input.errorCode,
    p_error_message: input.errorMessage,
    p_raw_status_json: input.rawStatusJson ?? {},
  });
  if (error) {
    throw new Error(`Failed to fail Vietnam official status check: ${error.message}`);
  }
  return data === true;
}
