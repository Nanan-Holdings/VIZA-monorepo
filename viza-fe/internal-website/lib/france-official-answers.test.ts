import { describe, expect, it } from "vitest";
import {
  containsNonLatinText,
  franceAnswerProblemsMessage,
  validateFranceOfficialAnswers,
} from "./france-official-answers";

const validHotelStay = {
  place_of_birth: "Changsha",
  home_address_line_1: "No. 18 Dongsanhuan North Road",
  home_address_city: "Beijing",
  phone_number: "+86 138 0013 8000",
  email_address: "applicant@viza.test",
  accommodation_type: "hotel",
  accommodation_name: "Hôtel du Louvre",
  accommodation_address_line_1: "Place André Malraux",
  accommodation_postcode: "75001",
  accommodation_city: "Paris",
  accommodation_phone: "+33 1 44 58 38 38",
  accommodation_email: "reservations@hotel.test",
  submission_centre: "changsha",
};

describe("validateFranceOfficialAnswers", () => {
  it("accepts real Latin answers, accents included", () => {
    expect(validateFranceOfficialAnswers(validHotelStay)).toEqual([]);
  });

  it("flags the Chinese and placeholder text seen in a real application", () => {
    const problems = validateFranceOfficialAnswers({
      ...validHotelStay,
      home_address_city: "确定",
      accommodation_city: "阿瓦达千瓦的",
    });
    expect(problems).toEqual([
      { field: "home_address_city", labelZh: "现居城市", reason: "contains_non_latin" },
      { field: "accommodation_city", labelZh: "住宿城市", reason: "contains_non_latin" },
    ]);
    expect(franceAnswerProblemsMessage(problems)).toContain("请用英文或拼音填写：现居城市、住宿城市");
  });

  it("requires the postcode of the chosen accommodation block", () => {
    const { accommodation_postcode: _omitted, ...withoutPostcode } = validHotelStay;
    expect(validateFranceOfficialAnswers(withoutPostcode)).toEqual([
      { field: "accommodation_postcode", labelZh: "住宿地址邮编", reason: "missing" },
    ]);
    expect(
      validateFranceOfficialAnswers({ ...validHotelStay, accommodation_type: "private_host", host_city: "Lyon" }),
    ).toEqual([{ field: "host_postcode", labelZh: "邀请人地址邮编", reason: "missing" }]);
  });

  it("checks phone and email formats", () => {
    expect(
      validateFranceOfficialAnswers({ ...validHotelStay, phone_number: "call me", email_address: "not-an-email" }),
    ).toEqual([
      { field: "phone_number", labelZh: "电话号码", reason: "invalid_format" },
      { field: "email_address", labelZh: "电子邮箱", reason: "invalid_format" },
    ]);
  });

  it("treats other scripts and full-width punctuation as non-Latin", () => {
    expect(containsNonLatinText("Москва")).toBe(true);
    expect(containsNonLatinText("Beijing，Chaoyang")).toBe(true);
    expect(containsNonLatinText("Saint-Étienne (42)")).toBe(false);
  });

  it("requires the submission centre France-Visas files the application at", () => {
    const { submission_centre: _omitted, ...withoutCentre } = validHotelStay;
    expect(validateFranceOfficialAnswers(withoutCentre)).toEqual([
      { field: "submission_centre", labelZh: "递交签证申请的城市", reason: "missing" },
    ]);
  });

  it("requires every school detail France-Visas asks students for", () => {
    const problems = validateFranceOfficialAnswers({
      ...validHotelStay,
      is_student: "yes",
      school_name: "National University of Singapore",
      school_address: "21 Lower Kent Ridge Road",
      school_country: "SG",
      school_phone: "+65 6516 6666",
    });
    expect(problems).toEqual([
      { field: "school_city", labelZh: "学校所在城市", reason: "missing" },
      { field: "school_email", labelZh: "学校电子邮箱", reason: "missing" },
    ]);
  });

  it("requires the hotel's phone and e-mail for a hotel stay", () => {
    const { accommodation_phone: _phone, accommodation_email: _email, ...withoutContact } = validHotelStay;
    expect(validateFranceOfficialAnswers(withoutContact)).toEqual([
      { field: "accommodation_phone", labelZh: "住宿电话", reason: "missing" },
      { field: "accommodation_email", labelZh: "住宿电子邮箱", reason: "missing" },
    ]);
  });
});
