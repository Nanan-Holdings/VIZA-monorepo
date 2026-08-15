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
      passport_place_of_issue: "Singapore",
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
      birthday: "1998-03-15",
      birth_city: "Changsha",
      birth_place: "Changsha",
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
      travel_document_issue_date: "2024-01-01",
      passport_expiration_date: "2034-01-01",
      travel_document_expiry_date: "2034-01-01",
      passport_issuing_country: "China",
      travel_document_issuing_country: "China",
      passport_place_of_issue: "Singapore",
      phone: "+86 13312345678",
      primary_phone: "+86 13312345678",
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

  it("does not copy synthetic QA profile values into a new application", () => {
    const patch = buildUniversalProfileAnswerPatch({
      full_name_en: "Xiaoming Li",
      address: "1 VIZA QA Road, Singapore 119077",
      address_zh: "新加坡 VIZA QA 路 1 号",
      address_en: "1 VIZA QA ROAD, SINGAPORE 119077",
    });

    expect(patch.full_name).toBe("Xiaoming Li");
    expect(patch).not.toHaveProperty("address");
    expect(patch).not.toHaveProperty("address_zh");
    expect(patch).not.toHaveProperty("address_en");
    expect(patch).not.toHaveProperty("home_address_line1");
  });

  it("maps a reusable national identity number without populating passport number", () => {
    const patch = buildUniversalProfileAnswerPatch({
      national_identity_number: "TESTID19900101X",
    });

    expect(patch).toMatchObject({
      national_identity_number: "TESTID19900101X",
      national_identity_no: "TESTID19900101X",
      national_id_number: "TESTID19900101X",
      national_id_no: "TESTID19900101X",
      identity_card_number: "TESTID19900101X",
      id_card_number: "TESTID19900101X",
    });
    expect(patch).not.toHaveProperty("passport_number");
  });

  it("repairs Chinese text accidentally stored in official English name columns", () => {
    const patch = buildUniversalProfileAnswerPatch({
      full_name_zh: "黄小敏",
      full_name_en: "黄小敏",
      surname_zh: "黄",
      surname_en: "黄",
      given_names_zh: "小敏",
      given_names_en: "小敏",
    });

    expect(patch).toMatchObject({
      full_name: "XIAOMIN HUANG",
      full_name_zh: "黄小敏",
      full_name_en: "XIAOMIN HUANG",
      surname: "HUANG",
      surname_en: "HUANG",
      given_names: "XIAOMIN",
      given_names_en: "XIAOMIN",
    });
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

  it("does not reuse birthplace as residence when residence details are missing", () => {
    const patch = buildUniversalProfileAnswerPatch({
      nationality: "China",
      birth_province_or_state_zh: "湖南",
      birth_province_or_state_en: "Hunan",
    });

    expect(patch).not.toHaveProperty("city_state_of_residence");
    expect(patch).not.toHaveProperty("home_address_city");
  });

  it("keeps passport issuing country, place, and authority separate", () => {
    const patch = buildUniversalProfileAnswerPatch({
      passport_issuing_country: "CHN",
      passport_place_of_issue: "Singapore",
      passport_issuing_authority: "Embassy of the P.R. China in Singapore",
    });

    expect(patch).toMatchObject({
      passport_issuing_country: "CHN",
      passport_place_of_issue: "Singapore",
      passport_issuance_city: "Singapore",
      passport_issuing_authority: "Embassy of the P.R. China in Singapore",
    });
  });

  it("hydrates expanded reusable answers collected from a previous country application", () => {
    const patch = buildUniversalProfileAnswerPatch({
      reusable_answers: [
        { canonicalKey: "civil_status", value: "married" },
        { canonicalKey: "father_surname", value: "LI" },
        { canonicalKey: "employer_name", value: "VIZA PTE LTD" },
        { canonicalKey: "passport_place_of_issue", value: "SINGAPORE" },
      ],
    });

    expect(patch).toMatchObject({
      civil_status: "married",
      marital_status: "married",
      father_surname: "LI",
      employer_name: "VIZA PTE LTD",
      passport_place_of_issue: "SINGAPORE",
      passport_issuance_city: "SINGAPORE",
    });
  });
});
