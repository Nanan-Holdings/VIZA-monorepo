import { describe, expect, it } from "vitest";
import { __testables } from "./route";

describe("Vietnam pre-arrival official option mapping", () => {
  it("uses the same leading-zero search normalization as the official autocomplete", () => {
    expect(__testables.normalizeOfficialFlightSearch("MH746")).toBe("MH0746");
    expect(__testables.normalizeOfficialFlightSearch("MH0746")).toBe("MH0746");
    expect(__testables.normalizeOfficialFlightSearch("3K557")).toBe("3K557");
  });

  it("paginates the live flight catalog for incremental dropdown loading", () => {
    const result = __testables.paginateOptions(
      Array.from({ length: 25 }, (_, index) => `flight-${index}`),
      1,
      10,
    );

    expect(result).toEqual({
      items: Array.from({ length: 10 }, (_, index) => `flight-${index + 10}`),
      totalCount: 25,
      hasMore: true,
    });
  });

  it("maps visa issue place official english_value instead of showing the code", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "AUS-1",
          english_value: "Australia",
          cn_value: "澳大利亚",
          visa_type: "ABTC",
        },
        "visa_issue_place",
      ),
    ).toMatchObject({
      value: "AUS-1",
      label_en: "Australia",
      label_zh: "澳大利亚",
      official_label: "Australia",
    });
  });

  it("maps official flight code and airport into the portal label and value", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "UO0566_CXR",
          en_value: "UO0566",
          airport: "CXR",
          airline: "UO",
        },
        "flight",
      ),
    ).toMatchObject({
      value: "UO0566_CXR",
      label_en: "UO566 (UO0566) - CXR",
      official_label: "UO566 (UO0566) - CXR",
      airport: "CXR",
      airline: "UO",
    });
  });

  it("serves the official static Chinese issue-place translation instead of a machine-translated fragment", async () => {
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/vn-prearrival/options?source=prearrival_category%3Avisa_issue_place&parent=EV"));
    const payload = await response.json() as { options: Array<{ label_zh: string; label_en: string }> };

    expect(payload.options).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label_en: "Vietnam Immigration Department - Ministry of Public Security",
        label_zh: "越南出入境管理局 - 公安部",
      }),
    ]));
  });

  it("uses Chinese country code labels from the hardcoded translation helper", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "CN",
          value: "+86",
          en_value: "China (+86)",
        },
        "country_code",
      ),
    ).toMatchObject({
      value: "+86",
      label_zh: "中国 (+86)",
      official_label: "China (+86)",
    });
  });

  it("filters official hotel options locally after loading findAllActive hotel", () => {
    const options = [
      { value: "KSHN_0001", text: "Sofitel Legend Metropole Hanoi", label_en: "Sofitel Legend Metropole Hanoi", label_zh: "Sofitel Legend Metropole Hanoi", official_label: "Sofitel Legend Metropole Hanoi" },
      { value: "KSDAD_SN01", text: "Samdi Da Nang Airport Hotel", label_en: "Samdi Da Nang Airport Hotel", label_zh: "Samdi Da Nang Airport Hotel", official_label: "Samdi Da Nang Airport Hotel" },
    ];

    expect(__testables.filterOptionsByKeyword(options, "hanoi")).toHaveLength(1);
    expect(__testables.filterOptionsByKeyword(options, "hanoi")[0]?.value).toBe("KSHN_0001");
  });

  it("preserves official hotel hierarchy metadata for dependent dropdowns", () => {
    expect(
      __testables.optionFromOfficial(
        {
          code: "KSDN_01",
          en_value: "Dan Nguyen Phat Hotel",
          province_city: "48",
          ward: "20194",
        },
        "hotel",
      ),
    ).toMatchObject({
      value: "KSDN_01",
      province_city: "48",
      ward: "20194",
    });
  });

  it("falls back to same-province hotels when the selected ward has no official hotel rows", () => {
    const options = [
      {
        value: "HANOI-1",
        text: "Hanoi Hotel",
        label_en: "Hanoi Hotel",
        label_zh: "河内酒店",
        official_label: "Hanoi Hotel",
        province_city: "01",
        ward: "00004",
      },
      {
        value: "DANANG-1",
        text: "Da Nang Hotel",
        label_en: "Da Nang Hotel",
        label_zh: "岘港酒店",
        official_label: "Da Nang Hotel",
        province_city: "48",
        ward: "20194",
      },
    ];

    expect(__testables.filterHotelOptionsByHierarchy(options, "20965", "48", "")).toEqual([
      expect.objectContaining({ value: "DANANG-1", province_city: "48", ward: "20194" }),
    ]);
  });

  it("searches the complete hotel catalog regardless of the currently selected ward", () => {
    const options = [
      {
        value: "HANOI-1",
        text: "Sofitel Legend Metropole Hanoi",
        label_en: "Sofitel Legend Metropole Hanoi",
        label_zh: "河内索菲特传奇大都会酒店",
        official_label: "Sofitel Legend Metropole Hanoi",
        province_city: "01",
        ward: "00004",
      },
      {
        value: "DANANG-1",
        text: "Da Nang Hotel",
        label_en: "Da Nang Hotel",
        label_zh: "岘港酒店",
        official_label: "Da Nang Hotel",
        province_city: "48",
        ward: "20194",
      },
    ];

    expect(__testables.filterHotelOptionsByHierarchy(options, "20194", "48", "Sofitel")).toEqual([
      expect.objectContaining({ value: "HANOI-1", province_city: "01", ward: "00004" }),
    ]);
  });

  it("prioritizes exact country-code matches before incidental text matches", () => {
    const options = [
      { value: "+850", text: "North Korea (+850)", label_en: "North Korea (+850)", label_zh: "CHDCND Triều Tiên (+850)", official_label: "North Korea (+850)", code: "KP" },
      { value: "+86", text: "China (+86)", label_en: "China (+86)", label_zh: "中国 (+86)", official_label: "China (+86)", code: "CN" },
    ];

    expect(__testables.filterOptionsByKeyword(options, "CN")[0]?.value).toBe("+86");
  });

  it("prioritizes exact dialing-code matches before substring matches", () => {
    const options = [
      { value: "+965", text: "Kuwait (+965)", label_en: "Kuwait (+965)", label_zh: "科威特 (+965)", official_label: "Kuwait (+965)", code: "KW" },
      { value: "+65", text: "Singapore (+65)", label_en: "Singapore (+65)", label_zh: "新加坡 (+65)", official_label: "Singapore (+65)", code: "SG" },
    ];

    expect(__testables.filterOptionsByKeyword(options, "65")[0]?.value).toBe("+65");
  });
});
