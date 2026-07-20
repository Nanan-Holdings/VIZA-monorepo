export interface ArrivalCardApplicationResult {
  submitted?: unknown;
}

export interface CompletedArrivalCardQueue {
  mode?: string | null;
  official_status?: string | null;
  live_submitted_at?: string | null;
}

export function hasOfficialArrivalCardSuccess(input: {
  applicationResult?: ArrivalCardApplicationResult | null;
  completedQueues?: CompletedArrivalCardQueue[] | null;
}): boolean {
  if (input.applicationResult?.submitted === true) return true;

  return (input.completedQueues ?? []).some((queue) => (
    queue.mode === "live_assisted"
    && queue.official_status === "submitted"
    && Boolean(queue.live_submitted_at?.trim())
  ));
}
