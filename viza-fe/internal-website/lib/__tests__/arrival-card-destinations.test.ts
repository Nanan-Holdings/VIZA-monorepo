import { describe, expect, test } from "vitest";
import {
  SEARCHABLE_VISA_DESTINATIONS,
  getVisaPackageTitle,
  getVisaPackageTitleZh,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
} from "../visa-destinations";
import { isCountryLaunched } from "../launched-countries";

describe("arrival card destination labels", () => {
  test("SG Arrival Card has a dedicated package label separate from Singapore Visit Visa", () => {
    expect(getVisaTypeDisplayName("SG_ARRIVAL_CARD")).toBe("SG Arrival Card");
    expect(getVisaTypeDisplayNameZh("SG_ARRIVAL_CARD")).toBe("SG Arrival Card 入境卡");

    expect(getVisaPackageTitle("singapore", "SG_ARRIVAL_CARD")).toBe("Singapore SG Arrival Card");
    expect(getVisaPackageTitleZh("singapore", "SG_ARRIVAL_CARD")).toBe("新加坡SG Arrival Card 入境卡");
  });

  test("Singapore search card opens the SGAC form and Singapore/New Zealand are clickable", () => {
    const singapore = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "singapore");
    expect(singapore?.visaType).toBe("SG_ARRIVAL_CARD");
    expect(singapore?.visaNameZh).toBe("SG Arrival Card 入境卡");

    expect(isCountryLaunched("singapore")).toBe(true);
    expect(isCountryLaunched("new_zealand")).toBe(true);
  });
});
