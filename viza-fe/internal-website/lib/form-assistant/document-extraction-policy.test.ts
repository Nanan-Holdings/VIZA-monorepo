import { describe, expect, it } from "vitest";
import {
  allowedFieldCategoriesForDocument,
  canDocumentProposeField,
  getDocumentExtractionPolicy,
  getDocumentRequirements,
} from "./document-extraction-policy";

describe("document extraction policy", () => {
  it("limits passport candidates to identity and passport fields", () => {
    expect(allowedFieldCategoriesForDocument("passport_scan")).toEqual(["identity", "passport"]);
    expect(canDocumentProposeField("passport_scan", "passport_number")).toBe(true);
    expect(canDocumentProposeField("passport_scan", "hotel_name")).toBe(false);
    expect(canDocumentProposeField("passport_scan", "unknown_field")).toBe(false);
  });

  it("keeps travel and financial documents in their own categories", () => {
    expect(getDocumentExtractionPolicy("flight_itinerary").allowedFieldCategories).toEqual(["travel"]);
    expect(canDocumentProposeField("flight_itinerary", "arrival_date")).toBe(true);
    expect(canDocumentProposeField("flight_itinerary", "account_balance")).toBe(false);
    expect(canDocumentProposeField("bank_statement", "account_balance")).toBe(true);
    expect(canDocumentProposeField("bank_statement", "flight_number")).toBe(false);
  });

  it("denies unknown document types by default", () => {
    expect(getDocumentExtractionPolicy("random_upload")).toEqual({
      documentTypes: [],
      allowedFieldCategories: [],
      allowedFieldNames: [],
    });
    expect(canDocumentProposeField("random_upload", "passport_number")).toBe(false);
  });

  it("does not request documents for Singapore Arrival Card", () => {
    expect(getDocumentRequirements("singapore", "SG_ARRIVAL_CARD")).toEqual([]);
    expect(getDocumentRequirements({ country: "SG", visaType: "sgac" })).toEqual([]);
    expect(getDocumentRequirements("south_korea", "KR_E_ARRIVAL_CARD")).toEqual([]);
  });

  it("supports an explicit multi-document product fixture", () => {
    expect(getDocumentRequirements("test", "TEST_FORM_ASSISTANT_DOCUMENTS")).toEqual([
      { requirementKey: "passport", documentType: "passport", required: true },
      { requirementKey: "itinerary", documentType: "travel_itinerary", required: true },
      { requirementKey: "hotel", documentType: "hotel_booking", required: false },
    ]);
  });
});
