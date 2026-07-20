import { describe, expect, test } from "vitest";
import {
  FEATURED_VISA_DESTINATIONS,
  SEARCHABLE_VISA_DESTINATIONS,
  getVisaPackageTitle,
  getVisaPackageTitleZh,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
  matchesVisaDestinationSearch,
} from "../visa-destinations";
import { isCountryLaunched } from "../launched-countries";
import { matchesSearchText } from "../utils";

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

  test("destination search matches Chinese and English country names", () => {
    const singapore = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "singapore");
    expect(singapore).toBeDefined();
    expect(matchesVisaDestinationSearch(singapore!, "sin")).toBe(true);
    expect(matchesVisaDestinationSearch(singapore!, "新加坡")).toBe(true);
    expect(matchesSearchText("ＳＩＮ", ["Singapore", "新加坡"])).toBe(true);
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

  test("Philippines search card opens the standalone eTravel arrival card", () => {
    expect(getVisaTypeDisplayName("PH_ETRAVEL_ARRIVAL_CARD")).toBe("Philippines eTravel Arrival Card");
    expect(getVisaTypeDisplayNameZh("PH_ETRAVEL_ARRIVAL_CARD")).toBe("eTravel 入境卡");
    expect(getVisaPackageTitle("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toBe(
      "Philippines Philippines eTravel Arrival Card",
    );
    expect(getVisaPackageTitleZh("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toBe("菲律宾eTravel 入境卡");

    const philippines = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "philippines");
    expect(philippines?.visaType).toBe("PH_ETRAVEL_ARRIVAL_CARD");
    expect(philippines?.visaNameZh).toBe("eTravel 入境卡");
    expect(isCountryLaunched("philippines")).toBe(true);
    expect(isCountryLaunched("ph")).toBe(true);
  });

  test("Vietnam Pre-Arrival declaration has standalone arrival-card labels", () => {
    expect(getVisaTypeDisplayName("VN_PREARRIVAL_DECLARATION")).toBe(
      "Vietnam Pre-Arrival Information Declaration",
    );
    expect(getVisaTypeDisplayNameZh("VN_PREARRIVAL_DECLARATION")).toBe("越南入境前申报");
    expect(getVisaPackageTitle("vietnam", "VN_PREARRIVAL_DECLARATION")).toBe(
      "Vietnam Pre-Arrival Information Declaration",
    );
    expect(getVisaPackageTitleZh("vietnam", "VN_PREARRIVAL_DECLARATION")).toBe("越南入境前申报");

    const vietnamSchemas = SEARCHABLE_VISA_DESTINATIONS.filter(
      (destination) => destination.country === "vietnam" && destination.kind !== "group",
    );
    expect(vietnamSchemas.map((destination) => destination.visaType).sort()).toEqual([
      "VN_PREARRIVAL_DECLARATION",
      "evisa_tourism",
    ].sort());

    const vietnamFeatured = FEATURED_VISA_DESTINATIONS.find((destination) => destination.country === "vietnam");
    expect(vietnamFeatured?.kind).toBe("group");
    expect(vietnamFeatured?.countryCount).toBe(2);
  });

  test("South Korea C-3-9 search card is clickable as paper/KVAC assisted flow", () => {
    const southKorea = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "south_korea");
    expect(southKorea?.visaType).toBe("KR_C39_SHORT_TERM_VISIT");
    expect(southKorea?.visaNameZh).toBe("C-3 签证 / K-ETA");
    expect(isCountryLaunched("south_korea")).toBe(true);
    expect(isCountryLaunched("kr")).toBe(true);
  });
});
