import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type EgForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.eg";
// visa2egypt.gov.eg: Tourist e-Visa is capped at 30 days per visit (single
// OR multiple-entry — multi covers up to 180 days validity but each visit
// still tops out at 30).
const EG_EVISA_MAX_STAY_DAYS = 30;

// ---------------------------------------------------------------------------
// Field groups — mirror viza-be/agent-backend/scripts/seed-eg-e-visa-form-fields.ts
// (the authoritative Egypt e-Visa schema). The Egypt portal hides several
// fields behind conditional triggers (HAS_OTHER_NAMES, IS_MARRIED, etc.); the
// wizard surfaces all of them and lets users skip the irrelevant ones.
// ---------------------------------------------------------------------------

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "surname", labelKey: "fields.surname", required: true },
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", required: true },
  { kind: "yesno", key: "has_other_names_used", labelKey: "fields.hasOtherNamesUsed" },
  { kind: "text", key: "other_names_used", labelKey: "fields.otherNamesUsed" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "male", labelKey: "options.sex.male" },
    { value: "female", labelKey: "options.sex.female" },
  ] },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "text", key: "place_of_birth_city", labelKey: "fields.placeOfBirthCity" },
  { kind: "country", key: "place_of_birth_country", labelKey: "fields.placeOfBirthCountry" },
  { kind: "country", key: "nationality", labelKey: "fields.nationality" },
  { kind: "yesno", key: "has_other_nationalities", labelKey: "fields.hasOtherNationalities" },
  { kind: "country", key: "other_nationality", labelKey: "fields.otherNationality" },
  { kind: "text", key: "national_id_number", labelKey: "fields.nationalIdNumber" },
  { kind: "select", key: "marital_status", labelKey: "fields.maritalStatus", options: [
    { value: "single", labelKey: "options.marital.single" },
    { value: "married", labelKey: "options.marital.married" },
    { value: "divorced", labelKey: "options.marital.divorced" },
    { value: "widowed", labelKey: "options.marital.widowed" },
  ] },
  { kind: "text", key: "spouse_full_name", labelKey: "fields.spouseFullName" },
  { kind: "country", key: "spouse_nationality", labelKey: "fields.spouseNationality" },
  { kind: "text", key: "father_full_name", labelKey: "fields.fatherFullName", required: true },
  { kind: "text", key: "mother_full_name", labelKey: "fields.motherFullName", required: true },
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber", required: true },
  // Egypt e-Visa is locked to ordinary passports (Visa2Egypt Disclaimer #7).
  // Diplomatic / service / official / special holders must apply via embassy.
  { kind: "select", key: "passport_type", labelKey: "fields.passportType", options: [
    { value: "ordinary", labelKey: "options.passport.ordinary" },
  ] },
  { kind: "country", key: "passport_issuing_country", labelKey: "fields.passportIssuingCountry" },
  { kind: "text", key: "passport_place_of_issue", labelKey: "fields.passportPlaceOfIssue" },
  { kind: "date", key: "passport_issue_date", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "passport_expiry_date", labelKey: "fields.passportExpiryDate" },
  { kind: "yesno", key: "has_other_passports", labelKey: "fields.hasOtherPassports" },
  { kind: "text", key: "other_passport_number", labelKey: "fields.otherPassportNumber" },
  { kind: "country", key: "other_passport_country", labelKey: "fields.otherPassportCountry" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "text", key: "home_address_line1", labelKey: "fields.homeAddress" },
  { kind: "text", key: "home_address_city", labelKey: "fields.city" },
  { kind: "text", key: "home_address_state", labelKey: "fields.state" },
  { kind: "text", key: "home_address_postcode", labelKey: "fields.postalCode" },
  { kind: "country", key: "home_address_country", labelKey: "fields.countryOfResidence" },
  { kind: "phone", key: "telephone_number", labelKey: "fields.phone" },
  { kind: "phone", key: "mobile_number", labelKey: "fields.mobile" },
  { kind: "email", key: "email_address", labelKey: "fields.email" },
];

const OCCUPATION_FIELDS: GenericField[] = [
  { kind: "select", key: "current_profession", labelKey: "fields.currentProfession", options: [
    { value: "employed", labelKey: "options.occupation.employed" },
    { value: "self_employed", labelKey: "options.occupation.selfEmployed" },
    { value: "businessperson", labelKey: "options.occupation.businessperson" },
    { value: "student", labelKey: "options.occupation.student" },
    { value: "retired", labelKey: "options.occupation.retired" },
    { value: "homemaker", labelKey: "options.occupation.homemaker" },
    { value: "unemployed", labelKey: "options.occupation.unemployed" },
    { value: "other", labelKey: "options.occupation.other" },
  ] },
  { kind: "text", key: "position_title", labelKey: "fields.positionTitle" },
  { kind: "text", key: "employer_or_school_name", labelKey: "fields.employerOrSchool" },
  { kind: "text", key: "employer_or_school_address", labelKey: "fields.employerAddress" },
  { kind: "phone", key: "employer_or_school_phone", labelKey: "fields.employerPhone" },
];

// Egypt's trip step combines visa-type, dates, port, accommodation, and
// expense bearer. Annex I-style entry/exit dates aren't asked — only an
// arrival date plus intended length of stay (max 30 days).
const TRIP_FIELDS: GenericField[] = [
  { kind: "select", key: "visa_type_requested", labelKey: "fields.visaTypeRequested", options: [
    { value: "single", labelKey: "options.egVisa.single" },
    { value: "multiple", labelKey: "options.egVisa.multiple" },
  ] },
  // Tourist scope is locked — see seed-eg-e-visa-form-fields.ts. Other
  // purposes (business, transit, family, study) use the consular flow.
  { kind: "select", key: "purpose_of_visit", labelKey: "fields.purposeOfVisit", options: [
    { value: "tourism", labelKey: "options.purpose.tourism" },
  ] },
  { kind: "date", key: "intended_arrival_date", labelKey: "fields.intendedArrivalDate" },
  { kind: "text", key: "intended_length_of_stay", labelKey: "fields.intendedLengthOfStay" },
  { kind: "select", key: "port_of_entry", labelKey: "fields.portOfEntry", options: [
    { value: "cairo_intl_airport", labelKey: "options.egPort.cairo" },
    { value: "hurghada_intl_airport", labelKey: "options.egPort.hurghada" },
    { value: "sharm_el_sheikh_intl_airport", labelKey: "options.egPort.sharm" },
    { value: "luxor_intl_airport", labelKey: "options.egPort.luxor" },
    { value: "marsa_alam_intl_airport", labelKey: "options.egPort.marsaAlam" },
    { value: "alexandria_borg_el_arab_airport", labelKey: "options.egPort.alexAirport" },
    { value: "aswan_intl_airport", labelKey: "options.egPort.aswan" },
    { value: "alexandria_seaport", labelKey: "options.egPort.alexSeaport" },
    { value: "port_said_seaport", labelKey: "options.egPort.portSaid" },
    { value: "safaga_seaport", labelKey: "options.egPort.safaga" },
    { value: "other", labelKey: "options.egPort.other" },
  ] },
  { kind: "text", key: "port_of_entry_other", labelKey: "fields.portOfEntryOther" },
  { kind: "text", key: "carrier_name", labelKey: "fields.carrierName" },
  { kind: "select", key: "accommodation_type", labelKey: "fields.accommodationType", options: [
    { value: "hotel", labelKey: "options.egAccommodation.hotel" },
    { value: "resort", labelKey: "options.egAccommodation.resort" },
    { value: "rental_apartment", labelKey: "options.egAccommodation.rental" },
    { value: "host_residence", labelKey: "options.egAccommodation.host" },
    { value: "cruise_ship", labelKey: "options.egAccommodation.cruise" },
    { value: "other", labelKey: "options.egAccommodation.other" },
  ] },
  { kind: "text", key: "accommodation_name", labelKey: "fields.accommodationName" },
  { kind: "text", key: "accommodation_address", labelKey: "fields.accommodationAddress" },
  { kind: "text", key: "accommodation_city", labelKey: "fields.accommodationCity" },
  { kind: "phone", key: "accommodation_phone", labelKey: "fields.accommodationPhone" },
  { kind: "select", key: "expense_bearer", labelKey: "fields.expenseBearer", options: [
    { value: "self", labelKey: "options.egExpense.self" },
    { value: "employer", labelKey: "options.egExpense.employer" },
    { value: "family", labelKey: "options.egExpense.family" },
    { value: "host", labelKey: "options.egExpense.host" },
    { value: "other", labelKey: "options.egExpense.other" },
  ] },
];

const HOST_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_host_in_egypt", labelKey: "fields.hasHostInEgypt" },
  { kind: "text", key: "host_full_name", labelKey: "fields.hostFullName" },
  { kind: "text", key: "host_relationship_to_applicant", labelKey: "fields.hostRelationship" },
  { kind: "text", key: "host_address", labelKey: "fields.hostAddress" },
  { kind: "phone", key: "host_phone", labelKey: "fields.hostPhone" },
  { kind: "country", key: "host_nationality", labelKey: "fields.hostNationality" },
];

const TRAVEL_HISTORY_FIELDS: GenericField[] = [
  { kind: "yesno", key: "visited_egypt_before", labelKey: "fields.visitedEgyptBefore" },
  { kind: "date", key: "prior_egypt_visit_arrival_date", labelKey: "fields.priorVisitArrival" },
  { kind: "date", key: "prior_egypt_visit_departure_date", labelKey: "fields.priorVisitDeparture" },
  { kind: "text", key: "prior_egypt_visit_purpose", labelKey: "fields.priorVisitPurpose" },
  { kind: "yesno", key: "refused_visa_or_entry_egypt", labelKey: "fields.refusedVisaEgypt" },
  { kind: "text", key: "refused_visa_egypt_details", labelKey: "fields.refusedVisaEgyptDetails" },
  { kind: "yesno", key: "refused_visa_other_country", labelKey: "fields.refusedVisaOtherCountry" },
  { kind: "text", key: "refused_visa_other_country_details", labelKey: "fields.refusedVisaOtherDetails" },
];

// Character + declaration shipped together. The portal collects the four
// security/criminal questions plus the final agreement on a single page.
const DECLARATION_ITEMS: ChecklistItem[] = [
  { key: "has_criminal_record", labelKey: "declarations.hasCriminalRecord", explainOnYes: true },
  { key: "has_been_deported", labelKey: "declarations.hasBeenDeported", explainOnYes: true },
  { key: "has_terrorism_or_security_history", labelKey: "declarations.terrorismOrSecurity", explainOnYes: true },
  { key: "final_declaration", labelKey: "declarations.finalDeclaration" },
];

// ---------------------------------------------------------------------------

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  occupation: OCCUPATION_FIELDS,
  trip: TRIP_FIELDS,
  host: HOST_FIELDS,
  travel_history: TRAVEL_HISTORY_FIELDS,
};

const DECLARATION_KEYS = DECLARATION_ITEMS.map((i) => i.key).concat([
  "criminal_record_details",
  "deportation_details",
  "remarks_special_circumstances",
  "application_date",
]);

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: EgForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: EgForm): WizardReviewSection[] {
  return [
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.occupation", editStepKey: "occupation", rows: fieldRows(form, OCCUPATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.trip", editStepKey: "trip", rows: fieldRows(form, TRIP_FIELDS.map((f) => f.key)) },
    { titleKey: "review.host", editStepKey: "host", rows: fieldRows(form, HOST_FIELDS.map((f) => f.key)) },
    { titleKey: "review.travelHistory", editStepKey: "travel_history", rows: fieldRows(form, TRAVEL_HISTORY_FIELDS.map((f) => f.key)) },
    { titleKey: "review.declaration", editStepKey: "declaration", rows: fieldRows(form, DECLARATION_KEYS) },
  ];
}

function buildPayload(form: EgForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

function genericStep(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: EgForm; setForm: (u: (p: EgForm) => EgForm) => void; onContinue: () => void }) =>
      createElement(StepGenericFields, {
        i18nNamespace: NAMESPACE,
        titleKey: `steps.${key}.title`,
        subtitleKey: `steps.${key}.subtitle`,
        fields: STEP_FIELD_MAP[fieldsKey],
        values: form,
        onChange: (next) => setForm(() => next),
        onContinue,
      }),
  };
}

void EG_EVISA_MAX_STAY_DAYS; // exported via labelKeys / hint text in i18n; kept for parity with other configs.

export const egConfig: WizardConfig<EgForm> = {
  visaType: "EG_E_VISA",
  defaultCountry: "egypt",
  defaultVisaType: "EG_E_VISA",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  seedAuthEmail: (form, email) => ({ ...form, email_address: form.email_address || email }),
  reviewSections,
  steps: [
    genericStep("personal", "personal"),
    genericStep("passport", "passport"),
    genericStep("contact", "contact"),
    genericStep("occupation", "occupation"),
    genericStep("trip", "trip"),
    genericStep("host", "host"),
    genericStep("travel_history", "travel_history"),
    {
      key: "declaration",
      titleKey: "steps.declaration.label",
      render: ({ form, setForm, onContinue }) =>
        createElement(StepYesNoChecklist, {
          i18nNamespace: NAMESPACE,
          titleKey: "steps.declaration.title",
          subtitleKey: "steps.declaration.subtitle",
          items: DECLARATION_ITEMS,
          values: form,
          onChange: (next) => setForm(() => next),
          onContinue,
        }),
    },
  ],
};
