export const TW_SUBMISSION_AUTHORIZATION_VERSION =
  "tw_submission_authorization_v1" as const;

export interface TwSubmissionAuthorizationAudit {
  version: typeof TW_SUBMISSION_AUTHORIZATION_VERSION;
  applicantTruthDeclarationAccepted: true;
  electronicSubmissionAuthorized: true;
  officialFeeResponsibilityAccepted: true;
  recordedAt: string;
  source: "viza_final_confirmation";
}

export function parseTwSubmissionAuthorizationAudit(
  value: unknown,
): TwSubmissionAuthorizationAudit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const authorization = value as Record<string, unknown>;
  if (
    authorization.version !== TW_SUBMISSION_AUTHORIZATION_VERSION ||
    authorization.applicantTruthDeclarationAccepted !== true ||
    authorization.electronicSubmissionAuthorized !== true ||
    authorization.officialFeeResponsibilityAccepted !== true ||
    authorization.source !== "viza_final_confirmation" ||
    typeof authorization.recordedAt !== "string" ||
    !Number.isFinite(Date.parse(authorization.recordedAt))
  ) {
    return null;
  }
  return authorization as unknown as TwSubmissionAuthorizationAudit;
}

export function assertTwSubmissionAuthorizationAudit(
  value: unknown,
): asserts value is TwSubmissionAuthorizationAudit {
  if (!parseTwSubmissionAuthorizationAudit(value)) {
    throw new Error(
      "taiwan: truth declaration, electronic submission authorization, and official fee responsibility acceptance are required before formal submission",
    );
  }
}
