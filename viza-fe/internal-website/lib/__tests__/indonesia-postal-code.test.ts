import { describe, expect, it } from "vitest";
import {
  normalizeIndonesiaPostalCode,
  parseIndonesiaPostalDirectoryResponse,
} from "@/lib/indonesia-postal-code";

describe("Indonesia postal-code validation", () => {
  it("normalizes only five-digit postal codes", () => {
    expect(normalizeIndonesiaPostalCode("10310")).toBe("10310");
    expect(normalizeIndonesiaPostalCode("10 310")).toBe("10310");
    expect(normalizeIndonesiaPostalCode("1031")).toBeNull();
  });

  it("extracts the official-form address hierarchy from a postal-directory response", () => {
    const location = parseIndonesiaPostalDirectoryResponse({
      data: {
        postalCodes: [{
          code: "10310",
          village: { name: "Menteng" },
          district: { name: "Menteng" },
          city: { name: "KOTA ADM. JAKARTA PUSAT" },
          province: { name: "DKI JAKARTA" },
        }],
      },
    }, "10310");

    expect(location).toEqual({
      postalCode: "10310",
      village: "Menteng",
      district: "Menteng",
      city: "KOTA ADM. JAKARTA PUSAT",
      province: "DKI JAKARTA",
    });
  });
});
