import { describe, expect, it } from "vitest";
import { getPhoneCountryCodeOptions } from "@/components/dynamic-step-form";
import { getVnPrearrivalAdministrativeOptions } from "@/lib/vn-prearrival/administrative-options";
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
          label_zh: "Phường Hội An",
        }),
      ]),
    );
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
      label_zh: "T & D Maison 会安，第46街区后舍，清河，会安，广南",
    });
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
});
