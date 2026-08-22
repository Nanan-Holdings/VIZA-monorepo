import { describe, expect, it } from "vitest";
import {
  isDedicatedQaApplicantEmail,
  isLocalSupabaseUrl,
  isQaDryRunPurpose,
  isSyntheticQaValue,
  omitSyntheticQaValues,
  QA_DRY_RUN_PURPOSE,
} from "./qa-safety";

describe("application QA data safety", () => {
  it.each([
    "VIZA QA PLACEHOLDER",
    "1 VIZA QA Road",
    "VIZA_QA_LOCAL_ONLY_NOT_A_REAL_PASSWORD",
    "VIZA-QA-PASSPORT",
    "viza-qa@example.invalid",
    "QA PLACEHOLDER",
    "qa_edward_viza",
  ])("recognizes synthetic QA values: %s", (value) => {
    expect(isSyntheticQaValue(value)).toBe(true);
  });

  it("does not reject ordinary applicant values or the VIZA company name", () => {
    expect(isSyntheticQaValue("VIZA PTE LTD")).toBe(false);
    expect(isSyntheticQaValue("1 Visa Street, Singapore")).toBe(false);
  });

  it("removes synthetic values from reusable prefill patches", () => {
    expect(
      omitSyntheticQaValues({
        full_name: "XIAOMING LI",
        address: "1 VIZA QA Road",
      })
    ).toEqual({ full_name: "XIAOMING LI" });
  });

  it("identifies only the reserved dry-run purpose", () => {
    expect(isQaDryRunPurpose(QA_DRY_RUN_PURPOSE)).toBe(true);
    expect(isQaDryRunPurpose("tourism")).toBe(false);
  });

  it("allows QA draft generation only against a local Supabase host", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://project.supabase.co")).toBe(false);
  });

  it("requires a dedicated QA applicant email", () => {
    expect(isDedicatedQaApplicantEmail("schema-qa@viza.test")).toBe(true);
    expect(isDedicatedQaApplicantEmail("customer@example.com")).toBe(false);
  });
});
