import { describe, expect, it, vi } from "vitest";
import enMessages from "@/messages/en.json";
import zhMessages from "@/messages/zh.json";
import { humanizeDocumentType, resolveHomeDocumentLabel } from "../home-activity";

const COMMON_DOCUMENT_TYPES = [
  "passport_bio_page",
  "passport_photo",
  "portrait_photo",
  "visa_photo",
  "travel_itinerary",
  "bank_statement",
  "employment_letter",
  "student_certificate",
  "accommodation_proof",
  "invitation_letter",
  "insurance",
  "flight_booking",
  "hotel_booking",
  "financial_proof",
  "other",
];

function getPath(source: unknown, path: string) {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function createHomeTranslator(messages: unknown) {
  const t = ((key: string, values?: Record<string, string | number>) => {
    const value = getPath(messages, key);
    if (typeof value !== "string") throw new Error(`Missing ${key}`);
    return Object.entries(values ?? {}).reduce(
      (nextValue, [name, replacement]) => nextValue.replace(`{${name}}`, String(replacement)),
      value,
    );
  }) as ((key: string, values?: Record<string, string | number>) => string) & {
    has: (key: string) => boolean;
  };
  t.has = (key: string) => typeof getPath(messages, key) === "string";
  return t;
}

describe("home activity document labels", () => {
  it("includes common document labels in zh and en messages", () => {
    for (const documentType of COMMON_DOCUMENT_TYPES) {
      expect(getPath(zhMessages.home, `docLabels.${documentType}`)).toEqual(expect.any(String));
      expect(getPath(enMessages.home, `docLabels.${documentType}`)).toEqual(expect.any(String));
    }
  });

  it("resolves passport_bio_page in zh without throwing", () => {
    const t = createHomeTranslator(zhMessages.home);

    expect(resolveHomeDocumentLabel(t, "passport_bio_page")).toBe("护照资料页");
  });

  it("falls back to a humanized document type instead of throwing", () => {
    const t = createHomeTranslator(zhMessages.home);
    const warn = vi.fn();

    expect(resolveHomeDocumentLabel(t, "custom_supporting_doc", warn)).toBe("Custom Supporting Doc");
    expect(warn).toHaveBeenCalledWith("[home] Missing document label for docLabels.custom_supporting_doc");
  });

  it("can build uploaded-document activity text for known and unknown document types", () => {
    const t = createHomeTranslator(zhMessages.home);
    const knownLabel = resolveHomeDocumentLabel(t, "passport_bio_page");
    const unknownLabel = resolveHomeDocumentLabel(t, "custom_supporting_doc", vi.fn());

    expect(t("activity.documentUploaded", { docType: knownLabel })).toBe("护照资料页 已上传");
    expect(t("activity.documentUploaded", { docType: unknownLabel })).toBe("Custom Supporting Doc 已上传");
  });

  it("humanizes empty document types safely", () => {
    expect(humanizeDocumentType("")).toBe("Document");
    expect(humanizeDocumentType(null)).toBe("Document");
  });
});
