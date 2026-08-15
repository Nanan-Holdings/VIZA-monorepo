import { describe, expect, it } from "vitest";
import {
  OFFICIAL_FEE_CATALOG,
  officialFeeCatalogFor,
  officialFeeCatalogKey,
} from "./official-fee-catalog";

describe("official fee catalog", () => {
  it("has a unique country and visa key for every route", () => {
    const keys = OFFICIAL_FEE_CATALOG.map((entry) =>
      officialFeeCatalogKey(entry.country, entry.visaType),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses only VIZA-managed, offline, or free classifications", () => {
    const classes = new Set(OFFICIAL_FEE_CATALOG.map((entry) => entry.fundingClass));
    expect(classes).toEqual(new Set(["viza_managed_card", "offline", "free"]));
  });

  it("provides a country code, descriptor, and HTTPS official URL for every route", () => {
    for (const entry of OFFICIAL_FEE_CATALOG) {
      expect(entry.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(entry.provider.length).toBeGreaterThan(3);
      expect(entry.targetPayee.length).toBeGreaterThan(3);
      expect(entry.feeSource.length).toBeGreaterThan(3);
      expect(entry.officialUrl).toMatch(/^https:\/\//);
    }
  });

  it.each([
    ["united_kingdom", "UK_STANDARD_VISITOR"],
    ["united_states", "B1_B2"],
    ["australia", "AU_VISITOR_600"],
    ["egypt", "EG_E_VISA"],
    ["thailand", "TH_TOURIST_E_VISA"],
    ["malaysia", "MY_TOURIST_E_VISA"],
    ["turkey", "TR_E_VISA"],
    ["united_arab_emirates", "AE_TOURIST_VISA"],
    ["canada", "CA_TRV"],
    ["india", "IN_E_VISA"],
    ["sri_lanka", "LK_ETA"],
    ["cambodia", "KH_TOURIST_E_VISA"],
    ["laos", "LA_TOURIST_E_VISA"],
    ["south_africa", "ZA_VISITOR_VISA"],
    ["saudi_arabia", "SA_E_VISA"],
    ["taiwan", "TW_ENTRY_PERMIT"],
    ["russia", "RU_E_VISA"],
    ["new_zealand", "NZ_VISITOR_VISA"],
    ["singapore", "SG_VISITOR_VISA"],
    ["philippines", "PH_TEMPORARY_VISITOR_VISA"],
  ])("classifies %s/%s as VIZA-managed", (country, visaType) => {
    expect(officialFeeCatalogFor(country, visaType)?.fundingClass).toBe(
      "viza_managed_card",
    );
  });

  it.each([
    ["italy", "EU_SCHENGEN_C_SHORT_STAY", "offline"],
    ["japan", "JP_TOURIST", "offline"],
    ["hong_kong", "HK_VISIT_VISA", "offline"],
    ["macau", "MO_VISIT_VISA", "offline"],
    ["maldives", "MV_IMUGA", "free"],
    ["singapore", "SG_ARRIVAL_CARD", "free"],
    ["malaysia", "MY_MDAC_ARRIVAL_CARD", "free"],
    ["thailand", "TH_TDAC_ARRIVAL_CARD", "free"],
    ["philippines", "PH_ETRAVEL_ARRIVAL_CARD", "free"],
    ["philippines", "PH_ETRAVEL_DEPARTURE_CARD", "free"],
    ["vietnam", "VN_PREARRIVAL_DECLARATION", "free"],
  ])("keeps %s/%s as a non-card exception", (country, visaType, expected) => {
    expect(officialFeeCatalogFor(country, visaType)?.fundingClass).toBe(expected);
  });

  it("normalizes existing country and visa aliases", () => {
    expect(officialFeeCatalogFor("GB", "UK_STANDARD_VISITOR")?.countryCode).toBe("GB");
    expect(officialFeeCatalogFor("US", "DS160")?.visaType).toBe("B1_B2");
    expect(officialFeeCatalogFor("VN", "TOURIST_EVISA")?.visaType).toBe("VN_E_VISA");
    expect(officialFeeCatalogFor("VIET_NAM", "VN_E_VISA")?.countryCode).toBe("VN");
    expect(officialFeeCatalogFor("UAE", "AE_TOURIST_VISA")?.countryCode).toBe("AE");
  });
});
