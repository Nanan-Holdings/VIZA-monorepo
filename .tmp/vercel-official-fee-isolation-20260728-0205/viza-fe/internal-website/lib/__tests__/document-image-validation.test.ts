import { describe, expect, it } from "vitest";

import {
  buildOfficialImageValidationMessage,
  translateOfficialImagePortalError,
  validateOfficialDocumentImage,
  type DocumentImageSignals,
} from "@/lib/document-image-validation";

describe("official document image validation", () => {
  it("flags a passport data page uploaded to the portrait photo slot", () => {
    const signals: DocumentImageSignals = {
      mimeType: "image/jpeg",
      sizeBytes: 180_000,
      width: 1400,
      height: 900,
      ocrText: "PASSPORT PEOPLE'S REPUBLIC OF CHINA P<CHNRAN<<JUNJIE<<<<<<<<<<<<",
      readablePassport: true,
      passportFieldCount: 3,
    };

    const result = validateOfficialDocumentImage({
      expected: "portrait_photo",
      signals,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "portrait_photo",
          code: "passport_uploaded_as_portrait",
        }),
      ]),
    );
    expect(buildOfficialImageValidationMessage(result.issues, "zh")).toContain("证件照环节");
    expect(buildOfficialImageValidationMessage(result.issues, "zh")).toContain("护照资料页");
  });

  it("flags a portrait uploaded to the passport data page slot", () => {
    const signals: DocumentImageSignals = {
      mimeType: "image/png",
      sizeBytes: 220_000,
      width: 700,
      height: 900,
      faceCount: 1,
      readablePassport: false,
      passportFieldCount: 0,
    };

    const result = validateOfficialDocumentImage({
      expected: "passport_data_page",
      signals,
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "passport_data_page",
          code: "portrait_uploaded_as_passport",
        }),
      ]),
    );
  });

  it("keeps file format and size problems as separate user-fixable issues", () => {
    const result = validateOfficialDocumentImage({
      expected: "portrait_photo",
      signals: {
        mimeType: "application/pdf",
        sizeBytes: 3 * 1024 * 1024,
        width: 800,
        height: 800,
      },
    });

    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["file_too_large", "unsupported_format"]),
    );
  });

  it("does not block uncertain images without strong mismatch evidence", () => {
    const result = validateOfficialDocumentImage({
      expected: "portrait_photo",
      signals: {
        mimeType: "image/jpeg",
        sizeBytes: 200_000,
        width: 800,
        height: 900,
      },
    });

    expect(result.ok).toBe(true);
  });

  it("translates official portal portrait face errors into user-centered Chinese guidance", () => {
    const guidance = translateOfficialImagePortalError(
      "Too many faces detected in the portrait photo. Please upload another photo",
      "zh",
    );

    expect(guidance).toContain("证件照环节");
    expect(guidance).toContain("护照资料页图片");
    expect(guidance).toContain("重新提交");
  });
});
