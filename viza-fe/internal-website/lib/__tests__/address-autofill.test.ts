import { describe, expect, it } from "vitest";
import {
  matchAddressOptionValue,
  parseGoogleAddressLookup,
} from "@/lib/address-autofill";

describe("address autofill", () => {
  it("extracts Malaysian state, city, and postcode from Google address components", () => {
    const location = parseGoogleAddressLookup({
      status: "OK",
      results: [{
        formatted_address: "28, Jalan Teluk Kumbar, 11920 Bayan Lepas, Pulau Pinang, Malaysia",
        address_components: [
          { long_name: "11920", types: ["postal_code"] },
          { long_name: "Bayan Lepas", types: ["locality"] },
          { long_name: "Penang", short_name: "Penang", types: ["administrative_area_level_1"] },
          { long_name: "Malaysia", short_name: "MY", types: ["country"] },
        ],
      }],
    });

    expect(location).toEqual({
      formattedAddress: "28, Jalan Teluk Kumbar, 11920 Bayan Lepas, Pulau Pinang, Malaysia",
      state: "Penang",
      cityCandidates: ["Bayan Lepas"],
      postalCode: "11920",
      countryCode: "MY",
    });
  });

  it("matches Google names to official MDAC state and city values", () => {
    expect(matchAddressOptionValue([
      { value: "07", text: "PULAU PINANG", label_en: "PULAU PINANG", label_zh: "槟城" },
      { value: "14", text: "WP KUALA LUMPUR", label_en: "WP KUALA LUMPUR", label_zh: "吉隆坡联邦直辖区" },
    ], ["Penang"])).toBe("07");

    expect(matchAddressOptionValue([
      { value: "0704", text: "BAYAN LEPAS", label_en: "BAYAN LEPAS", label_zh: "峇六拜" },
      { value: "0708", text: "GEORGETOWN", label_en: "GEORGETOWN", label_zh: "乔治市" },
    ], ["Bayan Lepas"])).toBe("0704");
  });

  it("handles common Malaysian location aliases", () => {
    expect(matchAddressOptionValue([
      { value: "04", text: "MELAKA" },
      { value: "14", text: "WP KUALA LUMPUR" },
    ], ["Malacca"])).toBe("04");
    expect(matchAddressOptionValue([
      { value: "0708", text: "GEORGETOWN" },
    ], ["George Town"])).toBe("0708");
  });
});
