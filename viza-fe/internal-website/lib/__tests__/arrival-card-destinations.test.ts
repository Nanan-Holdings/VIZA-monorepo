import { describe, expect, test } from "vitest";
import {
  FEATURED_VISA_DESTINATIONS,
  SEARCHABLE_VISA_DESTINATIONS,
  getDisplayVisaDestinationsForRegion,
  getVisaPackageTitle,
  getVisaPackageTitleZh,
  getVisaTypeDisplayName,
  getVisaTypeDisplayNameZh,
  matchesVisaDestinationSearch,
} from "../visa-destinations";
import { isCountryLaunched } from "../launched-countries";
import { matchesSearchText } from "../utils";
import { SUPPORT_LABELS_ZH } from "../../components/client/home/DestinationRegionPageClient";

describe("arrival card destination labels", () => {
  test("featured destinations contain exactly three unique country entries", () => {
    expect(FEATURED_VISA_DESTINATIONS).toHaveLength(3);
    expect(FEATURED_VISA_DESTINATIONS.map((destination) => destination.country)).toEqual([
      "indonesia",
      "vietnam",
      "philippines",
    ]);
    expect(FEATURED_VISA_DESTINATIONS.every((destination) => destination.kind === "group")).toBe(true);
  });

  test("broader region pages collapse multi-schema countries into one entry", () => {
    const southeastAsia = getDisplayVisaDestinationsForRegion("southeast-asia");
    for (const country of ["indonesia", "vietnam", "philippines"]) {
      const entries = southeastAsia.filter((destination) => destination.country === country);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.kind).toBe("group");
      expect(entries[0]?.href).toBe(`/client/destinations/${country}`);
    }

    expect(getDisplayVisaDestinationsForRegion("vietnam").filter(
      (destination) => destination.country === "vietnam",
    )).toHaveLength(2);
  });

  test("SG Arrival Card has a fully localized package label separate from Singapore Visit Visa", () => {
    expect(getVisaTypeDisplayName("SG_ARRIVAL_CARD")).toBe("SG Arrival Card");
    expect(getVisaTypeDisplayNameZh("SG_ARRIVAL_CARD")).toBe("入境卡");

    expect(getVisaPackageTitle("singapore", "SG_ARRIVAL_CARD")).toBe("Singapore SG Arrival Card");
    expect(getVisaPackageTitleZh("singapore", "SG_ARRIVAL_CARD")).toBe("新加坡入境卡");
  });

  test("Singapore search card opens the SGAC form and Singapore/New Zealand are clickable", () => {
    const singapore = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "singapore");
    expect(singapore?.visaType).toBe("SG_ARRIVAL_CARD");
    expect(singapore?.visaNameZh).toBe("入境卡");

    expect(isCountryLaunched("singapore")).toBe(true);
    expect(isCountryLaunched("new_zealand")).toBe(true);
  });

  test("destination search matches Chinese and English country names", () => {
    const singapore = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "singapore");
    expect(singapore).toBeDefined();
    expect(matchesVisaDestinationSearch(singapore!, "sin")).toBe(true);
    expect(matchesVisaDestinationSearch(singapore!, "新加坡")).toBe(true);
    expect(matchesSearchText("ＳＩＮ", ["Singapore", "新加坡"])).toBe(true);

    expect(
      SEARCHABLE_VISA_DESTINATIONS
        .filter((destination) => matchesVisaDestinationSearch(destination, "sin"))
        .map((destination) => destination.country),
    ).toEqual(["singapore"]);
    expect(matchesVisaDestinationSearch(singapore!, "SGAC")).toBe(true);
  });

  test("Chinese application form names do not contain untranslated English words", () => {
    const allowedCategoryCodes = /B211A|B1\/B2|C-3|C1|B1|A1|\bC\b|\bL\b/g;

    for (const destination of SEARCHABLE_VISA_DESTINATIONS) {
      expect(
        destination.visaNameZh.replace(allowedCategoryCodes, ""),
        destination.country,
      ).not.toMatch(/[A-Za-z]/);
    }
  });

  test("Malaysia and Thailand arrival cards have standalone package labels and destination cards", () => {
    expect(getVisaTypeDisplayName("MY_MDAC_ARRIVAL_CARD")).toBe("Malaysia Digital Arrival Card");
    expect(getVisaTypeDisplayNameZh("MY_MDAC_ARRIVAL_CARD")).toBe("数字入境卡");
    expect(getVisaPackageTitle("malaysia", "MY_MDAC_ARRIVAL_CARD")).toBe("Malaysia Malaysia Digital Arrival Card");
    expect(getVisaPackageTitleZh("malaysia", "MY_MDAC_ARRIVAL_CARD")).toBe("马来西亚数字入境卡");

    expect(getVisaTypeDisplayName("TH_TDAC_ARRIVAL_CARD")).toBe("Thailand Digital Arrival Card");
    expect(getVisaTypeDisplayNameZh("TH_TDAC_ARRIVAL_CARD")).toBe("数字入境卡");
    expect(getVisaPackageTitle("thailand", "TH_TDAC_ARRIVAL_CARD")).toBe("Thailand Thailand Digital Arrival Card");
    expect(getVisaPackageTitleZh("thailand", "TH_TDAC_ARRIVAL_CARD")).toBe("泰国数字入境卡");

    const malaysia = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "malaysia");
    const thailand = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "thailand");
    expect(malaysia?.visaType).toBe("MY_MDAC_ARRIVAL_CARD");
    expect(malaysia?.visaNameZh).toBe("数字入境卡");
    expect(thailand?.visaType).toBe("TH_TDAC_ARRIVAL_CARD");
    expect(thailand?.visaNameZh).toBe("数字入境卡");
  });

  test("Philippines search collapses arrival and departure into one category entry", () => {
    expect(getVisaTypeDisplayName("PH_ETRAVEL_ARRIVAL_CARD")).toBe("Philippines eTravel Arrival Card");
    expect(getVisaTypeDisplayNameZh("PH_ETRAVEL_ARRIVAL_CARD")).toBe("电子入境卡");
    expect(getVisaPackageTitle("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toBe(
      "Philippines Philippines eTravel Arrival Card",
    );
    expect(getVisaPackageTitleZh("philippines", "PH_ETRAVEL_ARRIVAL_CARD")).toBe("菲律宾电子入境卡");

    const philippines = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "philippines");
    expect(philippines?.kind).toBe("group");
    expect(philippines?.href).toBe("/client/destinations/philippines");
    expect(philippines?.visaName).toBe("Choose declaration category");
    expect(philippines?.visaNameZh).toBe("选择申报类别");
    expect(philippines?.countryCount).toBe(2);
    expect(matchesVisaDestinationSearch(philippines!, "eTravel")).toBe(true);
    expect(SEARCHABLE_VISA_DESTINATIONS.filter((destination) =>
      matchesVisaDestinationSearch(destination, "eTravel"))).toEqual([philippines]);
    expect(getVisaTypeDisplayName("PH_ETRAVEL_DEPARTURE_CARD")).toBe("Philippines eTravel Departure Card");
    expect(getVisaTypeDisplayNameZh("PH_ETRAVEL_DEPARTURE_CARD")).toBe("电子出境卡");
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

  test("Vietnam e-Visa schema alias keeps the application title localized", () => {
    expect(getVisaTypeDisplayName("VN_E_VISA")).toBe("e-Visa");
    expect(getVisaTypeDisplayNameZh("VN_E_VISA")).toBe("电子签证");
    expect(getVisaPackageTitleZh("vietnam", "VN_E_VISA")).toBe("越南电子签证");
  });

  test("Chinese package titles remove country wording repeated by the product label", () => {
    expect(getVisaPackageTitleZh("taiwan", "TW_ENTRY_PERMIT")).toBe("中国台湾入境许可证");
    expect(getVisaPackageTitleZh("south_korea", "KR_E_ARRIVAL_CARD")).toBe("韩国电子入境卡");
  });

  test("South Korea C-3-9 search card is clickable as paper/KVAC assisted flow", () => {
    const southKorea = SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === "south_korea");
    expect(southKorea?.visaType).toBe("KR_C39_SHORT_TERM_VISIT");
    expect(southKorea?.visaNameZh).toBe("C-3 签证 / 电子旅行授权");
    expect(isCountryLaunched("south_korea")).toBe(true);
    expect(isCountryLaunched("kr")).toBe(true);
  });

  test("East Asia shows one Korea country card and the Korea page keeps two products", () => {
    const eastAsiaKorea = getDisplayVisaDestinationsForRegion("east-asia").filter(
      (destination) => destination.country === "south_korea",
    );
    expect(eastAsiaKorea).toHaveLength(1);
    expect(eastAsiaKorea[0]?.kind).toBe("group");
    expect(eastAsiaKorea[0]?.href).toBe("/client/destinations/south-korea");

    const southKorea = getDisplayVisaDestinationsForRegion("south-korea");
    expect(southKorea.map((destination) => destination.visaType).sort()).toEqual([
      "KR_C39_SHORT_TERM_VISIT",
      "KR_E_ARRIVAL_CARD",
    ]);
    expect(southKorea.find((destination) => destination.visaType === "KR_E_ARRIVAL_CARD")?.href).toBe(
      "/client/arrival-cards/south-korea",
    );
    expect(getVisaTypeDisplayName("KR_E_ARRIVAL_CARD")).toBe("Korea e-Arrival Card");
    expect(getVisaTypeDisplayNameZh("KR_E_ARRIVAL_CARD")).toBe("韩国电子入境卡");
    expect(getVisaPackageTitle("south_korea", "KR_E_ARRIVAL_CARD")).toBe("Korea e-Arrival Card");
    expect(getVisaPackageTitleZh("south_korea", "KR_E_ARRIVAL_CARD")).toBe("韩国电子入境卡");
    expect(SUPPORT_LABELS_ZH["Korea e-Arrival Card"]).toBe("韩国电子入境卡");
  });

  test("tourist-country cards use canonical DB schema product codes", () => {
    const expected = new Map([
      ["canada", "CA_TRV"],
      ["india", "IN_E_VISA"],
      ["saudi_arabia", "SA_E_VISA"],
      ["turkey", "TR_E_VISA"],
      ["united_arab_emirates", "AE_TOURIST_VISA"],
    ]);

    for (const [country, visaType] of expected) {
      expect(
        SEARCHABLE_VISA_DESTINATIONS.find((destination) => destination.country === country)?.visaType,
        country,
      ).toBe(visaType);
    }
  });
});
