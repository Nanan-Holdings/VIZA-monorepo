import { describe, expect, it } from "vitest";
import { localizeVnPrearrivalHotelLabel } from "./hotel-localization";
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

  it("keeps every official hotel option fully Chinese in the Chinese column", () => {
    const options = getVnPrearrivalStaticOptions("hotel") ?? [];
    const labelsWithLatinText = options
      .map((option) => typeof option === "string" ? option : option.label_zh ?? "")
      .filter((label) => /[A-Za-zÀ-ỹĐđ]/.test(label.replaceAll("ATC", "")));

    expect(options.length).toBeGreaterThan(1_800);
    expect(labelsWithLatinText).toEqual([]);
  });
});
