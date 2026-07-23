import { describe, expect, it } from "vitest";
import { localizeVnPrearrivalHotelLabel } from "./hotel-localization";
import officialAdministrativeNamesZh from "./official-administrative-names.zh-CN.json";
import officialHotelNamesZh from "./official-hotel-names.zh-CN.json";
import officialStaticOptions from "./official-static-options.json";
import { getVnPrearrivalStaticOptions } from "./static-options";

describe("Vietnam Pre-Arrival hotel localization", () => {
  it.each([
    [
      "Reyna Luxury Hotel, Phường Ba Đình, TP. Hà Nội",
      "蕾娜豪华酒店，巴亭坊，河内市",
    ],
    [
      "Roygent Parks Hanoi, Phường Ba Đình, TP. Hà Nội",
      "河内罗伊杰恩特公园酒店，巴亭坊，河内市",
    ],
    [
      "22Land Hotel Cau Giay, Phường Ba Đình, TP. Hà Nội",
      "纸桥22兰德酒店，巴亭坊，河内市",
    ],
    [
      "Western Hanoi Hotel, Phường Ba Đình, TP. Hà Nội",
      "河内西方酒店，巴亭坊，河内市",
    ],
    [
      "Grand K Hotel Suites Hanoi, Phường Ba Đình, TP. Hà Nội",
      "河内格兰德凯套房酒店，巴亭坊，河内市",
    ],
  ])("fully localizes %s", (officialLabel, expected) => {
    const localized = localizeVnPrearrivalHotelLabel(officialLabel, officialLabel);
    expect(localized).toBe(expected);
    expect(localized).not.toMatch(/[A-Za-zÀ-ỹĐđ]/);
  });

  it.each([
    [
      "Six Senses Côn Đảo, Bãi Đất Dốc, Đặc khu Côn Đảo, Thành phố Hồ Chí Minh",
      "昆岛六善酒店",
    ],
    [
      "Poulo Condor Boutique Resort, Suối Ớt, Đặc khu Côn Đảo, Thành phố Hồ Chí Minh",
      "普罗康朵精品水疗度假村",
    ],
    [
      "The Secret Con Dao, 08 Tôn Đức Thắng, Đặc khu Côn Đảo, Thành phố Hồ Chí Minh",
      "昆仑岛秘密酒店",
    ],
    [
      "Phi Yen Hotel Con Dao, 34 Tôn Đức Thắng, Đặc khu Côn Đảo, Thành phố Hồ Chí Minh",
      "彼颜酒店",
    ],
    [
      "ATC Resort Con Dao, 8 Nguyễn Đức Thuận, Đặc khu Côn Đảo, Thành phố Hồ Chí Minh",
      "ATC昆仑岛度假村",
    ],
  ])("prefers a verified Chinese property name for %s", (officialLabel, verifiedName) => {
    const localized = localizeVnPrearrivalHotelLabel(officialLabel, officialLabel);
    expect(localized.startsWith(`${verifiedName}，`)).toBe(true);
  });

  it("uses a Chinese transliteration fallback for an unknown official property", () => {
    const localized = localizeVnPrearrivalHotelLabel(
      "Mivora Hotel, Phường Tân An, TP. Đà Nẵng",
      "",
    );

    expect(localized).not.toMatch(/[A-Za-zÀ-ỹĐđ]/);
    expect(localized).toContain("酒店");
    expect(localized).toContain("坊");
    expect(localized).toContain("市");
  });

  it("translates generic hotel terms and Vietnamese text in every Chinese property name", () => {
    const options = getVnPrearrivalStaticOptions("hotel") ?? [];
    const genericHotelTerms = /\b(?:hotel|resort|spa|house|home|hostel|villa|apartment|residence|boutique|premium|luxury|airport|terminal|riverside|beach)\b/i;
    const untranslatedNames = Object.values(officialHotelNamesZh.names).filter(
      (name) => /[À-ỹĐđ]/.test(name) || genericHotelTerms.test(name),
    );

    expect(options).toHaveLength(1_811);
    expect(untranslatedNames).toEqual([]);
  });

  it("maps every official hotel code to one reviewed Chinese property name", () => {
    const officialHotels = officialStaticOptions.sources.hotel;
    const mappedCodes = Object.keys(officialHotelNamesZh.names);
    const uniqueOfficialNames = new Set(
      officialHotels.map((hotel) => (hotel.en_value || hotel.vn_value).split(",")[0].trim()),
    );

    expect(officialHotels).toHaveLength(1_811);
    expect(mappedCodes).toHaveLength(officialHotels.length);
    expect(new Set(mappedCodes).size).toBe(mappedCodes.length);
    expect(officialHotelNamesZh.source_count).toBe(officialHotels.length);
    expect(officialHotelNamesZh.unique_name_count).toBe(uniqueOfficialNames.size);
    expect(officialHotelNamesZh.reviewed_unique_name_count).toBe(uniqueOfficialNames.size);

    for (const hotel of officialHotels) {
      const expectedSourceName = (hotel.en_value || hotel.vn_value).split(",")[0].trim();
      const localizedName = officialHotelNamesZh.names[
        hotel.code as keyof typeof officialHotelNamesZh.names
      ];
      const recordedSourceName = officialHotelNamesZh.source_names[
        hotel.code as keyof typeof officialHotelNamesZh.source_names
      ];

      expect(localizedName, hotel.code).toBeTruthy();
      expect(recordedSourceName, hotel.code).toBe(expectedSourceName);
    }
  });

  it("uses the code-keyed name in the rendered Chinese hotel label", () => {
    const officialHotel = officialStaticOptions.sources.hotel.find(
      (hotel) => hotel.code === "KSHN_0001",
    );
    expect(officialHotel).toBeTruthy();

    const localized = localizeVnPrearrivalHotelLabel(
      officialHotel?.vn_value ?? "",
      officialHotel?.en_value ?? "",
      officialHotel?.code ?? "",
    );

    expect(localized).toMatch(/^河内索菲特/);
    expect(localized).not.toContain("斯奥弗伊特埃勒");
  });

  it("renders every official hotel with its reviewed property name and official Chinese location hierarchy", () => {
    const options = getVnPrearrivalStaticOptions("hotel") ?? [];
    const optionsByCode = new Map(
      options
        .filter((option) => typeof option !== "string")
        .map((option) => [option.value, option]),
    );

    expect(options).toHaveLength(1_811);

    for (const hotel of officialStaticOptions.sources.hotel) {
      const option = optionsByCode.get(hotel.code);
      const propertyName = officialHotelNamesZh.names[
        hotel.code as keyof typeof officialHotelNamesZh.names
      ];
      const wardName = officialAdministrativeNamesZh.wards[
        hotel.ward as keyof typeof officialAdministrativeNamesZh.wards
      ];
      const provinceName = officialAdministrativeNamesZh.provinces[
        hotel.province_city as keyof typeof officialAdministrativeNamesZh.provinces
      ];

      expect(option?.label_zh, hotel.code).toBeTruthy();
      expect(option?.label_zh, hotel.code).toContain(propertyName);
      if (wardName) {
        expect(option?.label_zh, hotel.code).toContain(wardName);
      }
      if (provinceName) {
        expect(option?.label_zh, hotel.code).toContain(provinceName);
      }
      expect(option?.label_zh, hotel.code).not.toMatch(
        /(?:凯赫乌|埃姆伊|恩格乌|阿恩赫|维奥阮|格伊阿普)/,
      );
      expect(option?.label_en, hotel.code).toBe(hotel.en_value);
      expect(option?.official_label, hotel.code).toBe(hotel.en_value);
    }
  });

  it("uses the Chinese booking-page name for Bonny Boutique Hotel", () => {
    const options = getVnPrearrivalStaticOptions("hotel") ?? [];
    const bonny = options.find(
      (option) => typeof option !== "string" && option.value === "KSDN_33",
    );

    expect(bonny).toMatchObject({
      label_zh: "邦尼精品公寓酒店，五行山坊，岘港市",
      label_en: "Bonny Boutique Hotel, 01-03 Khue My Dong 10, Khue My, Ngu Hanh Son, Da Nang",
      value: "KSDN_33",
    });
  });
});
