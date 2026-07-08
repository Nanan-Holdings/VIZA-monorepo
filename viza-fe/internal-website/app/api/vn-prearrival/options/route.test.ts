import { describe, expect, it } from "vitest";
import { __testables } from "./route";

describe("Vietnam pre-arrival official option mapping", () => {
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
      label_en: "UO0566 - CXR",
      official_label: "UO0566 - CXR",
      airport: "CXR",
      airline: "UO",
    });
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

  it("prioritizes exact country-code matches before incidental text matches", () => {
    const options = [
      { value: "+850", text: "North Korea (+850)", label_en: "North Korea (+850)", label_zh: "CHDCND Triều Tiên (+850)", official_label: "North Korea (+850)", code: "KP" },
      { value: "+86", text: "China (+86)", label_en: "China (+86)", label_zh: "中国 (+86)", official_label: "China (+86)", code: "CN" },
    ];

    expect(__testables.filterOptionsByKeyword(options, "CN")[0]?.value).toBe("+86");
  });
});
