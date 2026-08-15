import { describe, expect, test } from "vitest";

import {
  applyPhResidenceCascadeFormChange,
  applyPhResidenceCascadeChange,
  buildPhResidenceOfficialRequest,
  getPhResidenceMissingItems,
  isPhResidenceComplete,
  parsePhResidenceOfficialOptions,
  PH_RESIDENCE_CASCADE_CONTRACT,
  type PhResidenceAnswers,
} from "../residence-cascade";

const provincePayload = {
  data: [
    {
      code: "1400100000",
      correspondence_code: "140100000",
      region_code: "1400000000",
      name: "ABRA",
    },
  ],
};

const municipalityPayload = {
  data: [
    {
      code: "1400101000",
      correspondence_code: "140101000",
      region_code: "1400000000",
      province_code: "1400100000",
      name: "BANGUED",
      zip_code: null,
      is_sub: 0,
    },
  ],
};

const barangayPayload = {
  data: [
    {
      code: "1400101001",
      correspondence_code: "140101001",
      region_code: "1400000000",
      province_code: "1400100000",
      municipality_code: "1400101000",
      sub_municipality_code: null,
      name: "AGTANGAO",
    },
  ],
};

const completePhResidence: PhResidenceAnswers = {
  country_code: "PH",
  region_code: "1400000000",
  province_code: "1400100000",
  municipality_code: "1400101000",
  barangay_code: "1400101001",
  street: "SAMPLE STREET",
  street_two: "",
};

describe("Philippines eTravel official residence cascade", () => {
  test("builds only the verified official read endpoints with exact parent codes", () => {
    expect(PH_RESIDENCE_CASCADE_CONTRACT.observedProvinceCount).toBe(85);
    expect(buildPhResidenceOfficialRequest("province").toString()).toBe(
      "https://ws.etravel.gov.ph/api/v1/common/provinces?paginate=0&order_by=name&status_by=asc"
    );
    expect(
      buildPhResidenceOfficialRequest(
        "municipality",
        "1400100000"
      ).searchParams.get("province_code")
    ).toBe("1400100000");
    expect(
      buildPhResidenceOfficialRequest(
        "barangay",
        "1400101000"
      ).searchParams.get("municipality_code")
    ).toBe("1400101000");
  });

  test("bridges official residence keys to dynamic-form field names without retaining descendants", () => {
    const province = parsePhResidenceOfficialOptions(
      "province",
      provincePayload
    )[0];
    const result = applyPhResidenceCascadeFormChange(
      {
        unrelated_field: "kept",
        country_of_residence: "PH",
        residence_province_code: "OLD",
        residence_municipality_code: "1400101000",
        residence_barangay_code: "1400101001",
        residence_address_line1: "SAMPLE STREET",
      },
      { field: "province_code", option: province }
    );

    expect(result.values).toMatchObject({
      unrelated_field: "kept",
      country_of_residence: "PH",
      residence_region_code: "1400000000",
      residence_province_code: "1400100000",
      residence_municipality_code: "",
      residence_barangay_code: "",
      residence_address_line1: "SAMPLE STREET",
    });
    expect(result.clearedFieldNames).toEqual([
      "residence_municipality_code",
      "residence_barangay_code",
    ]);
  });

  test("preserves official codes as the only saved and submitted values", () => {
    const [province] = parsePhResidenceOfficialOptions(
      "province",
      provincePayload,
      {
        chineseLabelsByCode: { "1400100000": "阿布拉省" },
      }
    );
    const [municipality] = parsePhResidenceOfficialOptions(
      "municipality",
      municipalityPayload,
      { parentCode: "1400100000" }
    );
    const [barangay] = parsePhResidenceOfficialOptions(
      "barangay",
      barangayPayload,
      {
        parentCode: "1400101000",
      }
    );

    expect(province).toMatchObject({
      value: "1400100000",
      submitValue: "1400100000",
      officialLabel: "ABRA",
      label_zh: "阿布拉省",
      text: "阿布拉省 / ABRA",
      metadata: { regionCode: "1400000000" },
    });
    expect(municipality.value).toBe("1400101000");
    expect(municipality.metadata.provinceCode).toBe("1400100000");
    expect(barangay.value).toBe("1400101001");
    expect(barangay.metadata.municipalityCode).toBe("1400101000");
  });

  test("accepts only the verified direct or nested official response envelopes", () => {
    expect(
      parsePhResidenceOfficialOptions("province", { data: provincePayload })
    ).toHaveLength(1);
    expect(() => parsePhResidenceOfficialOptions("province", { rows: [] })).toThrow(
      /invalid official PH residence response data/i
    );
  });

  test("never resolves a code from a display name or a mismatched parent", () => {
    expect(() =>
      parsePhResidenceOfficialOptions("municipality", municipalityPayload, {
        parentCode: "BANGUED",
      })
    ).toThrow(/does not match selected province/i);
    expect(() =>
      parsePhResidenceOfficialOptions("barangay", barangayPayload, {
        parentCode: "1400101999",
      })
    ).toThrow(/does not match selected municipality/i);
  });

  test("clears all descendants when a parent changes and derives region from province metadata", () => {
    const [province] = parsePhResidenceOfficialOptions(
      "province",
      provincePayload
    );
    const result = applyPhResidenceCascadeChange(
      {
        ...completePhResidence,
        province_code: "OLD_PROVINCE",
        region_code: "OLD_REGION",
      },
      { field: "province_code", option: province }
    );

    expect(result.values).toMatchObject({
      region_code: "1400000000",
      province_code: "1400100000",
      municipality_code: "",
      barangay_code: "",
    });
    expect(result.clearedFieldNames).toEqual([
      "municipality_code",
      "barangay_code",
    ]);
  });

  test("clears PH codes and both address lines when residence country changes", () => {
    const result = applyPhResidenceCascadeChange(completePhResidence, {
      field: "country_code",
      value: "SG",
    });

    expect(result.values).toEqual({
      country_code: "SG",
      region_code: "",
      province_code: "",
      municipality_code: "",
      barangay_code: "",
      street: "",
      street_two: "",
    });
  });

  test("lists every missing PH field with a stable form focus target", () => {
    const missing = getPhResidenceMissingItems({ country_code: "PH" });

    expect(missing.map((item) => item.officialKey)).toEqual([
      "province_code",
      "municipality_code",
      "barangay_code",
      "street",
    ]);
    expect(missing.every((item) => item.focusTarget.stepNumber === 2)).toBe(
      true
    );
    expect(missing.map((item) => item.focusTarget.anchor)).toEqual([
      "field-residence_province_code",
      "field-residence_municipality_code",
      "field-residence_barangay_code",
      "field-residence_address_line1",
    ]);
    expect(isPhResidenceComplete(completePhResidence)).toBe(true);
    expect(
      getPhResidenceMissingItems({
        ...completePhResidence,
        region_code: "",
      }).map((item) => item.officialKey)
    ).toContain("province_code");
  });

  test("keeps the non-PH branch as country plus line 1 with optional line 2", () => {
    expect(
      getPhResidenceMissingItems({ country_code: "SG", street: "" }).map(
        (item) => item.officialKey
      )
    ).toEqual(["street"]);
    expect(
      isPhResidenceComplete({ country_code: "SG", street: "SAMPLE ADDRESS" })
    ).toBe(true);
  });
});
