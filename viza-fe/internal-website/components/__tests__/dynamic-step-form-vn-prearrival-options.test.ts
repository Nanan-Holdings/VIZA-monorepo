import { describe, expect, it } from "vitest";
import {
  ensureVnPrearrivalOtherFlightFlow,
  getPhoneCountryCodeOptions,
  withVnPrearrivalOtherHotelOption,
} from "@/components/dynamic-step-form";
import { getVnPrearrivalAdministrativeOptions } from "@/lib/vn-prearrival/administrative-options";
import { getVnPrearrivalStaticOptions } from "@/lib/vn-prearrival/static-options";
import type { WizardStep } from "@/types/visa-form-fields";

describe("Vietnam pre-arrival dynamic form options", () => {
  it("repairs stale schemas so Other flight exposes a manual number and editable airport", () => {
    const staleSteps: WizardStep[] = [{
      stepNumber: 2,
      stepName: "Trip Information",
      fields: [
        {
          id: "flight",
          visaType: "VN_PREARRIVAL_DECLARATION",
          fieldName: "flight_number",
          label: "Flight Number",
          fieldType: "select",
          required: true,
          stepNumber: 2,
          stepName: "Trip Information",
          displayOrder: 4,
          placeholder: null,
          validationRules: null,
          options: null,
          conditionalLogic: { showIf: "mode_of_travel === air" },
        },
        {
          id: "airport",
          visaType: "VN_PREARRIVAL_DECLARATION",
          fieldName: "border_gate_airport",
          label: "Border Gate",
          fieldType: "select",
          required: true,
          stepNumber: 2,
          stepName: "Trip Information",
          displayOrder: 6,
          placeholder: "Select Airport",
          validationRules: { read_only: true },
          options: null,
          conditionalLogic: { showIf: "mode_of_travel === air" },
        },
      ],
    }];

    const [repairedStep] = ensureVnPrearrivalOtherFlightFlow(staleSteps);
    const customFlight = repairedStep.fields.find((field) => field.fieldName === "custom_flight_number");
    const airport = repairedStep.fields.find((field) => field.fieldName === "border_gate_airport");

    expect(customFlight?.conditionalLogic).toEqual({
      showIf: "mode_of_travel === air && flight_number === other",
    });
    expect(airport?.validationRules).toMatchObject({
      locked_by: "flight_number",
      read_only: true,
      editable_when_value: "other",
    });
  });

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

    const allIssuePlaces = getVnPrearrivalStaticOptions("prearrival_category:visa_issue_place") ?? [];
    expect(allIssuePlaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label_en: "Embassy of Vietnam in China (Beijing)",
          label_zh: "越南驻中国（北京）大使馆",
        }),
        expect.objectContaining({
          label_en: "Consulate General of Vietnam in Guangzhou (China)",
          label_zh: "越南驻广州（中国）总领事馆",
        }),
        expect.objectContaining({
          label_en: "Embassy of Vietnam in Tanzania",
          label_zh: "越南驻坦桑尼亚大使馆",
        }),
        expect.objectContaining({
          label_en: "Embassy of Vietnam in Turkey",
          label_zh: "越南驻土耳其大使馆",
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

  it("keeps flight airport metadata local and serves administrative units separately", () => {
    const flights = getVnPrearrivalStaticOptions("prearrival_category:flight") ?? [];
    expect(getVnPrearrivalStaticOptions("prearrival_category:flight")).toBe(flights);
    expect(flights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "VJ5439_CXR",
          label_en: "VJ5439 - CXR",
          airport: "CXR",
        }),
        expect.objectContaining({
          value: "MH0746_DAD",
          label_en: "MH746 (MH0746) - DAD",
          airport: "DAD",
        }),
      ]),
    );

    expect(getVnPrearrivalStaticOptions("prearrival_category:administrative_unit_level1")).toBeNull();
    expect(getVnPrearrivalStaticOptions("prearrival_category:administrative_unit_level2", "48")).toBeNull();

    const provinces = getVnPrearrivalAdministrativeOptions("level1");
    expect(provinces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "01", label_en: "Ha Noi City" }),
        expect.objectContaining({ value: "48", label_en: "Da Nang City" }),
      ]),
    );

    const wards = getVnPrearrivalAdministrativeOptions("level2", "48");
    expect(wards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "20410",
          label_en: "Hoi An Ward",
          label_zh: "会安坊",
        }),
        expect.objectContaining({
          value: "20285",
          label_en: "Ngu Hanh Son Ward",
          label_zh: "五行山坊",
        }),
        expect.objectContaining({
          value: "20200",
          label_en: "Hoa Khanh Ward",
          label_zh: "和庆坊",
        }),
      ]),
    );
    expect(
      getVnPrearrivalAdministrativeOptions("level2").length,
    ).toBe(0);
    const allWards = [
      "01", "04", "08", "11", "12", "14", "15", "19", "20", "22", "24",
      "25", "31", "33", "37", "38", "40", "42", "44", "46", "48", "51",
      "52", "56", "66", "68", "75", "79", "80", "82", "86", "91", "92",
      "96",
    ].flatMap((province) =>
      getVnPrearrivalAdministrativeOptions("level2", province),
    );
    expect(allWards).toHaveLength(3321);
    expect(
      allWards.every((ward) => {
        if (ward.label_en.endsWith(" Ward")) return ward.label_zh.endsWith("坊");
        if (ward.label_en.endsWith(" Commune")) return ward.label_zh.endsWith("社");
        if (ward.label_en.startsWith("Dac Khu ")) return ward.label_zh.endsWith("特区");
        if (ward.value === "06325") return ward.label_zh.endsWith("社");
        return false;
      }),
    ).toBe(true);
    expect(
      allWards.some((ward) => /(?:坊坊|社社|特特区|特区特区)$/u.test(ward.label_zh)),
    ).toBe(false);
    expect(wards).not.toEqual(expect.arrayContaining([expect.objectContaining({ value: "48033" })]));
  });

  it("keeps only official business accommodation records and localizes their Chinese display", () => {
    const hotels = getVnPrearrivalStaticOptions("prearrival_category:hotel") ?? [];
    const hotelObjects = hotels.filter((hotel): hotel is Exclude<typeof hotel, string> => typeof hotel !== "string");
    const hoiAnHotel = hotelObjects.find((hotel) => hotel.value === "KSDN_60");

    expect(hotels).toHaveLength(1811);
    expect(hotelObjects.some((hotel) => hotel.value.includes("_REAL_"))).toBe(false);
    expect(hoiAnHotel).toMatchObject({
      label_en: "T & D Hoi An House, Group 46, Hau Xa Hamlet, Thanh Ha Village, Hoi An, Quang Nam",
    });
    expect(hoiAnHotel?.label_zh).toMatch(/^T&D会安之家，/);
    expect(hoiAnHotel?.label_zh).not.toContain("Maison");
  });

  it("keeps the complete official hotel hierarchy keyed by ward code", () => {
    const haiVanHotels = getVnPrearrivalStaticOptions("prearrival_category:hotel", "20194") ?? [];
    const hotelObjects = haiVanHotels.filter(
      (hotel): hotel is Exclude<typeof hotel, string> => typeof hotel !== "string",
    );

    expect(hotelObjects).toHaveLength(5);
    expect(hotelObjects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        value: "KSDN_01",
        label_en: expect.stringContaining("Dan Nguyen Phat Hotel"),
        province_city: "48",
        ward: "20194",
      }),
      expect.objectContaining({ value: "KSDN_05" }),
    ]));
  });

  it("always keeps the official Other hotel option available after remote search", () => {
    const options = withVnPrearrivalOtherHotelOption([
      {
        value: "KSDN_60",
        text: "T & D Hoi An House",
        label_en: "T & D Hoi An House",
        label_zh: "T&D会安之家",
      },
    ]);

    expect(options).toEqual([
      expect.objectContaining({ value: "KSDN_60" }),
      expect.objectContaining({
        value: "other",
        label_zh: "其他",
        label_en: "Other",
        official_label: "Other",
      }),
    ]);
    expect(withVnPrearrivalOtherHotelOption(options)).toHaveLength(2);
  });
});
