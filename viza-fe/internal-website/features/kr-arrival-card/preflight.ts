export const KOREA_E_ARRIVAL_PREFLIGHT_ANSWER_KEYS = [
  "kr_eac_eligibility",
  "kr_eac_adult_representative_confirmed",
  "kr_eac_preflight_version",
  "kr_eac_preflight_reviewed_at",
] as const;

export type KoreaEArrivalPreflightRecord = {
  eligibility: "needs_declaration";
  adultRepresentativeConfirmed: boolean;
  version: 1;
  reviewedAt: string;
};

export type KoreaEArrivalPreflightValidation =
  | { ok: true; record: KoreaEArrivalPreflightRecord }
  | { ok: false; code: "missing" | "not_needing_declaration" | "invalid"; message: string };

/**
 * A Korea e-Arrival Card draft may only be created after the eligibility gate
 * has written a trusted marker. An explicit application id is the existing
 * application/status-view path and is therefore allowed to be read or saved;
 * it must never be used to manufacture a new application.
 */
export function canCreateKoreaArrivalCardDraft(input: {
  isKoreaArrivalCard: boolean;
  preflightTrusted: boolean;
  explicitApplicationId: boolean;
}): boolean {
  return !input.isKoreaArrivalCard || input.preflightTrusted || input.explicitApplicationId;
}

export function validateKoreaEArrivalPreflight(
  answers: Record<string, string | null | undefined>,
): KoreaEArrivalPreflightValidation {
  const eligibility = answers.kr_eac_eligibility?.trim();
  if (!eligibility) {
    return {
      ok: false,
      code: "missing",
      message: "Korea e-Arrival Card eligibility preflight is required before live submission.",
    };
  }
  if (eligibility !== "needs_declaration") {
    return {
      ok: false,
      code: "not_needing_declaration",
      message: "Korea e-Arrival Card live submission requires a needs-declaration preflight result.",
    };
  }

  const adultRepresentativeConfirmed = answers.kr_eac_adult_representative_confirmed?.trim();
  const version = answers.kr_eac_preflight_version?.trim();
  const reviewedAt = answers.kr_eac_preflight_reviewed_at?.trim();
  if (
    (adultRepresentativeConfirmed !== "true" && adultRepresentativeConfirmed !== "false") ||
    version !== "1" ||
    !reviewedAt ||
    !Number.isFinite(Date.parse(reviewedAt))
  ) {
    return {
      ok: false,
      code: "invalid",
      message: "Korea e-Arrival Card eligibility preflight metadata is incomplete or invalid.",
    };
  }

  return {
    ok: true,
    record: {
      eligibility: "needs_declaration",
      adultRepresentativeConfirmed: adultRepresentativeConfirmed === "true",
      version: 1,
      reviewedAt,
    },
  };
}
