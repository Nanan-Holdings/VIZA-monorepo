/**
 * VFS Global Italy China corridor selectors.
 *
 * All selectors are PLACEHOLDERS pending the live recon walk. The
 * structure of each group mirrors `france-visas/selectors.ts` so the
 * fill-steps shape is portable. Field groups are keyed by Annex I
 * section (matches the harmonized `EU_SCHENGEN_C_SHORT_STAY` seed).
 *
 * TODO(walk): replace every value below with the live DOM control
 * `name`/`id`/`data-test` captured by `walk-italy-vfs-cn.ts`.
 */

export const IT_VFS_URLS = {
  landing: "https://visa.vfsglobal.com/chn/en/ita/",
  landingZh: "https://visa.vfsglobal.com/chn/zh-cn/ita/",
  login: "https://visa.vfsglobal.com/chn/en/ita/login",
  // Path observed across other VFS country sites — verify on walk.
  applicationStart: "https://visa.vfsglobal.com/chn/en/ita/application-detail",
} as const;

export type ItVfsLanguage = "en" | "zh-cn";

/**
 * Pin language at the URL level so selectors stay stable across
 * applicants who land on the localized variant.
 */
export function urlForLanguage(base: string, lang: ItVfsLanguage): string {
  return base.replace(/\/(en|zh-cn)\//i, `/${lang}/`);
}

// ── Account / login selectors ─────────────────────────────────────────────
export const IT_VFS_LOGIN_SELECTORS = {
  emailInput: 'input[type="email"], input[name="email"]',
  passwordInput: 'input[type="password"], input[name="password"]',
  submitButton: 'button[type="submit"]',
  // Cloudflare Turnstile widget container — present on register, sometimes login.
  turnstileWidget: '[data-sitekey], .cf-turnstile',
  // Login error banner.
  errorBanner: '.alert-danger, [role="alert"]',
} as const;

// ── Annex I §1–9 (Personal Details) ──────────────────────────────────────
export const IT_VFS_PERSONAL_FIELDS = {
  surname: 'input[name="surname"]',
  surname_at_birth: 'input[name="surnameAtBirth"]',
  given_names: 'input[name="givenNames"]',
  date_of_birth: 'input[name="dateOfBirth"]',
  place_of_birth_city: 'input[name="placeOfBirthCity"]',
  place_of_birth_country: 'select[name="placeOfBirthCountry"]',
  current_nationality: 'select[name="currentNationality"]',
  nationality_at_birth: 'select[name="nationalityAtBirth"]',
  sex: 'select[name="sex"]',
  marital_status: 'select[name="maritalStatus"]',
} as const;

// ── Annex I §11–16 (Travel Document) ─────────────────────────────────────
export const IT_VFS_TRAVEL_DOC_FIELDS = {
  travel_document_type: 'select[name="travelDocumentType"]',
  travel_document_number: 'input[name="travelDocumentNumber"]',
  travel_document_issue_date: 'input[name="travelDocumentIssueDate"]',
  travel_document_expiry_date: 'input[name="travelDocumentExpiryDate"]',
  travel_document_issuing_country: 'select[name="travelDocumentIssuingCountry"]',
  national_id: 'input[name="nationalIdentityNumber"]',
} as const;

// ── Annex I §19–20 (Contact + Residence) ─────────────────────────────────
export const IT_VFS_CONTACT_FIELDS = {
  home_address_line1: 'input[name="homeAddressLine1"]',
  home_address_line2: 'input[name="homeAddressLine2"]',
  home_address_city: 'input[name="homeAddressCity"]',
  home_address_postal_code: 'input[name="homeAddressPostalCode"]',
  home_address_country: 'select[name="homeAddressCountry"]',
  email: 'input[type="email"][name="email"]',
  phone: 'input[name="phone"]',
} as const;

// ── Annex I §21–22 (Occupation) ──────────────────────────────────────────
export const IT_VFS_OCCUPATION_FIELDS = {
  current_occupation: 'select[name="currentOccupation"]',
  employer_name: 'input[name="employerName"]',
  employer_address: 'input[name="employerAddress"]',
  employer_phone: 'input[name="employerPhone"]',
} as const;

// ── Annex I §23–27 (Trip) + §30–31 (Purpose) ─────────────────────────────
export const IT_VFS_TRIP_FIELDS = {
  purpose_of_journey: 'select[name="purposeOfJourney"]',
  country_of_main_destination: 'select[name="countryOfMainDestination"]',
  member_state_of_first_entry: 'select[name="memberStateOfFirstEntry"]',
  number_of_entries_requested: 'select[name="numberOfEntriesRequested"]',
  intended_arrival_date: 'input[name="intendedArrivalDate"]',
  intended_departure_date: 'input[name="intendedDepartureDate"]',
  duration_of_intended_stay_days: 'input[name="durationOfStayDays"]',
} as const;

// ── Annex I §30 (Accommodation) ──────────────────────────────────────────
export const IT_VFS_ACCOMMODATION_FIELDS = {
  accommodation_type: 'select[name="accommodationType"]',
  hotel_name: 'input[name="hotelName"]',
  hotel_address: 'input[name="hotelAddress"]',
  hotel_phone: 'input[name="hotelPhone"]',
  hotel_email: 'input[name="hotelEmail"]',
  hotel_confirmation_number: 'input[name="hotelConfirmationNumber"]',
} as const;

// ── Annex I §28–29 (Travel History) ──────────────────────────────────────
export const IT_VFS_TRAVEL_HISTORY_FIELDS = {
  prev_schengen_visa_5y: 'input[name="prevSchengenVisa5y"]',
  prev_schengen_visa_valid_from: 'input[name="prevSchengenVisaValidFrom"]',
  prev_schengen_visa_valid_to: 'input[name="prevSchengenVisaValidTo"]',
  prev_fingerprints_given: 'input[name="prevFingerprintsGiven"]',
  prev_fingerprints_date: 'input[name="prevFingerprintsDate"]',
  prev_fingerprints_visa_sticker: 'input[name="prevFingerprintsVisaSticker"]',
} as const;

// ── Annex I §32 (Financial Support) ──────────────────────────────────────
export const IT_VFS_COST_FIELDS = {
  cost_borne_by: 'select[name="costBorneBy"]',
  // self-funded path
  self_means_cash: 'input[name="selfMeansCash"]',
  self_means_traveller_cheques: 'input[name="selfMeansTravellerCheques"]',
  self_means_credit_card: 'input[name="selfMeansCreditCard"]',
  self_means_prepaid_accommodation: 'input[name="selfMeansPrepaidAccommodation"]',
  self_means_prepaid_transport: 'input[name="selfMeansPrepaidTransport"]',
  self_means_other: 'input[name="selfMeansOther"]',
  // sponsor path
  sponsor_relationship: 'select[name="sponsorRelationship"]',
  sponsor_other_specify: 'input[name="sponsorOtherSpecify"]',
  sponsor_means_cash: 'input[name="sponsorMeansCash"]',
  sponsor_means_accommodation: 'input[name="sponsorMeansAccommodation"]',
  sponsor_means_living_expenses: 'input[name="sponsorMeansLivingExpenses"]',
  sponsor_means_transport: 'input[name="sponsorMeansTransport"]',
  sponsor_means_other: 'input[name="sponsorMeansOther"]',
} as const;

// ── Navigation, validation, and gate markers ─────────────────────────────
export const IT_VFS_NAV_SELECTORS = {
  nextButton: 'button[type="submit"], button.btn-next, button[data-action="next"]',
  backButton: 'button.btn-back, button[data-action="back"]',
  saveButton: 'button.btn-save, button[data-action="save"]',
} as const;

export const IT_VFS_VALIDATION_SUMMARY_SELECTOR =
  '.validation-summary, [role="alert"], .form-errors';

export const IT_VFS_FIELD_ERROR_SELECTOR = '.field-error, .invalid-feedback, [aria-invalid="true"]';

export const IT_VFS_GATE_MARKERS = {
  // Cloudflare Turnstile / Challenge.
  cloudflareChallenge: '#challenge-running, .cf-challenge-running',
  // reCAPTCHA v2 (rare on VFS but possible).
  recaptchaV2: 'iframe[src*="recaptcha"][src*="anchor"]',
  // VFS maintenance / outage banner.
  maintenanceBanner: '.maintenance-banner, .system-down',
} as const;

/**
 * Annex I purpose codes. VFS forms typically use the same vocabulary as
 * the harmonized PDF; confirm on walk and adjust if the corridor uses
 * its own enum.
 */
export const IT_VFS_PURPOSE_VALUES = {
  tourism: "TOURISM",
  business: "BUSINESS",
  visiting_family_friends: "VISITING_FAMILY_FRIENDS",
  cultural: "CULTURAL",
  sports: "SPORTS",
  official_visit: "OFFICIAL_VISIT",
  medical: "MEDICAL",
  study: "STUDY",
  airport_transit: "AIRPORT_TRANSIT",
  other: "OTHER",
} as const;

export type ItVfsPurposeKey = keyof typeof IT_VFS_PURPOSE_VALUES;
