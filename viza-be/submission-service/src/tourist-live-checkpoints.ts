/**
 * Verified public entry points for the five tourist products added in 2026-08.
 *
 * These are deliberately pre-submit checkpoints. They identify the first real
 * official control or authenticated boundary without creating an application,
 * solving a CAPTCHA, accepting a declaration, paying, or submitting.
 */
export const TOURIST_LIVE_CHECKPOINTS = {
  canada: {
    product: "CA_TRV",
    url: "https://portal-portail.apps.cic.gc.ca/signin?lang=en",
    requiredSelectors: ["#user-control", "#password-control"],
    expectedBoundary: "login_required",
  },
  turkey: {
    product: "TR_E_VISA",
    url: "https://evisa.gov.tr/en/apply/",
    requiredSelectors: [
      "#vizeturuList",
      "#uyruklist",
      "#belgelist",
      "#recaptcha_response_field",
      "#btnsubmit",
    ],
    expectedBoundary: "captcha_required",
  },
  india: {
    product: "IN_E_VISA",
    url: "https://indianvisaonline.gov.in/evisa/",
    applicationUrl: "https://indianvisaonline.gov.in/evisa/Registration",
    requiredSelectors: [
      "#nationality_id",
      "#ppt_type_id",
      "#missioncode_id",
      "#dob_id",
      "#email_id",
      "#email_re_id",
      "#visaPurposeDropdown",
      "#jouryney_id",
      "#captcha",
    ],
    expectedBoundary: "captcha_required",
  },
  saudi_arabia: {
    product: "SA_E_VISA",
    url: "https://visa.visitsaudi.com/Registration/Verify?lang=en",
    requiredSelectors: ["#PassportType", "#Nationality", "#CaptchaCode", "#btnVerify"],
    expectedBoundary: "captcha_required",
  },
  united_arab_emirates: {
    product: "AE_TOURIST_VISA",
    url: "https://smartservices.icp.gov.ae/echannels/web/client/guest/index.html#/issueVisa/request/783",
    requiredText: "VISA - MULTIPLE ENTRY - LONG-TERM TOURISM (5 YEARS) FOR ALL NATIONALITIES - ISSUE NEW VISA",
    expectedBoundary: "guest_service_shell_without_applicant_form",
  },
} as const;

export type TouristLiveCountry = keyof typeof TOURIST_LIVE_CHECKPOINTS;
