import { describe, expect, it } from "vitest";
import {
  assessIndonesiaAccommodationAddress,
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

describe("Indonesia accommodation address validation", () => {
  const location = {
    postalCode: "10310",
    village: "Menteng",
    district: "Menteng",
    city: "KOTA ADM. JAKARTA PUSAT",
    province: "DKI JAKARTA",
  };

  it("rejects an address explicitly located outside Indonesia", () => {
    expect(assessIndonesiaAccommodationAddress("Yuhua District, Changsha, China", location).status).toBe("invalid");
  });

  it("accepts an address that matches the postal-code location", () => {
    expect(assessIndonesiaAccommodationAddress("Jl. H. Agus Salim, Menteng, Jakarta", location).status).toBe("valid");
  });
});
