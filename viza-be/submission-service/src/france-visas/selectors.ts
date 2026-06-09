/**
 * Common France-Visas selectors and URLs.
 *
 * France-Visas runs on two hosts:
 *   - connect.france-visas.gouv.fr — Keycloak auth (registration + login)
 *   - application-form.france-visas.gouv.fr — JSF app (dashboard + step1-12)
 *
 * JSF generates predictable but long ids like `j_idt42:inputName`, so
 * selectors match on id/name substrings rather than exact strings.
 * Every value tagged `TODO(walk)` must be confirmed against a live page.
 */

export const FV_URLS = {
  /**
   * Keycloak registration entry. The real URL the browser visits carries
   * `tab_id` + `client_data` query params that are session-scoped and must
   * be fetched fresh — consumers either start from the login URL and
   * follow the "Create account" link, or accept a caller-supplied URL.
   */
  REGISTRATION_BASE:
    "https://connect.france-visas.gouv.fr/realms/usager/login-actions/registration",

  /** Keycloak authenticate (login) surface. */
  LOGIN_BASE:
    "https://connect.france-visas.gouv.fr/realms/usager/login-actions/authenticate",

  /** Post-auth application dashboard. */
  ACCUEIL:
    "https://application-form.france-visas.gouv.fr/fv-fo-dde/accueil.xhtml",

  /** First step of the harmonized Schengen Type C form. */
  STEP1:
    "https://application-form.france-visas.gouv.fr/fv-fo-dde/step1.xhtml",
} as const;

/**
 * Keycloak registration form fields. Verified from live France-Visas DOM —
 * element `id` values are React-generated (`input-:r9:`, `:ra:`…) and unstable
 * across renders, so every selector targets the `name` attribute.
 */
export const FV_REGISTRATION_SELECTORS = {
  lastName: 'input[name="lastName"]',
  firstName: 'input[name="firstName"]',
  email: 'input[name="email"]',
  /**
   * Email-confirm is named `emailVerif` (not `email-confirmation`) in the
   * live France-Visas Keycloak theme — confirmed via DOM probe 2026-04-24.
   */
  emailConfirmation: 'input[name="emailVerif"]',
  password: 'input[name="password"]',
  passwordConfirm: 'input[name="password-confirm"]',
  /**
   * Custom ministry attribute — NOT Keycloak's built-in `user.attributes.locale`.
   * Option values are display text: "Français" / "English" / "Español".
   */
  languageSelect: 'select[name="ddeLanguage"]',
  /**
   * Captchetat (French state CAPTCHA system) renders a 200x70 PNG as an
   * inline data: URL on `#captchaImage`. Unlike CEAC's BotDetect, there is
   * no HTTP fetch — we read `src` directly and base64-decode.
   */
  captchaImage: '#captchaImage, img[alt*="Recopier" i]',
  captchaInput: 'input[name="captchaFormulaireExtInput"]',
  /**
   * Hidden UUID that ties the CAPTCHA image to the server-side validator.
   * MUST be preserved in the submit — extract its value before solving.
   */
  captchaUuidHidden: 'input[name="captchetat-uuid"]',
  /** Icon button that swaps in a fresh CAPTCHA (for wrong-answer retry). */
  captchaReload: '#reloadCaptchaIcon',
  /** Icon button that plays the audio alternative (accessibility). */
  captchaAudio: '#playSoundIcon',
  submit: 'button[type="submit"]',
} as const;

/** Language select option values (display text, not ISO codes). */
export const FV_LANGUAGE_OPTIONS = ["Français", "English", "Español"] as const;
export type FvLanguageOption = (typeof FV_LANGUAGE_OPTIONS)[number];

export const FV_LOGIN_SELECTORS = {
  email: 'input[name="username"], input[id="username"]',
  password: 'input[name="password"], input[id="password"]',
  submit: 'input[type="submit"], button[type="submit"]',
} as const;

export const FV_ACCUEIL_SELECTORS = {
  /** "Create a new application in a new group of applications" primary CTA. */
  createApplication:
    'a:has-text("Create a new application"), button:has-text("Create a new application")',
  applicationsList: '[id*="applicationsList" i], table[role="grid"]',
} as const;

/**
 * JSF step-page navigation controls. Button labels are localized — match
 * against English (EN) and French (FR) so the flow works regardless of
 * the applicant's chosen UI language.
 *
 * Observed on step1: the submit button starts as **"Verify"** (eligibility
 * check); after Verify succeeds it swaps to **"Next"**. The nav layer
 * accepts either as a "next" action.
 */
export const FV_NAV_SELECTORS = {
  next:
    'button:has-text("Next"), button:has-text("Suivant"), button:has-text("Verify"), button:has-text("Vérifier"), input[type="submit"][value*="Next"], input[type="submit"][value*="Suivant"]',
  back:
    'button:has-text("Back"), button:has-text("Précédent"), input[type="submit"][value*="Back"]',
  save:
    'button:has-text("Save"), button:has-text("Enregistrer"), input[type="submit"][value*="Save"]',
} as const;

/**
 * Step 1 field selectors — confirmed from the live France-Visas DOM on
 * 2026-04-24. JSF generates `formStep1:fieldName` naming; `_input` suffix
 * marks the native <select> wrapped by a PrimeFaces SelectOneMenu widget.
 *
 * All selects are cascading. Upstream changes rebuild downstream option
 * lists server-side via AJAX. Fill order (confirmed to cascade correctly):
 *   nationality → deposit-country → stayDuration → destination →
 *   deposit-town → authority → travel-document → purposeCategory → purpose.
 *
 * Text fields (passport number + dates) can be set at any time AFTER the
 * surrounding cascade has stabilized — earlier postbacks clear them.
 */
export const FV_STEP1_FIELDS = {
  nationality: {
    name: "formStep1:visas-selected-nationality_input",
    widget: "widget_formStep1_visas_selected_nationality",
    type: "select",
  },
  hasNationalFamily: {
    name: "formStep1:hasNationalFamily",
    widget: "widget_formStep1_hasNationalFamily",
    type: "radio",
  },
  depositCountry: {
    name: "formStep1:Visas-selected-deposit-country_input",
    widget: "widget_formStep1_Visas_selected_deposit_country",
    type: "select",
  },
  stayDuration: {
    name: "formStep1:Visas-selected-stayDuration_input",
    widget: "widget_formStep1_Visas_selected_stayDuration",
    type: "select",
  },
  destination: {
    name: "formStep1:Visas-selected-destination_input",
    widget: "widget_formStep1_Visas_selected_destination",
    type: "select",
  },
  depositTown: {
    name: "formStep1:Visas-selected-deposit-town_input",
    widget: "widget_formStep1_Visas_selected_deposit_town",
    type: "select",
  },
  authority: {
    name: "formStep1:Visas-selected-authority_input",
    widget: "widget_formStep1_Visas_selected_authority",
    type: "select",
  },
  travelDocument: {
    name: "formStep1:Visas-dde-travel-document_input",
    widget: "widget_formStep1_Visas_dde_travel_document",
    type: "select",
  },
  travelDocumentNumber: {
    name: "formStep1:Visas-dde-travel-document-number",
    type: "text",
    maxLength: 20,
  },
  releaseDate: {
    name: "formStep1:Visas-dde-release_date_real_input",
    type: "date",
    format: "dd/MM/yyyy",
  },
  expirationDate: {
    name: "formStep1:Visas-dde-expiration_date_input",
    type: "date",
    format: "dd/MM/yyyy",
  },
  purposeCategory: {
    name: "formStep1:Visas-selected-purposeCategory_input",
    widget: "widget_formStep1_Visas_selected_purposeCategory",
    type: "select",
  },
  purpose: {
    name: "formStep1:Visas-selected-purpose_input",
    widget: "widget_formStep1_Visas_selected_purpose",
    type: "select",
  },
} as const;

/** Visa-type values on step 1. Scope is `C` only; keep the union for
 *  defensive assertions. */
export const FV_VISA_TYPE_VALUES = ["C", "D", "A"] as const;
export type FvVisaType = (typeof FV_VISA_TYPE_VALUES)[number];

/** Purpose-category values observed for Short-stay + France + Chinese applicant. */
export const FV_PURPOSE_CATEGORY_VALUES = [
  "ETAR",   // Entry visa for beneficiary of the withdrawal agreement
  "VISF",   // Family or private visit
  "ETAC",   // Familial or private establishment
  "VOFF",   // Official visit
  "TRAV",   // Business
  "MEDI",   // Medical reasons
  "TOUR",   // Tourism
  "ETUD",   // Study
] as const;
export type FvPurposeCategory = (typeof FV_PURPOSE_CATEGORY_VALUES)[number];

/** Travel-document type values (Annex I field 11 domain). */
export const FV_TRAVEL_DOCUMENT_VALUES = [
  "10",   // Ordinary passport
  "30",   // Diplomatic passport
  "40",   // Service passport
  "152",  // Seafarer's identity certificate
  "310",  // Seafarer's passport
  "340",  // Passport for Public affairs
  "440",  // Travel document
  "490",  // Permit for entry
] as const;
export type FvTravelDocument = (typeof FV_TRAVEL_DOCUMENT_VALUES)[number];

/**
 * Step 2 "Your information" — confirmed via live walk 2026-04-24.
 * Personal identity, residence, occupation. The employer subsection is
 * CONDITIONALLY REVEALED by selecting most occupation values (e.g. Employee=69002).
 */
export const FV_STEP2_FIELDS = {
  sex: { name: "formStep2:DDE002_102_input", widget: "widget_formStep2_DDE002_102", type: "select" },          // F / M / X
  maritalStatus: { name: "formStep2:DDE002_104_input", widget: "widget_formStep2_DDE002_104", type: "select" }, // DIV/MAR/AUT/PAC/SEP/CEL/VEU
  surname: { name: "formStep2:visas-input-applicant-surname", type: "text", maxLength: 40 },
  surnameAtBirth: { name: "formStep2:visas-input-applicant-surnameAtBirth", type: "text", maxLength: 150 },
  firstnames: { name: "formStep2:visas-input-applicant-firstnames", type: "text", maxLength: 40 },
  dayOfBirth: { name: "formStep2:visas-input-applicant-dayOfBirth", type: "text", maxLength: 2 },
  monthOfBirth: { name: "formStep2:visas-input-applicant-monthOfBirth", type: "text", maxLength: 2 },
  yearOfBirth: { name: "formStep2:visas-input-applicant-yearOfBirth", type: "text", maxLength: 4 },
  placeOfBirth: { name: "formStep2:visas-input-applicant-placeOfBirth", type: "text", maxLength: 50 },
  countryOfBirth: { name: "formStep2:visas-selected-countryOfBirth_input", widget: "widget_formStep2_visas_selected_countryOfBirth", type: "select" },
  nationality: { name: "formStep2:visas-selected-nationality_input", widget: "widget_formStep2_visas_selected_nationality", type: "select" },
  idCardNumber: { name: "formStep2:visas-input-idcardNumber", type: "text", maxLength: 20 },
  nationalityOfBirth: { name: "formStep2:visas-selected-nationalityOfBirth_input", widget: "widget_formStep2_visas_selected_nationalityOfBirth", type: "select" },
  otherNationalities: { name: "formStep2:visas-select-otherNationalities", type: "checkbox-group" },
  street: { name: "formStep2:visas-input-applicant-street", type: "text", maxLength: 50 },
  zipcode: { name: "formStep2:visas-input-applicant-zipcode", type: "text", maxLength: 10 },
  place: { name: "formStep2:visas-input-applicant-place", type: "text", maxLength: 50 },
  country: { name: "formStep2:visas-selected-applicant-country_input", widget: "widget_formStep2_visas_selected_applicant_country", type: "select" },
  phoneNumber: { name: "formStep2:visas-input-applicant-phoneNumber", type: "text", maxLength: 20 },
  email: { name: "formStep2:visas-input-applicant-email", type: "text", maxLength: 70 },
  radioNotResident: { name: "formStep2:radioNotResident", type: "radio" },
  radioHasFrenchFamily: { name: "formStep2:radioHasFrenchFamily", type: "radio" },
  radioHasNationalFamily: { name: "formStep2:radioHasNationalFamily", type: "radio" },
  occupation: { name: "formStep2:visas-input-applicant-activity-occupation_input", widget: "widget_formStep2_visas_input_applicant_activity_occupation", type: "select" },
  // Conditional on occupation (reveals employer section):
  businessSegment: { name: "formStep2:visas-input-applicant-activity-businessSegment_input", widget: "widget_formStep2_visas_input_applicant_activity_businessSegment", type: "select", conditional: true },
  employerName: { name: "formStep2:visas-input-applicant-employer-name", type: "text", maxLength: 50, conditional: true },
  employerStreet: { name: "formStep2:visas-input-applicant-employer-street", type: "text", maxLength: 50, conditional: true },
  employerPlace: { name: "formStep2:visas-input-applicant-employer-place", type: "text", maxLength: 50, conditional: true },
  employerCountry: { name: "formStep2:visas-selected-applicant-employer-country_input", widget: "widget_formStep2_visas_selected_applicant_employer_country", type: "select", conditional: true },
  employerPhone: { name: "formStep2:visas-input-phoneNumber-employer", type: "text", maxLength: 20, conditional: true },
  employerEmail: { name: "formStep2:visas-input-email-employer", type: "text", maxLength: 70, conditional: true },
} as const;

/**
 * Step 3 "Your last visa". The gate radio is the only always-visible field.
 * Choosing Yes reveals the prior-visa date range + the fingerprints gate;
 * choosing Yes on fingerprints reveals the date + biometric-visa-number
 * fields. Schema confirmed via live walk 2026-04-24 (Yes-path).
 */
export const FV_STEP3_FIELDS = {
  haveOldSchengenVisas: { name: "formStep3:haveOldSchengenVisas", type: "radio" },
  // Revealed when haveOldSchengenVisas=Yes:
  validVisaStart: { name: "formStep3:valid-visa-start_input", type: "date", format: "dd/MM/yyyy", conditional: true },
  validVisaEnd: { name: "formStep3:valid-visa-end_input", type: "date", format: "dd/MM/yyyy", conditional: true },
  hasFingerPrints: { name: "formStep3:hasFingerPrints", type: "radio", conditional: true },
  // Revealed when hasFingerPrints=Yes:
  dateFingerprints: { name: "formStep3:date-fingerprints_real_input", type: "date", format: "dd/MM/yyyy", conditional: true },
  numVisaBiometrique: { name: "formStep3:num-visa-biometrique", type: "text", conditional: true },
} as const;

/** Step 4 "Your stay". Note: `applicant-country` here is NOT country of
 *  residence — it's number-of-entries (1 / M). Namespace is per-step. */
export const FV_STEP4_FIELDS = {
  radioHasSeveralDestination: { name: "formStep4:radioHasSeveralDestination", type: "radio" },
  dateOfArrival: { name: "formStep4:date-of-arrival_input", type: "date", format: "dd/MM/yyyy" },
  dateOfDeparture: { name: "formStep4:date-of-departure_input", type: "date", format: "dd/MM/yyyy" },
  numberOfDays: { name: "formStep4:visas-dde-number-days-travel", type: "text", maxLength: 5 },
  numberOfEntries: { name: "formStep4:visas-selected-applicant-country_input", widget: "widget_formStep4_visas_selected_applicant_country", type: "select" },  // 1 / M
  numberOfStays: { name: "formStep4:visas-input-applicant-numberOfStays_input", type: "text" },
  purposeCategory: { name: "formStep4:visas-selected-purposeCategory_input", widget: "widget_formStep4_visas_selected_purposeCategory", type: "select" },
} as const;

/** Funding-method values from step 5 cbxHasAutoFunding reveal. */
export const FV_AUTO_FUNDING_VALUES = {
  HPP: "Accommodation prepaid",
  TPP: "Transport costs prepaid",
  CHQ: "Traveller's cheques",
  CCR: "Credit card",
  ARG: "Cash",
  AUT: "Other",
} as const;
export type FvAutoFunding = keyof typeof FV_AUTO_FUNDING_VALUES;

/**
 * Step 5 "Your contacts". Heavy conditional reveals via checkboxes.
 * At least one of cbxHasHostPerson / cbxHasHostOrganization /
 * cbxHasPlaceOfApplication must be checked to pass validation.
 */
export const FV_STEP5_FIELDS = {
  // Toggle checkboxes
  cbxHasHostPerson: { name: "formStep5:cbxHasHostPerson_input", type: "checkbox" },
  cbxHasHostOrganization: { name: "formStep5:cbxHasHostOrganization_input", type: "checkbox" },
  cbxHasPlaceOfApplication: { name: "formStep5:cbxHasPlaceOfApplication_input", type: "checkbox" },
  cbxHasAutoFunding: { name: "formStep5:cbxHasAutoFunding_input", type: "checkbox" },
  cbxHasGuarantor: { name: "formStep5:cbxHasGuarantor_input", type: "checkbox" },
  // Revealed by cbxHasHostPerson
  hostPersonSurname: { name: "formStep5:visas-input-applicant-hostPerson-surname", type: "text", maxLength: 150, conditional: true },
  hostPersonFirstnames: { name: "formStep5:visas-input-applicant-hostPerson-firstnames", type: "text", maxLength: 150, conditional: true },
  hostPersonAddress: { name: "formStep5:visas-input-applicant-hostPerson-address", type: "text", maxLength: 50, conditional: true },
  hostPersonZipcode: { name: "formStep5:visas-input-applicant-hostPerson-zipcode", type: "text", maxLength: 10, conditional: true },
  hostPersonPlace: { name: "formStep5:visas-input-applicant-hostPerson-place", type: "text", maxLength: 50, conditional: true },
  hostPersonCountry: { name: "formStep5:visas-selected-hostPerson-country_input", widget: "widget_formStep5_visas_selected_hostPerson_country", type: "select", conditional: true },
  hostPersonPhone: { name: "formStep5:visas-input-applicant-hostPerson-phoneNumber", type: "text", maxLength: 20, conditional: true },
  hostPersonEmail: { name: "formStep5:visas-input-applicant-hostPerson-email", type: "text", maxLength: 70, conditional: true },
  // Revealed by cbxHasAutoFunding
  autoFundings: { name: "formStep5:autoFundings", type: "checkbox-group", conditional: true },
  // Always visible — representative (optional)
  representativeSurname: { name: "formStep5:visas-input-application-representative-surname", type: "text", maxLength: 40 },
  representativeFirstnames: { name: "formStep5:visas-input-application-representative-firstnames", type: "text", maxLength: 40 },
  representativeStreet: { name: "formStep5:visas-input-application-representative-street", type: "text", maxLength: 50 },
  representativeZipcode: { name: "formStep5:visas-input-application-representative-zipcode", type: "text", maxLength: 10 },
  representativePlace: { name: "formStep5:visas-input-application-representative-place", type: "text", maxLength: 50 },
  representativeCountry: { name: "formStep5:visas-input-application-representative-country_input", widget: "widget_formStep5_visas_input_application_representative_country", type: "select" },
  representativePhone: { name: "formStep5:visas-input-application-representative-phoneNumber", type: "text", maxLength: 20 },
  representativeEmail: { name: "formStep5:visas-input-application-representative-email", type: "text", maxLength: 70 },
} as const;

/**
 * Step 6 "Your supporting documents" is PURELY INFORMATIONAL — no form
 * fields, just a 6-section document checklist (pre-requisites, purpose of
 * travel, socio-professional status, funds, accommodation, travel health
 * insurance). Button is "Continue" → returns to accueil.xhtml dashboard.
 * The orchestrator should advance past step6 without attempting to fill.
 */
export const FV_STEP6_IS_INFORMATIONAL = true as const;

export const FV_VALIDATION_SUMMARY_SELECTOR =
  '.ui-messages-error, .alert-error, [role="alert"][class*="error"], .error-summary';

export const FV_FIELD_ERROR_SELECTOR =
  '.ui-message-error, .field-error, [class*="invalid-feedback"]';

export const FV_SESSION_EXPIRED_MARKERS: readonly RegExp[] = [
  /session (has )?expired/i,
  /session expirée/i,
  /votre session a expiré/i,
];

/**
 * Keycloak "Check mailbox" interstitial — shown immediately after a
 * successful registration submit, before the verification link is clicked.
 */
export const FV_CHECK_MAILBOX_MARKERS: readonly RegExp[] = [
  /check (your )?mailbox/i,
  /vérif(iez|ier) (votre )?(boîte|mail)/i,
  /you will receive confirmation of your account creation/i,
];

/**
 * Anti-bot / manual gates. The Keycloak image CAPTCHA is not solved by VIZA
 * in France live-assisted mode; account creation and CAPTCHA are manual
 * checkpoints.
 */
export const FV_GATE_MARKERS = {
  textPatterns: [
    /access denied/i,
    /accès refusé/i,
    /too many requests/i,
    /rate limit/i,
    /blocked/i,
    /attention required/i,
    /checking your browser/i,
  ] as readonly RegExp[],
  manualCaptchaSelectors: [
    FV_REGISTRATION_SELECTORS.captchaImage,
  ] as readonly string[],
  blockingCaptchaSelectors: [
    'iframe[src*="recaptcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="challenge"]',
    '#challenge-form',
    '.cf-browser-verification',
  ] as readonly string[],
} as const;
