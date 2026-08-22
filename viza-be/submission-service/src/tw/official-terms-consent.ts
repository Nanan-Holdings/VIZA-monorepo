export const TW_OFFICIAL_TERMS_CONSENT_VERSION = "tw_official_terms_v1" as const;

export interface TwOfficialTermsConsentAudit {
  version: typeof TW_OFFICIAL_TERMS_CONSENT_VERSION;
  entryPromptAccepted: true;
  termsModalAccepted: true;
  recordedAt: string;
  source: "viza_final_confirmation";
}

export function parseTwOfficialTermsConsentAudit(
  value: unknown,
): TwOfficialTermsConsentAudit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const consent = value as Record<string, unknown>;
  if (
    consent.version !== TW_OFFICIAL_TERMS_CONSENT_VERSION ||
    consent.entryPromptAccepted !== true ||
    consent.termsModalAccepted !== true ||
    consent.source !== "viza_final_confirmation" ||
    typeof consent.recordedAt !== "string" ||
    !Number.isFinite(Date.parse(consent.recordedAt))
  ) {
    return null;
  }
  return consent as unknown as TwOfficialTermsConsentAudit;
}

export function assertTwOfficialTermsConsentAudit(
  value: unknown,
): asserts value is TwOfficialTermsConsentAudit {
  if (!parseTwOfficialTermsConsentAudit(value)) {
    throw new Error(
      "taiwan: both official entry-prompt and terms-modal authorizations are required before formal submission",
    );
  }
}
