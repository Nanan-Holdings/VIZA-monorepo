import { describe, expect, it } from "vitest";
import {
  buildMalaysiaMdacUniversalProfileAnswerPatch,
  buildUniversalProfileAnswerPatch,
} from "@/lib/universal-profile-prefill";

describe("universal profile prefill", () => {
  it("maps reusable profile fields to creation-time application answers", () => {
    const patch = buildUniversalProfileAnswerPatch({
      full_name_zh: "李晓明",
      full_name_en: "Xiaoming Li",
      surname_zh: "李",
      surname_en: "Li",
      given_names_zh: "晓明",
      given_names_en: "Xiaoming",
      date_of_birth: "1998-03-15",
      birth_country: "China",
      birth_province_or_state_zh: "湖南",
      birth_province_or_state_en: "Hunan",
      birth_city_zh: "长沙",
      birth_city_en: "Changsha",
      gender: "male",
      nationality: "China",
      passport_number: "E12345678",
      passport_issue_date: "2024-01-01",
      passport_expiry_date: "2034-01-01",
      passport_issuing_country: "China",
      phone: "+86 13312345678",
      email: "xiaoming.li@example.com",
    });

    expect(patch).toMatchObject({
      full_name: "Xiaoming Li",
      full_name_zh: "李晓明",
      full_name_en: "Xiaoming Li",
      surname: "Li",
      surname_zh: "李",
      surname_en: "Li",
      given_names: "Xiaoming",
      given_names_zh: "晓明",
      given_names_en: "Xiaoming",
      date_of_birth: "1998-03-15",
      birth_city: "Changsha",
      birth_city_zh: "长沙",
      birth_city_en: "Changsha",
      birth_province: "Hunan",
      birth_province_zh: "湖南",
      birth_province_en: "Hunan",
      country_of_birth: "China",
      sex: "male",
      nationality_country: "China",
      passport_number: "E12345678",
      passport_issuance_date: "2024-01-01",
      passport_expiration_date: "2034-01-01",
      passport_issuing_country: "China",
      phone: "+86 13312345678",
      email: "xiaoming.li@example.com",
    });
  });

  it("does not emit empty answers for blank profile fields", () => {
    const patch = buildUniversalProfileAnswerPatch({
      surname: " ",
      given_names: "",
      passport_number: null,
      email: undefined,
    });

    expect(patch).toEqual({});
  });

  it("maps MDAC place of birth to the official alpha-3 birth country value", () => {
    const patch = buildMalaysiaMdacUniversalProfileAnswerPatch({
      birth_country: "China",
      birth_city_en: "Changsha",
      place_of_birth: "China | Hunan | Changsha",
    });

    expect(patch).toEqual({
      place_of_birth: "CHN",
    });
  });
});
