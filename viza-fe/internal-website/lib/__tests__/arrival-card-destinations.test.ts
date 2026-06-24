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

  test("Malaysia and Thailand arrival cards have standalone package labels and destination cards", () => {
    expect(getVisaTypeDisplayName("MY_MDAC_ARRIVAL_CARD")).toBe("Malaysia Digital Arrival Card");
    expect(getVisaTypeDisplayNameZh("MY_MDAC_ARRIVAL_CARD")).toBe("MDAC 数字入境卡");
    expect(getVisaPackageTitle("malaysia", "MY_MDAC_ARRIVAL_CARD")).toBe("Malaysia Malaysia Digital Arrival Card");
    expect(getVisaPackageTitleZh("malaysia", "MY_MDAC_ARRIVAL_CARD")).toBe("马来西亚MDAC 数字入境卡");

    expect(getVisaTypeDisplayName("TH_TDAC_ARRIVAL_CARD")).toBe("Thailand Digital Arrival Card");
    expect(getVisaTypeDisplayNameZh("TH_TDAC_ARRIVAL_CARD")).toBe("TDAC 数字入境卡");
    expect(getVisaPackageTitle("thailand", "TH_TDAC_ARRIVAL_CARD")).toBe("Thailand Thailand Digital Arrival Card");
    expect(getVisaPackageTitleZh("thailand", "TH_TDAC_ARRIVAL_CARD")).toBe("泰国TDAC 数字入境卡");

    const malaysia = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "malaysia");
    const thailand = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "thailand");
    expect(malaysia?.visaType).toBe("MY_MDAC_ARRIVAL_CARD");
    expect(malaysia?.visaNameZh).toBe("MDAC 数字入境卡");
    expect(thailand?.visaType).toBe("TH_TDAC_ARRIVAL_CARD");
    expect(thailand?.visaNameZh).toBe("TDAC 数字入境卡");
  });
});
