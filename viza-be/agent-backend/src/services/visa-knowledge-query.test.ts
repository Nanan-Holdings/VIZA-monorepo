import { describe, expect, it } from "vitest";
import {
  documentTypesForIntent,
  normalizeKnowledgeFilters,
} from "./visa-knowledge-query.js";

describe("visa knowledge query normalization", () => {
  it("preserves the current country aliases", () => {
    expect(normalizeKnowledgeFilters({ country: "USA" })).toEqual({
      country: "us",
      visaType: undefined,
    });
    expect(normalizeKnowledgeFilters({ country: "United Kingdom" })).toEqual({
      country: "uk",
      visaType: undefined,
    });
    expect(normalizeKnowledgeFilters({ country: "HKSAR" })).toEqual({
      country: "hong_kong",
      visaType: undefined,
    });
    expect(normalizeKnowledgeFilters({ country: "Schengen_Area" })).toEqual({
      country: "france",
      visaType: undefined,
    });
  });

  it("preserves the current visa-type aliases and whitespace behavior", () => {
    expect(normalizeKnowledgeFilters({ visaType: "DS160" })).toEqual({
      country: undefined,
      visaType: "b1_b2",
    });
    expect(normalizeKnowledgeFilters({ visaType: "b211a" })).toEqual({
      country: undefined,
      visaType: "tourist_b211a",
    });
    expect(normalizeKnowledgeFilters({ visaType: "  custom_type  " })).toEqual({
      country: undefined,
      visaType: "custom_type",
    });
  });

  it("keeps null and empty filters compatible with the service", () => {
    expect(normalizeKnowledgeFilters({ country: null, visaType: null })).toEqual({
      country: null,
      visaType: null,
    });
    expect(normalizeKnowledgeFilters()).toEqual({
      country: undefined,
      visaType: undefined,
    });
  });

  it("keeps intent document targeting unchanged", () => {
    expect(documentTypesForIntent("requirements")).toEqual([
      "requirements",
      "form_requirements",
      "photo_requirements",
    ]);
    expect(documentTypesForIntent(undefined)).toBeUndefined();
  });
});
