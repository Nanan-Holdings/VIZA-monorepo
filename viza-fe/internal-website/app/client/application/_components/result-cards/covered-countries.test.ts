import { describe, it, expect } from "vitest";
import { RESULT_CARD_COUNTRIES } from "./covered-countries";

/**
 * POR-008: guest checkout + magic-link resumes into SubmissionStatusStep, which
 * must render a real card for every launch country (no generic/empty fallback).
 * This asserts the 16 launch countries (by SubmissionResult.country code) are
 * all covered. The end-to-end guest path (checkout → webhook →
 * provisionAccountAndMagicLink → login → status) reuses this same mapping.
 */
const LAUNCH_RESULT_CODES = [
  "ID", "EG", "AU", "SA", "UK", "VN", "MY", "JP",
  "US", "CA", "TR", "TH", "AE", "FR", "IT", "IN",
];

describe("result-card coverage", () => {
  it("covers all 16 launch countries", () => {
    for (const code of LAUNCH_RESULT_CODES) {
      expect(RESULT_CARD_COUNTRIES).toContain(code);
    }
  });

  it("has no duplicate country codes", () => {
    expect(new Set(RESULT_CARD_COUNTRIES).size).toBe(RESULT_CARD_COUNTRIES.length);
  });
});
