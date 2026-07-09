import { describe, expect, it } from "vitest";
import { getPhoneCountryCodeOptions } from "@/components/dynamic-step-form";
import { getVnPrearrivalStaticOptions } from "@/lib/vn-prearrival/static-options";

describe("Vietnam pre-arrival dynamic form options", () => {
  it("provides selectable phone country codes when the official category is not session-readable", () => {
    const options = getPhoneCountryCodeOptions();

    expect(options.length).toBeGreaterThan(100);
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "+86",
          official_label: "(+86)",
        }),
        expect.objectContaining({
          value: "+65",
          official_label: "(+65)",
        }),
        expect.objectContaining({
          value: "+1",
          official_label: "(+1)",
        }),
      ]),
    );
  });

  it("uses clean Chinese labels for official Vietnam pre-arrival static options", () => {
    const issuePlaces = getVnPrearrivalStaticOptions("prearrival_category:visa_issue_place", "EV") ?? [];
    expect(issuePlaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label_zh: "越南出入境管理局 - 公安部",
          label_en: "Vietnam Immigration Department - Ministry of Public Security",
        }),
      ]),
    );

    const airports = getVnPrearrivalStaticOptions("prearrival_category:airport") ?? [];
    expect(airports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "CXR",
          label_zh: "金兰国际机场",
          label_en: "Cam Ranh International Airport",
        }),
      ]),
    );
  });

  it("keeps flight airport metadata and hotel administrative options local", () => {
    const flights = getVnPrearrivalStaticOptions("prearrival_category:flight") ?? [];
    expect(flights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "VJ5439_CXR",
          label_en: "VJ5439 - CXR",
          airport: "CXR",
        }),
      ]),
    );

    const provinces = getVnPrearrivalStaticOptions("prearrival_category:administrative_unit_level1") ?? [];
    expect(provinces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "01", label_zh: "河内市" }),
        expect.objectContaining({ value: "48", label_zh: "岘港市" }),
      ]),
    );

    const wards = getVnPrearrivalStaticOptions("prearrival_category:administrative_unit_level2", "01") ?? [];
    expect(wards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "00070",
          label_en: "Hoan Kiem Ward",
          label_zh: "Hoàn Kiếm坊",
        }),
      ]),
    );
  });
});
