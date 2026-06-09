import { describe, expect, it } from "vitest";
import {
  getBirthCityOptions,
  getBirthProvinceOptions,
  normalizeBirthplace,
  OTHER_BIRTHPLACE_OPTION,
} from "@/lib/birthplace-options";

describe("birthplace options", () => {
  it("exposes China province and Hunan city cascade options", () => {
    expect(getBirthProvinceOptions("CN")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "HN", zh: "湖南", en: "Hunan" }),
        OTHER_BIRTHPLACE_OPTION,
      ]),
    );
    expect(getBirthCityOptions("China", "Hunan")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "CHANGSHA", zh: "长沙", en: "Changsha" }),
        OTHER_BIRTHPLACE_OPTION,
      ]),
    );
  });

  it("splits OCR composite birthplace text into structured fields", () => {
    const normalized = normalizeBirthplace({
      placeOfBirth: "China | Hunan | Changsha",
      nationality: "China",
    });

    expect(normalized.countryCode).toBe("CN");
    expect(normalized.provinceCode).toBe("HN");
    expect(normalized.cityCode).toBe("CHANGSHA");
    expect(normalized.province).toEqual({ zh: "湖南", en: "Hunan" });
    expect(normalized.city).toEqual({ zh: "长沙", en: "Changsha" });
  });

  it("repairs an existing composite value stored in the city column", () => {
    const normalized = normalizeBirthplace({
      city: "China | Hunan | Changsha",
    });

    expect(normalized.countryCode).toBe("CN");
    expect(normalized.provinceCode).toBe("HN");
    expect(normalized.cityCode).toBe("CHANGSHA");
  });
});
