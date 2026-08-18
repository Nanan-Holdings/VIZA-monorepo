import { describe, expect, it } from "vitest";
import {
  canCreateKoreaArrivalCardDraft,
  validateKoreaEArrivalPreflight,
} from "./preflight";

describe("Korea e-Arrival Card server-auditable preflight", () => {
  it("blocks direct new-draft creation until the gate is trusted", () => {
    expect(canCreateKoreaArrivalCardDraft({
      isKoreaArrivalCard: true,
      preflightTrusted: false,
      explicitApplicationId: false,
    })).toBe(false);
    expect(canCreateKoreaArrivalCardDraft({
      isKoreaArrivalCard: true,
      preflightTrusted: true,
      explicitApplicationId: false,
    })).toBe(true);
    expect(canCreateKoreaArrivalCardDraft({
      isKoreaArrivalCard: true,
      preflightTrusted: false,
      explicitApplicationId: true,
    })).toBe(true);
    expect(canCreateKoreaArrivalCardDraft({
      isKoreaArrivalCard: false,
      preflightTrusted: false,
      explicitApplicationId: false,
    })).toBe(true);
  });

  it("rejects missing or exempt answers", () => {
    expect(validateKoreaEArrivalPreflight({}).ok).toBe(false);
    expect(validateKoreaEArrivalPreflight({
      kr_eac_eligibility: "exempt",
      kr_eac_adult_representative_confirmed: "false",
      kr_eac_preflight_version: "1",
      kr_eac_preflight_reviewed_at: "2026-08-18T00:00:00.000Z",
    })).toMatchObject({ ok: false, code: "not_needing_declaration" });
  });

  it("accepts versioned needs-declaration metadata", () => {
    expect(validateKoreaEArrivalPreflight({
      kr_eac_eligibility: "needs_declaration",
      kr_eac_adult_representative_confirmed: "true",
      kr_eac_preflight_version: "1",
      kr_eac_preflight_reviewed_at: "2026-08-18T00:00:00.000Z",
    })).toEqual({
      ok: true,
      record: {
        eligibility: "needs_declaration",
        adultRepresentativeConfirmed: true,
        version: 1,
        reviewedAt: "2026-08-18T00:00:00.000Z",
      },
    });
  });
});
