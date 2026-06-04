/**
 * Result-card country coverage (POR-008).
 *
 * The `SubmissionResult.country` codes that SubmissionStatusStep renders a
 * dedicated card for — bespoke (US/FR/UK/VN/AU/JP) + generic e-Visa
 * (ID/EG/SA/MY/TH/AE/CA/TR/IT/IN). The guest card / magic-link flow resumes
 * into the same SubmissionStatusStep after login, so every launch country
 * gets its real card (never the empty Waiting/default fallback).
 */
export const RESULT_CARD_COUNTRIES = [
  "US", "FR", "UK", "VN", "AU", "JP",
  "ID", "EG", "SA", "MY", "TH", "AE", "CA", "TR", "IT", "IN",
] as const;

export type ResultCardCountry = (typeof RESULT_CARD_COUNTRIES)[number];
