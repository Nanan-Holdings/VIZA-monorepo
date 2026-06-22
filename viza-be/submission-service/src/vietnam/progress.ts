export const VN_PROGRESS_STAGES = [
  "browser_launching",
  "browser_ready",
  "trace_started",
  "opening_landing",
  "official_checkpoint",
  "acknowledging_note",
  "captcha_solving",
  "captcha_submitted",
  "application_form_visible",
  "filling_fields",
  "advancing_to_review",
  "payment_required",
  "registration_code_visible",
  "failed",
] as const;

export type VietnamProgressStage =
  | (typeof VN_PROGRESS_STAGES)[number]
  | `official_checkpoint:${string}`
  | `field:${string}`
  | `portal_retry:${number}`;

export function normalizeVietnamProgressStage(stage: string): string {
  return stage.replace(/[^a-zA-Z0-9:_-]+/g, "_").slice(0, 80) || "processing";
}

export function shouldPersistVietnamProgressStage(
  previousStage: string | null | undefined,
  nextStage: string,
): boolean {
  return normalizeVietnamProgressStage(previousStage ?? "") !== normalizeVietnamProgressStage(nextStage);
}
