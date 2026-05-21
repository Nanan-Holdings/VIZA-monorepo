/**
 * Stable form-field selectors for the Subclass 600 ImmiAccount online
 * application (`VSS-AP-600`), captured during the live walk on
 * 2026-04-27.
 *
 * The form uses ASP.NET-style hierarchical control names of the shape
 * `_2a0b0a0a0e0a0aXaYZ...` where X = page index (2 = page 2/Application
 * context, 3 = page 3/Primary applicant, etc.). Names are stable across
 * sessions and across applicants — they encode the form's logical
 * tree, not session state.
 *
 * Each selector group tracks the per-page filler in `orchestrator.ts`.
 */

// --- Global / chrome ---
export const NAV_BUTTONS = {
  next: "#_2a0b0a0a0g1",
  previous: "#_2a0b0a0a0g0",
  save: "#_2a0b0a0a0g2",
  print: "#_2a0b0a0a0g3",
  goToMyAccount: "#_2a0b0a0a0g4",
} as const;

/**
 * Cross-section "Confirm" modal that appears after some Next clicks
 * (e.g. when contacting overseas, sponsored stream selected).
 */
export const CONFIRM_MODAL = {
  confirm: "#_2a0b0a0a2-dlg-_0b0",
  cancel: "#_2a0b0a0a2-dlg-_0b1",
} as const;

// --- Page 1: Terms & Conditions ---
export const TERMS_FIELDS = {
  agree: 'input[name="_2a0b0a0a0e0a0a0a5a1a"]',
} as const;

// --- Page 2: Application context ---
export const CONTEXT_FIELDS = {
  outsideAustralia: '_2a0b0a0a0e0a0a1a2c1b0',
  allOutsideAustralia: '_2a0b0a0a0e0a0a1a2d1b0a',
  currentLocation: '_2a0b0a0a0e0a0a1a2e3a1a',
  legalStatus: '_2a0b0a0a0e0a0a1a2e4a1a',
  eventInvited: '_2a0b0a0a0e0a0a1a3c1b0',
  eventPaid: '_2a0b0a0a0e0a0a1a3d1b0',
  specialisedWork: '_2a0b0a0a0e0a0a1a3e1b0',
  entertainer: '_2a0b0a0a0e0a0a1a3f1b0',
  productionDirector: '_2a0b0a0a0e0a0a1a3g1b0',
  stream: '_2a0b0a0a0e0a0a1a3i1b0',
  initialPurpose: '_2a0b0a0a0e0a0a1a3bc0b0a',
  significantDates: '_2a0b0a0a0e0a0a1a3bd1b0',
  groupApplication: '_2a0b0a0a0e0a0a1a4c1b0',
  exemptGroup: '_2a0b0a0a0e0a0a1a7d1b0',
} as const;

// Mapping of stream value (seed schema) → live form radio value.
export const STREAM_VALUE_MAP: Record<string, string> = {
  business_visitor: "27", // observed live values may vary by build; verify before use
  frequent_traveller: "28",
  sponsored_family: "30",
  tourist: "29",
};

// --- Page 3: Primary applicant ---
export const APPLICANT_FIELDS = {
  familyName: '_2a0b0a0a0e0a0a2a6b1a1a0',
  givenNames: '_2a0b0a0a0e0a0a2a6b2a1a0',
  sex: '_2a0b0a0a0e0a0a2a6c0b0',
  dateOfBirth: '_2a0b0a0a0e0a0a2a6d0b0',
  passportNumber: '_2a0b0a0a0e0a0a2a7b0b0',
  passportCountry: '_2a0b0a0a0e0a0a2a7c0b0',
  passportNationality: '_2a0b0a0a0e0a0a2a7d0b0',
  passportDateOfIssue: '_2a0b0a0a0e0a0a2a7e0b0',
  passportDateOfExpiry: '_2a0b0a0a0e0a0a2a7f0b0',
  // Place of issue: SELECT (province codes) for PRC passport, free
  // text for non-PRC. Both use the same control name; check the tag at
  // runtime.
  passportPlaceOfIssue: '_2a0b0a0a0e0a0a2a7g0b0a',
  passportPlaceOfIssueFreeText: '_2a0b0a0a0e0a0a2a7h0b0',
  hasNationalId: '_2a0b0a0a0e0a0a2a9c1b0a',
  nationalIdReason: '_2a0b0a0a0e0a0a2a9f1b0',
  pacificAustraliaCardHolder: '_2a0b0a0a0e0a0a2a10d1b0',
  bornCity: '_2a0b0a0a0e0a0a2a11c0b0',
  bornState: '_2a0b0a0a0e0a0a2a11d0b0',
  bornCountry: '_2a0b0a0a0e0a0a2a11e0b0a',
  relationshipStatus: '_2a0b0a0a0e0a0a2a13c0b0a',
  hasOtherNames: '_2a0b0a0a0e0a0a2a14c1b0a',
  // Other Yes/No questions on this page (alias / dual nationality /
  // additional passport / former Australian) live under 15c, 15d, 15g,
  // 15h, 16c, 16d, 16e, 17c, 18c, 20c — fill defensively to "No" via
  // the orchestrator's "No-by-default" pass.
  chineseCommercialCode: '_2a0b0a0a0e0a0a2a19c0b0a',
} as const;

// Sex enum values observed live: "1"=Female, "2"=Male, "3"=Other
export const SEX_VALUE_MAP: Record<string, string> = {
  female: "1",
  male: "2",
  other: "3",
  indeterminate: "3",
};

// --- Page 4: Critical data confirmation ---
export const CRITICAL_CONFIRM_FIELDS = {
  isCorrect: '_2a0b0a0a0e0a0a3a10a1a0',
} as const;

// --- Page 5: Travelling companions ---
export const TRAVELLING_FIELDS = {
  travellingWithParentOrGuardian: '_2a0b0a0a0e0a0a4a4b1a0',
  // Reason if no parent (textarea, conditional)
  reasonNoParent: '_2a0b0a0a0e0a0a4a4d0b0',
  // Other persons travelling
  otherPersonsTravelling: '_2a0b0a0a0e0a0a4a5b1a0',
} as const;

// --- Page 6: Contact details ---
export const CONTACT_FIELDS = {
  countryOfResidence: '_2a0b0a0a0e0a0a5a2c0b0a',
  departmentOffice: '_2a0b0a0a0e0a0a5a3e0b0a',
  // Office picker is a typeahead (wc-suggestions). Selection requires
  // clicking the option, not typing.
  departmentOfficeListId: '_2a0b0a0a0e0a0a5a3e0b0b',
  addressCountry: '_2a0b0a0a0e0a0a5a4d0b0',
  addressLine1: '_2a0b0a0a0e0a0a5a4e0b0a',
  addressLine2: '_2a0b0a0a0e0a0a5a4f0b0',
  suburb: '_2a0b0a0a0e0a0a5a4h1a1a',
  // State/province text variant (non-PRC)
  stateText: '_2a0b0a0a0e0a0a5a4h2a0b0',
  // State/province select variant (PRC and other countries with
  // structured province lists)
  stateSelect: '_2a0b0a0a0e0a0a5a4h2b0b0',
  postalCode: '_2a0b0a0a0e0a0a5a4h3a1a',
  homePhone: '_2a0b0a0a0e0a0a5a5d0b0',
  businessPhone: '_2a0b0a0a0e0a0a5a5e0b0',
  mobilePhone: '_2a0b0a0a0e0a0a5a5f0b0',
  postalSameAsResidential: '_2a0b0a0a0e0a0a5a6c1b0a',
  email: '_2a0b0a0a0e0a0a5a7c0b0a',
} as const;

// --- Page 7: Authorised recipient ---
export const AUTHORISED_RECIPIENT_FIELDS = {
  recipientType: '_2a0b0a0a0e0a0a6a2b1a',
  // Conditional secondary email always required
  electronicEmail: '_2a0b0a0a0e0a0a6a5d0b0a',
} as const;

// --- Page 8: Non-accompanying family ---
export const NON_ACCOMPANYING_FIELDS = {
  hasNonAccompanyingFamily: '_2a0b0a0a0e0a0a7a2b1a0',
} as const;

// --- Page 9: Entry to Australia ---
export const ENTRY_FIELDS = {
  visaValidSixYears: '_2a0b0a0a0e0a0a8a3c1b0',
  lengthOfStay: '_2a0b0a0a0e0a0a8a3f0b0',
  plannedArrivalDate: '_2a0b0a0a0e0a0a8a3g0b0',
  plannedDepartureDate: '_2a0b0a0a0e0a0a8a3h0b0',
  studyInAustralia: '_2a0b0a0a0e0a0a8a5c1b0',
  visitFriendsRelatives: '_2a0b0a0a0e0a0a8a6c1b0',
} as const;

// Length-of-stay enum (live values)
export const LENGTH_OF_STAY_MAP: Record<string, string> = {
  "3_months": "3",
  "6_months": "6",
  "12_months": "12",
};

// --- Page 11: Current overseas employment ---
export const EMPLOYMENT_FIELDS = {
  employmentStatus: '_2a0b0a0a0e0a0a10a2c0b0',
  // Unemployment branch
  unemployedDateFrom: '_2a0b0a0a0e0a0a10a5e0b0',
  unemployedLastPosition: '_2a0b0a0a0e0a0a10a5f0b0',
} as const;

// Employment-status enum (live values)
export const EMPLOYMENT_STATUS_MAP: Record<string, string> = {
  employed: "1",
  self_employed: "2",
  unemployed: "3",
  retired: "4",
  student: "5",
  other: "6",
};

// --- Page 12: Financial support ---
export const FINANCIAL_FIELDS = {
  fundingSource: '_2a0b0a0a0e0a0a11a2e1b0',
  fundsAvailableDescription: '_2a0b0a0a0e0a0a11a2g0b0a',
} as const;

// --- Page 16: Health declarations ---
export const HEALTH_FIELDS = {
  livedOutsideCountry5y3mo: '_2a0b0a0a0e0a0a15a2b1a',
  hospitalOrHealthFacility: '_2a0b0a0a0e0a0a15a4b1a',
  healthcareWorkerOrTrainee: '_2a0b0a0a0e0a0a15a6b1a',
  agedCareOrDisabilityWork: '_2a0b0a0a0e0a0a15a8b1a',
  childcareWork: '_2a0b0a0a0e0a0a15a15a1a',
  classroomMore3Months: '_2a0b0a0a0e0a0a15a18a1a',
  tbOrAbnormalChestXray: '_2a0b0a0a0e0a0a15a20b1a0',
} as const;

// --- Page 17: Character declarations (18 questions) ---
export const CHARACTER_FIELDS = {
  awaitingLegalAction: '_2a0b0a0a0e0a0a16a4b1a',
  convicted: '_2a0b0a0a0e0a0a16a6b1a',
  domesticViolenceOrder: '_2a0b0a0a0e0a0a16a8b1a0',
  arrestWarrantOrInterpol: '_2a0b0a0a0e0a0a16a10b1b0',
  sexualOffenceChild: '_2a0b0a0a0e0a0a16a11b1b0',
  sexOffenderRegister: '_2a0b0a0a0e0a0a16a12b1b0',
  acquittedInsanity: '_2a0b0a0a0e0a0a16a13b1b0',
  notFitToPlead: '_2a0b0a0a0e0a0a16a14b1b0',
  nationalSecurityRisk: '_2a0b0a0a0e0a0a16a15b1b0',
  warCrimes: '_2a0b0a0a0e0a0a16a16b1b0',
  associatedCriminalConduct: '_2a0b0a0a0e0a0a16a17b1b0',
  associatedViolence: '_2a0b0a0a0e0a0a16a18b1b0',
  militaryService: '_2a0b0a0a0e0a0a16a19b1a',
  militaryTraining: '_2a0b0a0a0e0a0a16a21b1a',
  peopleSmuggling: '_2a0b0a0a0e0a0a16a23b1b0',
  removedDeported: '_2a0b0a0a0e0a0a16a24b1b0',
  overstayedAnywhere: '_2a0b0a0a0e0a0a16a25b1b0',
  // 26b1b0 is the final character question (varies by build).
  finalCharacterCheck: '_2a0b0a0a0e0a0a16a26b1b0',
} as const;

// --- Page 18: Visa history ---
export const VISA_HISTORY_FIELDS = {
  heldOrHoldsVisaAnywhere: '_2a0b0a0a0e0a0a17a1b1a',
  notCompliedOrOverstayed: '_2a0b0a0a0e0a0a17a3b1a',
  refusedOrCancelledAnywhere: '_2a0b0a0a0e0a0a17a5b1a',
} as const;

// --- Page 20: Declarations (16 attestation Yes/No radios) ---
export const DECLARATION_FIELDS = {
  readUnderstoodInformation: '_2a0b0a0a0e0a0a19a1f1b0',
  completeAndCorrect: '_2a0b0a0a0e0a0a19a1g1b0',
  fraudConsequences: '_2a0b0a0a0e0a0a19a1h1b0',
  postGrantCancellation: '_2a0b0a0a0e0a0a19a1i1b0',
  noAutomaticEntry: '_2a0b0a0a0e0a0a19a1ba1b0',
  notifyChangesEnRoute: '_2a0b0a0a0e0a0a19a1bd0b0',
  notifyAddressChange: '_2a0b0a0a0e0a0a19a1bf0b0',
  privacyNoticeRead: '_2a0b0a0a0e0a0a19a2a1b0',
  privacyConsent: '_2a0b0a0a0e0a0a19a3a1b0',
  noFurtherStay8503: '_2a0b0a0a0e0a0a19a4a1b0',
  studyLimitAgreed: '_2a0b0a0a0e0a0a19a5a1b0',
  departOnTimeAgreed: '_2a0b0a0a0e0a0a19a6b1b0',
  fingerprintFacialConsent: '_2a0b0a0a0e0a0a19a7a1b0',
  biometricCollectionAware: '_2a0b0a0a0e0a0a19a8b1a',
  lawEnforcementDisclosure: '_2a0b0a0a0e0a0a19a9a1b0',
  visitorNoWork: '_2a0b0a0a0e0a0a19a10c1b0',
} as const;

// --- Validation messages we recognise ---
export const VALIDATION_MARKERS = {
  nationalityIneligible: /not eligible to apply using this online service/i,
  fieldRequired: /is a required field/i,
  invalidDate: /is invalid/i,
  phoneNoSpaces: /Telephone number can only contain numbers/i,
} as const;
