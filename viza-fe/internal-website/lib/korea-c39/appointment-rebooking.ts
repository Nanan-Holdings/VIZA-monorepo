export interface KoreaRebookingJobState {
  id: string;
  status: string;
  user_preferences_json: Record<string, unknown> | null;
}

export type KoreaRebookingPlan =
  | { kind: "create"; previousJobId: string; idempotencyKey: string }
  | { kind: "reuse"; jobId: string }
  | { kind: "reject"; reason: "active_appointment" | "appointment_not_cancelled" };

export function isRebookingAfterCancellation(job: KoreaRebookingJobState | null) {
  return job?.user_preferences_json?.rebookingAfterCancellation === true;
}

export function planKoreaRebooking(
  applicationId: string,
  job: KoreaRebookingJobState | null,
  activeConfirmationId: string | null,
): KoreaRebookingPlan {
  if (activeConfirmationId) {
    return { kind: "reject", reason: "active_appointment" };
  }

  if (job && isRebookingAfterCancellation(job) && job.status !== "appointment_cancelled") {
    return { kind: "reuse", jobId: job.id };
  }

  if (!job || job.status !== "appointment_cancelled") {
    return { kind: "reject", reason: "appointment_not_cancelled" };
  }

  return {
    kind: "create",
    previousJobId: job.id,
    idempotencyKey: `korea-kvac:rebook:${applicationId}:${job.id}`,
  };
}
