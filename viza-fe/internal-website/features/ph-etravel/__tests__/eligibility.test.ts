import { describe, expect, test } from "vitest";

import {
  evaluatePhEtravelEligibility,
  PH_ETRAVEL_BOUNDARY_COPY,
  PH_ETRAVEL_FAMILY_MEMBER_COPY,
  PH_ETRAVEL_SEA_REVIEW_COPY,
} from "../eligibility";

describe("Philippines eTravel arrival eligibility", () => {
  test("supports ordinary air and sea passengers", () => {
    expect(evaluatePhEtravelEligibility("ordinary_air_passenger")).toMatchObject({
      status: "supported",
      reasonCode: "ordinary_air_passenger_supported",
    });
    expect(evaluatePhEtravelEligibility("ordinary_sea_passenger")).toMatchObject({
      status: "supported",
      reasonCode: "ordinary_sea_passenger_supported",
    });
    expect(evaluatePhEtravelEligibility("ordinary_sea_passenger").messageEn).toContain("verified ordinary SEA");
    expect(evaluatePhEtravelEligibility("ordinary_sea_passenger").messageEn).toContain("arrival passenger paths");
    expect(evaluatePhEtravelEligibility("ordinary_sea_passenger").messageEn).toContain("separate official paths");
  });

  test("diverts crew, cruise, diplomatic, 9(e), and official passport cases", () => {
    for (const choice of [
      "crew",
      "cruise",
      "special_registration",
      "foreign_diplomat_or_dignitary",
      "nine_e_visa",
      "diplomatic_official_service_passport",
    ] as const) {
      expect(evaluatePhEtravelEligibility(choice).status).toBe("unsupported");
    }
  });

  test("states free, non-visa, and border-control limits", () => {
    expect(PH_ETRAVEL_BOUNDARY_COPY.freeEn).toContain("free");
    expect(PH_ETRAVEL_BOUNDARY_COPY.notVisaEn).toContain("not a visa");
    expect(PH_ETRAVEL_BOUNDARY_COPY.borderEn).toContain("does not guarantee");
  });

  test("states family member declarations are separate", () => {
    expect(PH_ETRAVEL_FAMILY_MEMBER_COPY.en).toContain("Each selected family member");
    expect(PH_ETRAVEL_FAMILY_MEMBER_COPY.en).toContain("separate travel declaration");
  });

  test("documents SEA Review evidence without applying AIR customs or signature assumptions", () => {
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.ordinaryPassengerEn).toContain("ordinary arriving passengers");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.ordinaryPassengerEn).toContain("non-cruise vessels");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.ordinaryPassengerEn).toContain("not for cruise");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.destinationEn).toContain("path-specific");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.destinationEn).toContain("is_disembarking is true");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.destinationEn).toContain("electronic variant");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.customsEn).toContain("manual Baggage and Currency");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.customsEn).toContain("electronic variant reached a signature page");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.signatureEn).toContain("manual-forms path reached Summary without signature");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.signatureEn).toContain("Family Member(s)");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.signatureEn).toContain("final Submit");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.crewCruiseEn).toContain("vessel crew labels");
    expect(PH_ETRAVEL_SEA_REVIEW_COPY.crewCruiseEn).toContain("separate official cruise declaration route");
  });
});
