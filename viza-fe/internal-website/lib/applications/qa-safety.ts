export const QA_DRY_RUN_PURPOSE = "VIZA_PLACEHOLDER_DRY_RUN";

const SYNTHETIC_QA_VALUE_PATTERNS = [
  /\bviza[\s_-]*qa(?:[\s_-]|$)/i,
  /\bqa[\s_-]*placeholder\b/i,
  /^qa[\s_-]+edward[\s_-]+viza$/i,
  /@example\.invalid\b/i,
];

export function isSyntheticQaValue(value: unknown): boolean {
  return (
    typeof value === "string" &&
    SYNTHETIC_QA_VALUE_PATTERNS.some((pattern) => pattern.test(value.trim()))
  );
}

export function omitSyntheticQaValues(
  answers: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(answers).filter(([, value]) => !isSyntheticQaValue(value))
  );
}

export function isQaDryRunPurpose(value: unknown): boolean {
  return typeof value === "string" && value.trim() === QA_DRY_RUN_PURPOSE;
}

export function isLocalSupabaseUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

export function isDedicatedQaApplicantEmail(value: string | null | undefined): boolean {
  return value?.trim().toLowerCase().endsWith("@viza.test") ?? false;
}
