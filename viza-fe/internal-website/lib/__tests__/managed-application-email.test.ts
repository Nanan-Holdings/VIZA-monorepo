import { describe, expect, it } from "vitest";
import {
  applyManagedApplicationEmailToAnswers,
  isManagedApplicationEmailFieldName,
} from "@/lib/managed-application-email";

describe("managed application email fields", () => {
  it.each([
    "email",
    "email_address",
    "email_address_en",
    "applicant_email_address",
    "applicant_contact_email",
    "email_id",
    "e_mail_address",
    "email_address_confirmation",
    "re_enter_email_address",
    "confirm_email_address",
    "applicants_email",
    "alias_email_address",
    "visa_email",
  ])("classifies %s as applicant correspondence", (fieldName) => {
    expect(isManagedApplicationEmailFieldName(fieldName)).toBe(true);
  });

  it.each([
    "sponsor_email",
    "employer_email",
    "host_email",
    "us_contact_email",
    "additional_email",
    "accommodation_email",
  ])("keeps third-party or historical field %s editable", (fieldName) => {
    expect(isManagedApplicationEmailFieldName(fieldName)).toBe(false);
  });

  it("overrides applicant email keys without touching third-party contacts", () => {
    expect(applyManagedApplicationEmailToAnswers(
      {
        email_address: "personal@example.com",
        re_enter_email_address: "personal@example.com",
        sponsor_email: "sponsor@example.com",
      },
      " APPL-TEST@VIZA.IT.COM ",
    )).toEqual({
      email_address: "appl-test@viza.it.com",
      re_enter_email_address: "appl-test@viza.it.com",
      sponsor_email: "sponsor@example.com",
    });
  });
});
