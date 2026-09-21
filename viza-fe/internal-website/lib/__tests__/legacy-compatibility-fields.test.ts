import { describe, expect, it } from "vitest";
import { isLegacyCompatibilityOnlyField } from "../legacy-compatibility-fields";

describe("legacy compatibility field metadata", () => {
  it("marks only the explicit persistence-only flag as hidden", () => {
    expect(isLegacyCompatibilityOnlyField({ validationRules: { legacy_compatibility_only: true } })).toBe(true);
    expect(isLegacyCompatibilityOnlyField({ validationRules: { legacy_compatibility_only: false } })).toBe(false);
    expect(isLegacyCompatibilityOnlyField({ validationRules: { required: true } })).toBe(false);
    expect(isLegacyCompatibilityOnlyField({ validationRules: null })).toBe(false);
  });
});
