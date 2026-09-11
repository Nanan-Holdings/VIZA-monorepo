import type { RecoveryCredentials } from "./resume-application";

type RecoveryField =
  | "official_application_id"
  | "surname"
  | "year_of_birth"
  | "security_answer";

export type StoredCeacRecoveryResolution =
  | { status: "ready"; credentials: RecoveryCredentials }
  | { status: "unavailable"; missing: RecoveryField[]; applicationId?: string }
  | {
      status: "invalid";
      reason:
        | "official_application_id_conflict"
        | "official_application_id_invalid"
        | "security_answer_decryption_failed";
    };

export interface StoredCeacRecoveryInput {
  application: {
    ds160_application_id?: unknown;
    submission_result?: unknown;
  };
  answers: Record<string, string | undefined>;
  profile: Record<string, unknown>;
  /** Decrypted application-scoped value loaded from applicant_secret. */
  securityAnswer?: unknown;
  decryptSecurityAnswer?: (ciphertext: string) => string;
}

const CEAC_APPLICATION_ID_RE = /^AA[A-Z0-9]{8,10}$/;
const VIZA_APPLICATION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ds160RecoverySecretKey(applicationId: string): string {
  const normalized = applicationId.trim().toLowerCase();
  if (!VIZA_APPLICATION_ID_RE.test(normalized)) {
    throw new Error("DS-160 recovery secret requires a valid VIZA application ID.");
  }
  return `us.ds160.${normalized}.security_answer`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resultRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return record.country === "US" ? record : {};
}

function normalizeOfficialApplicationId(value: unknown): string {
  return text(value).toUpperCase();
}

function surnamePrefix(value: unknown): string {
  return text(value).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
}

function year(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value)) {
    const numericYear = String(value);
    return /^\d{4}$/.test(numericYear) ? numericYear : "";
  }
  const match = text(value).match(/^(\d{4})(?:-|$)/);
  return match?.[1] ?? "";
}

/**
 * Resolve only applicant-provided or previously encrypted CEAC recovery
 * values. This deliberately has no mother-surname or generated fallback.
 */
export function resolveStoredCeacRecoveryCredentials(
  input: StoredCeacRecoveryInput,
): StoredCeacRecoveryResolution {
  const result = resultRecord(input.application.submission_result);
  const applicationIdFromColumn = normalizeOfficialApplicationId(
    input.application.ds160_application_id,
  );
  const applicationIdFromResult = normalizeOfficialApplicationId(result.applicationId);

  if (
    applicationIdFromColumn &&
    applicationIdFromResult &&
    applicationIdFromColumn !== applicationIdFromResult
  ) {
    return { status: "invalid", reason: "official_application_id_conflict" };
  }

  const applicationId = applicationIdFromColumn || applicationIdFromResult;
  if (applicationId && !CEAC_APPLICATION_ID_RE.test(applicationId)) {
    return { status: "invalid", reason: "official_application_id_invalid" };
  }

  const fullNameParts = text(input.profile.full_name).split(/\s+/).filter(Boolean);
  const surnameFirstFive =
    surnamePrefix(result.surnameFirst5) ||
    surnamePrefix(input.answers.surname) ||
    surnamePrefix(input.profile.surname) ||
    surnamePrefix(fullNameParts.at(-1));
  const yearOfBirth =
    year(result.yearOfBirth) ||
    year(input.answers.date_of_birth_year) ||
    year(input.answers.date_of_birth) ||
    year(input.profile.date_of_birth);

  let securityAnswer = text(input.securityAnswer) || text(input.answers.ds160_security_answer);
  const cipher = text(result.securityAnswerCipher);
  if (!securityAnswer && cipher) {
    if (!input.decryptSecurityAnswer) {
      return { status: "invalid", reason: "security_answer_decryption_failed" };
    }
    try {
      securityAnswer = text(input.decryptSecurityAnswer(cipher));
    } catch {
      return { status: "invalid", reason: "security_answer_decryption_failed" };
    }
  }
  if (!securityAnswer) securityAnswer = text(result.securityAnswer);

  const missing: RecoveryField[] = [];
  if (!applicationId) missing.push("official_application_id");
  if (!surnameFirstFive) missing.push("surname");
  if (!yearOfBirth) missing.push("year_of_birth");
  if (!securityAnswer) missing.push("security_answer");
  if (missing.length > 0) {
    return {
      status: "unavailable",
      missing,
      ...(applicationId ? { applicationId } : {}),
    };
  }

  return {
    status: "ready",
    credentials: {
      applicationId,
      surnameFirstFive,
      yearOfBirth,
      securityAnswer,
    },
  };
}
