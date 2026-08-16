import { describe, expect, it } from "vitest";

import { dedupeReusableProfileAnswers } from "@/lib/korea-c39/shenyang-applicant-details.server";
import {
  buildShenyangCanonicalRows,
  filterShenyangSupplementsToMissingFields,
  normalizeMainlandPhone,
  resolveShenyangApplicantDetails,
  selectKvacCenterCode,
  shouldRequireShenyangApplicantDetails,
  shouldUsePersistedKvacCenter,
  toShenyangApplicantReviewSnapshot,
  validateShenyangSupplement,
} from "@/lib/korea-c39/shenyang-applicant-details";
import type { UniversalProfileAnswerRecord } from "@/lib/universal-profile-fields";

describe("Shenyang appointment applicant details", () => {
  it("enables the expanded applicant-details gate only for Shenyang", () => {
    expect(shouldRequireShenyangApplicantDetails("shenyang")).toBe(true);
    expect(shouldRequireShenyangApplicantDetails("beijing")).toBe(false);
    expect(shouldRequireShenyangApplicantDetails("chengdu")).toBe(false);
    expect(shouldRequireShenyangApplicantDetails(null)).toBe(false);
  });

  it("keeps a persisted valid center when no explicit center preview is supplied", () => {
    const centers = ["beijing", "shenyang", "chengdu"] as const;
    expect(shouldUsePersistedKvacCenter(undefined, centers)).toBe(true);
    expect(shouldUsePersistedKvacCenter("beijing", centers)).toBe(false);
    expect(shouldUsePersistedKvacCenter("malformed-center", centers)).toBe(true);
    expect(selectKvacCenterCode(undefined, "shenyang", centers)).toBe("shenyang");
    expect(selectKvacCenterCode("beijing", "shenyang", centers)).toBe("beijing");
    expect(selectKvacCenterCode("malformed-center", "shenyang", centers)).toBe("shenyang");
    expect(selectKvacCenterCode("malformed-center", undefined, centers)).toBeUndefined();
    expect(selectKvacCenterCode(undefined, "not-a-center", centers)).toBeUndefined();
  });

  it("maps a resolved review into a display-safe snapshot without raw identity values", () => {
    const resolved = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "ZHANG", origin: "korea_form" },
        given_names_en: { value: "SAN", origin: "korea_form" },
        date_of_birth: { value: "1995-04-03", origin: "korea_form" },
        passport_number: { value: "E12345678", origin: "korea_form" },
        passport_expiry_date: { value: "2031-05-06", origin: "korea_form" },
        mobile_phone: { value: "13800138000", origin: "korea_form" },
      },
      profileAnswers: {},
    });

    const snapshot = toShenyangApplicantReviewSnapshot(resolved);
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.complete).toBe(true);
    expect(snapshot.fields.passportNumber).toEqual({
      displayValue: "**** 5678",
      source: "korea_form",
      required: true,
    });
    expect(snapshot.fields.mobilePhone).toEqual({
      displayValue: "138****8000",
      source: "korea_form",
      required: true,
    });
    expect(serialized).not.toContain("rawValue");
    expect(serialized).not.toContain("E12345678");
    expect(serialized).not.toContain("13800138000");
  });

  it("prefers Korea answers over universal profile values", () => {
    const result = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "ZHANG", origin: "korea_form" },
        given_names_en: { value: "SAN", origin: "korea_form" },
      },
      profileAnswers: { surname: "WANG", given_names: "WU" },
    });

    expect(result.fields.surname).toMatchObject({ displayValue: "ZHANG", source: "korea_form" });
    expect(result.fields.givenNames).toMatchObject({ displayValue: "SAN", source: "korea_form" });
  });

  it("preserves application answer provenance when details are materialized and reloaded", () => {
    const result = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "ZHANG", origin: "universal_profile" },
        given_names_en: { value: "SAN", origin: "appointment_supplement" },
        date_of_birth: { value: "1995-04-03", origin: "user_form" },
        passport_number: { value: "E12345678", origin: "passport_ocr" },
        passport_expiry_date: { value: "2031-05-06", origin: null },
        mobile_phone: { value: "13800138000", origin: "korea_form" },
      },
      profileAnswers: {},
    });

    expect(result.fields.surname?.source).toBe("universal_profile");
    expect(result.fields.givenNames?.source).toBe("appointment_supplement");
    expect(result.fields.dateOfBirth?.source).toBe("korea_form");
    expect(result.fields.passportNumber?.source).toBe("korea_form");
    expect(result.fields.passportExpiryDate?.source).toBe("korea_form");
    expect(result.fields.mobilePhone?.source).toBe("korea_form");
  });

  it("keeps the newest reusable answer when canonical keys repeat", () => {
    const newest: UniversalProfileAnswerRecord = {
      canonicalKey: "surname",
      value: "NEWEST",
      updatedAt: "2026-08-14T10:00:00.000Z",
    };
    const older: UniversalProfileAnswerRecord = {
      canonicalKey: "surname",
      value: "OLDER",
      updatedAt: "2026-08-13T10:00:00.000Z",
    };
    const other: UniversalProfileAnswerRecord = {
      canonicalKey: "given_names",
      value: "SAN",
      updatedAt: "2026-08-14T09:00:00.000Z",
    };

    expect(dedupeReusableProfileAnswers([newest, older, other])).toEqual([newest, other]);
  });

  it("falls back to universal profile and reports only unresolved required fields", () => {
    const result = resolveShenyangApplicantDetails({
      applicationAnswers: {},
      profileAnswers: {
        surname: "LI",
        given_names: "MING",
        date_of_birth: "1995-04-03",
        passport_number: "E12345678",
        passport_expiry_date: "2031-05-06",
        phone: "+86 13800138000",
      },
    });

    expect(result.complete).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.fields.passportNumber?.displayValue).toBe("**** 5678");
    expect(result.fields.mobilePhone?.displayValue).toBe("138****8000");
  });

  it("redacts short and malformed legacy identity values instead of returning raw PII", () => {
    const shortValues = resolveShenyangApplicantDetails({
      applicationAnswers: {},
      profileAnswers: {
        passport_number: "123",
        phone: "1234",
      },
    });
    expect(shortValues.fields.passportNumber).toBeUndefined();
    expect(shortValues.fields.mobilePhone).toBeUndefined();

    const malformedValues = resolveShenyangApplicantDetails({
      applicationAnswers: {},
      profileAnswers: {
        passport_number: "E12?5678",
        phone: "abc13800138000",
      },
    });
    expect(malformedValues.fields.passportNumber).toBeUndefined();
    expect(malformedValues.fields.mobilePhone).toBeUndefined();
  });

  it("does not treat invalid persistent application or profile values as complete", () => {
    const applicationInvalid = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "张三", origin: "korea_form" },
      },
      profileAnswers: { surname: "LI" },
    });
    expect(applicationInvalid.fields.surname).toBeUndefined();
    expect(applicationInvalid.missingFields).toContain("surname");

    const profileInvalid = resolveShenyangApplicantDetails({
      applicationAnswers: {},
      profileAnswers: { passport_number: "?" },
    });
    expect(profileInvalid.fields.passportNumber).toBeUndefined();
    expect(profileInvalid.missingFields).toContain("passportNumber");
  });

  it("allows a valid supplement to repair an invalid persistent candidate", () => {
    const result = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "张三", origin: "korea_form" },
      },
      profileAnswers: { surname: "LI" },
      supplements: { surname: "ZHANG" },
    });

    expect(result.fields.surname).toMatchObject({
      rawValue: "ZHANG",
      source: "appointment_supplement",
    });
    expect(result.missingFields).not.toContain("surname");
  });

  it("rejects alphabetic and CJK characters while allowing formatted mainland phones", () => {
    expect(normalizeMainlandPhone("abc13800138000")).toBeNull();
    expect(normalizeMainlandPhone("姓名13800138000")).toBeNull();
    expect(normalizeMainlandPhone("+86 138-0013-8000")).toBe("13800138000");
  });

  it("rejects invalid supplements with field-keyed errors", () => {
    expect(validateShenyangSupplement({
      surname: "张",
      givenNames: "SAN",
      dateOfBirth: "not-a-date",
      passportNumber: "?",
      passportExpiryDate: "2020-01-01",
      mobilePhone: "123",
    }, new Date("2026-08-14T00:00:00Z"))).toEqual(expect.objectContaining({
      surname: "latin_name_required",
      dateOfBirth: "invalid_date",
      passportNumber: "invalid_passport",
      passportExpiryDate: "passport_expired",
      mobilePhone: "invalid_mainland_phone",
    }));
  });

  it("uses the Shanghai calendar date for strict passport expiry checks", () => {
    const errors = validateShenyangSupplement(
      { passportExpiryDate: "2026-08-14" },
      new Date("2026-08-13T16:00:00.000Z"),
    );

    expect(errors.passportExpiryDate).toBe("passport_expired");
  });

  it("rejects a date of birth in the future using the Shanghai calendar date", () => {
    const errors = validateShenyangSupplement(
      { dateOfBirth: "2026-08-15" },
      new Date("2026-08-14T00:00:00.000Z"),
    );

    expect(errors.dateOfBirth).toBe("date_in_future");
  });

  it("filters supplements to fields unresolved by the base snapshot", () => {
    const complete = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "ZHANG", origin: "korea_form" },
        given_names_en: { value: "SAN", origin: "korea_form" },
        date_of_birth: { value: "1995-04-03", origin: "korea_form" },
        passport_number: { value: "E12345678", origin: "korea_form" },
        passport_expiry_date: { value: "2031-05-06", origin: "korea_form" },
        mobile_phone: { value: "13800138000", origin: "korea_form" },
      },
      profileAnswers: {},
    });
    expect(filterShenyangSupplementsToMissingFields(complete, {
      surname: "?",
      mobilePhone: "13800138001",
    })).toEqual({});

    const incomplete = resolveShenyangApplicantDetails({
      applicationAnswers: {
        surname_en: { value: "ZHANG", origin: "korea_form" },
      },
      profileAnswers: {},
    });
    expect(filterShenyangSupplementsToMissingFields(incomplete, {
      surname: "?",
      mobilePhone: "13800138001",
    })).toEqual({ mobilePhone: "13800138001" });
  });

  it("builds canonical current-application rows without universal-profile writes", () => {
    const rows = buildShenyangCanonicalRows("application-1", {
      surname: { rawValue: "ZHANG", displayValue: "ZHANG", source: "universal_profile" },
      givenNames: { rawValue: "SAN", displayValue: "SAN", source: "appointment_supplement" },
      dateOfBirth: { rawValue: "1995-04-03", displayValue: "1995-04-03", source: "korea_form" },
      passportNumber: { rawValue: "E12345678", displayValue: "**** 5678", source: "korea_form" },
      passportExpiryDate: { rawValue: "2031-05-06", displayValue: "2031-05-06", source: "universal_profile" },
      mobilePhone: { rawValue: "13800138000", displayValue: "138****8000", source: "appointment_supplement" },
    }, "2026-08-14T00:00:00.000Z");

    expect(rows).toEqual([
      {
        application_id: "application-1",
        field_name: "surname",
        value_text: "ZHANG",
        updated_at: "2026-08-14T00:00:00.000Z",
        source: "universal_profile",
        source_metadata: { origin: "universal_profile" },
      },
      {
        application_id: "application-1",
        field_name: "given_names",
        value_text: "SAN",
        updated_at: "2026-08-14T00:00:00.000Z",
        source: "appointment_supplement",
        source_metadata: { origin: "appointment_supplement" },
      },
      {
        application_id: "application-1",
        field_name: "date_of_birth",
        value_text: "1995-04-03",
        updated_at: "2026-08-14T00:00:00.000Z",
        source: "korea_form",
        source_metadata: { origin: "korea_form" },
      },
      {
        application_id: "application-1",
        field_name: "passport_number",
        value_text: "E12345678",
        updated_at: "2026-08-14T00:00:00.000Z",
        source: "korea_form",
        source_metadata: { origin: "korea_form" },
      },
      {
        application_id: "application-1",
        field_name: "passport_expiry_date",
        value_text: "2031-05-06",
        updated_at: "2026-08-14T00:00:00.000Z",
        source: "universal_profile",
        source_metadata: { origin: "universal_profile" },
      },
      {
        application_id: "application-1",
        field_name: "mobile_phone",
        value_text: "13800138000",
        updated_at: "2026-08-14T00:00:00.000Z",
        source: "appointment_supplement",
        source_metadata: { origin: "appointment_supplement" },
      },
    ]);
  });
});
