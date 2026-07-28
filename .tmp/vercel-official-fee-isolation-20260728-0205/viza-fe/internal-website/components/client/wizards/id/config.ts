import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import { StepYesNoChecklist, type ChecklistItem } from "../shell/shared-steps/step-yesno-checklist";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type IdForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.id";
// evisa.imigrasi.go.id C1 Tourist: 60-day max stay, single entry.
const ID_C1_MAX_STAY_DAYS = 60;

// ---------------------------------------------------------------------------
// Field groups — mirror viza-be/agent-backend/scripts/seed-id-c1-tourist-form-fields.ts
// (the authoritative Indonesia C1 schema reconstructed from the public eVisa
// portal). Conditional fields are flattened onto each step; the user skips
// irrelevant ones.
// ---------------------------------------------------------------------------

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "surname", labelKey: "fields.surname", required: true },
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", required: true },
  { kind: "yesno", key: "has_other_names_used", labelKey: "fields.hasOtherNamesUsed" },
  { kind: "text", key: "other_names_used", labelKey: "fields.otherNamesUsed" },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "male", labelKey: "options.sex.male" },
    { value: "female", labelKey: "options.sex.female" },
  ] },
  { kind: "text", key: "place_of_birth_city", labelKey: "fields.placeOfBirthCity" },
  { kind: "country", key: "place_of_birth_country", labelKey: "fields.placeOfBirthCountry" },
  { kind: "country", key: "nationality", labelKey: "fields.nationality" },
  { kind: "yesno", key: "has_other_nationalities", labelKey: "fields.hasOtherNationalities" },
  { kind: "country", key: "other_nationality", labelKey: "fields.otherNationality" },
  { kind: "text", key: "id_card_number", labelKey: "fields.idCardNumber" },
  // Mother's name is a hard requirement on the eVisa registration form.
  { kind: "text", key: "mother_full_name", labelKey: "fields.motherFullName", required: true },
  { kind: "select", key: "marital_status", labelKey: "fields.maritalStatus", options: [
    { value: "single", labelKey: "options.marital.single" },
    { value: "married", labelKey: "options.marital.married" },
    { value: "divorced", labelKey: "options.marital.divorced" },
    { value: "widowed", labelKey: "options.marital.widowed" },
  ] },
  { kind: "text", key: "spouse_full_name", labelKey: "fields.spouseFullName" },
  { kind: "date", key: "spouse_date_of_birth", labelKey: "fields.spouseDob" },
  { kind: "country", key: "spouse_nationality", labelKey: "fields.spouseNationality" },
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber", required: true },
  { kind: "select", key: "passport_type", labelKey: "fields.passportType", options: [
    { value: "ordinary", labelKey: "options.passport.ordinary" },
    { value: "diplomatic", labelKey: "options.passport.diplomatic" },
    { value: "official", labelKey: "options.passport.official" },
    { value: "travel_document", labelKey: "options.passport.travelDocument" },
    { value: "other", labelKey: "options.passport.other" },
  ] },
  { kind: "country", key: "passport_country", labelKey: "fields.passportIssuingCountry" },
  { kind: "date", key: "passport_issue_date", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "passport_expiry_date", labelKey: "fields.passportExpiryDate" },
  { kind: "text", key: "passport_place_of_issue", labelKey: "fields.passportPlaceOfIssue" },
  { kind: "text", key: "passport_issuing_authority", labelKey: "fields.passportIssuingAuthority" },
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
    { value: "student", labelKey: "options.occupation.student" },
    { value: "retired", labelKey: "options.occupation.retired" },
    { value: "housewife", labelKey: "options.occupation.housewife" },
    { value: "unemployed", labelKey: "options.occupation.unemployed" },
    { value: "other", labelKey: "options.occupation.other" },
  ] },
  { kind: "text", key: "position_title", labelKey: "fields.positionTitle" },
  { kind: "text", key: "employer_or_school_name", labelKey: "fields.employerOrSchool" },
  { kind: "text", key: "employer_or_school_address", labelKey: "fields.employerAddress" },
  { kind: "phone", key: "employer_or_school_phone", labelKey: "fields.employerPhone" },
];

// C1 Tourist: purpose locked to tourism. Other Indonesia visit categories
// (business, government, family, medical) belong on future packages.
const TRIP_FIELDS: GenericField[] = [
  { kind: "select", key: "purpose_of_visit", labelKey: "fields.purposeOfVisit", options: [
    { value: "tourism", labelKey: "options.purpose.tourism" },
  ] },
  { kind: "date", key: "intended_arrival_date", labelKey: "fields.intendedArrivalDate" },
  { kind: "text", key: "intended_length_of_stay", labelKey: "fields.intendedLengthOfStay" },
  { kind: "text", key: "port_of_entry", labelKey: "fields.portOfEntry" },
  { kind: "text", key: "carrier_name", labelKey: "fields.carrierName" },
  { kind: "text", key: "flight_or_voyage_number", labelKey: "fields.flightOrVoyageNumber" },
  { kind: "select", key: "accommodation_type", labelKey: "fields.accommodationType", options: [
    { value: "hotel", labelKey: "options.idAccommodation.hotel" },
    { value: "villa", labelKey: "options.idAccommodation.villa" },
    { value: "friend_or_relative", labelKey: "options.idAccommodation.friend" },
    { value: "other", labelKey: "options.idAccommodation.other" },
  ] },
  { kind: "text", key: "accommodation_name", labelKey: "fields.accommodationName" },
  { kind: "text", key: "accommodation_address", labelKey: "fields.accommodationAddress" },
  { kind: "text", key: "accommodation_city_or_district", labelKey: "fields.accommodationCity" },
  { kind: "phone", key: "accommodation_phone", labelKey: "fields.accommodationPhone" },
  { kind: "select", key: "expense_bearer", labelKey: "fields.expenseBearer", options: [
    { value: "self", labelKey: "options.idExpense.self" },
    { value: "employer", labelKey: "options.idExpense.employer" },
    { value: "sponsor", labelKey: "options.idExpense.sponsor" },
    { value: "family", labelKey: "options.idExpense.family" },
    { value: "other", labelKey: "options.idExpense.other" },
  ] },
];

const SPONSOR_FIELDS: GenericField[] = [
  { kind: "yesno", key: "has_sponsor_in_indonesia", labelKey: "fields.hasSponsorInIndonesia" },
  { kind: "select", key: "sponsor_type", labelKey: "fields.sponsorType", options: [
    { value: "individual", labelKey: "options.sponsorType.individual" },
    { value: "corporate", labelKey: "options.sponsorType.corporate" },
  ] },
  { kind: "text", key: "sponsor_individual_full_name", labelKey: "fields.sponsorIndividualFullName" },
  { kind: "text", key: "sponsor_individual_nik", labelKey: "fields.sponsorIndividualNik" },
  { kind: "text", key: "sponsor_individual_relationship", labelKey: "fields.sponsorIndividualRelationship" },
  { kind: "text", key: "sponsor_corporate_name", labelKey: "fields.sponsorCorporateName" },
  { kind: "text", key: "sponsor_corporate_nib", labelKey: "fields.sponsorCorporateNib" },
  { kind: "text", key: "sponsor_corporate_npwp", labelKey: "fields.sponsorCorporateNpwp" },
  { kind: "text", key: "sponsor_corporate_pic_name", labelKey: "fields.sponsorCorporatePicName" },
  { kind: "text", key: "sponsor_address", labelKey: "fields.sponsorAddress" },
  { kind: "phone", key: "sponsor_phone", labelKey: "fields.sponsorPhone" },
  { kind: "email", key: "sponsor_email", labelKey: "fields.sponsorEmail" },
];

const TRAVEL_HISTORY_FIELDS: GenericField[] = [
  { kind: "yesno", key: "visited_indonesia_before", labelKey: "fields.visitedIndonesiaBefore" },
  { kind: "date", key: "prior_indonesia_visit_arrival_date", labelKey: "fields.priorVisitArrival" },
  { kind: "date", key: "prior_indonesia_visit_departure_date", labelKey: "fields.priorVisitDeparture" },
  { kind: "text", key: "prior_indonesia_visit_purpose", labelKey: "fields.priorVisitPurpose" },
  { kind: "text", key: "prior_indonesia_visit_visa_type", labelKey: "fields.priorVisitVisaType" },
  { kind: "yesno", key: "refused_visa_or_entry_indonesia", labelKey: "fields.refusedVisaIndonesia" },
  { kind: "text", key: "refused_visa_indonesia_details", labelKey: "fields.refusedVisaIndonesiaDetails" },
  { kind: "yesno", key: "refused_visa_other_country", labelKey: "fields.refusedVisaOtherCountry" },
  { kind: "text", key: "refused_visa_other_country_details", labelKey: "fields.refusedVisaOtherDetails" },
];

// 4 yes/no character questions + 1 final declaration acknowledgement.
const DECLARATION_ITEMS: ChecklistItem[] = [
  { key: "has_criminal_record", labelKey: "declarations.hasCriminalRecord", explainOnYes: true },
  { key: "has_been_deported", labelKey: "declarations.hasBeenDeported", explainOnYes: true },
  { key: "has_overstayed_indonesia", labelKey: "declarations.hasOverstayedIndonesia", explainOnYes: true },
  { key: "has_drug_or_trafficking_history", labelKey: "declarations.hasDrugOrTrafficking", explainOnYes: true },
  { key: "final_declaration", labelKey: "declarations.finalDeclaration" },
];

// ---------------------------------------------------------------------------

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  occupation: OCCUPATION_FIELDS,
  trip: TRIP_FIELDS,
  sponsor: SPONSOR_FIELDS,
  travel_history: TRAVEL_HISTORY_FIELDS,
};

const DECLARATION_KEYS = DECLARATION_ITEMS.map((i) => i.key).concat([
  "criminal_record_details",
  "deportation_details",
  "overstay_details",
  "remarks_special_circumstances",
  "application_date",
]);

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: IdForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: IdForm): WizardReviewSection[] {
  return [
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.passport", editStepKey: "passport", rows: fieldRows(form, PASSPORT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.occupation", editStepKey: "occupation", rows: fieldRows(form, OCCUPATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.trip", editStepKey: "trip", rows: fieldRows(form, TRIP_FIELDS.map((f) => f.key)) },
    { titleKey: "review.sponsor", editStepKey: "sponsor", rows: fieldRows(form, SPONSOR_FIELDS.map((f) => f.key)) },
    { titleKey: "review.travelHistory", editStepKey: "travel_history", rows: fieldRows(form, TRAVEL_HISTORY_FIELDS.map((f) => f.key)) },
    { titleKey: "review.declaration", editStepKey: "declaration", rows: fieldRows(form, DECLARATION_KEYS) },
  ];
}

function buildPayload(form: IdForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

function genericStep(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: IdForm; setForm: (u: (p: IdForm) => IdForm) => void; onContinue: () => void }) =>
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

void ID_C1_MAX_STAY_DAYS; // surfaced via labelKeys in i18n; kept for parity with other configs.

export const idConfig: WizardConfig<IdForm> = {
  visaType: "ID_C1_TOURIST",
  defaultCountry: "indonesia",
  defaultVisaType: "ID_C1_TOURIST",
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
    genericStep("sponsor", "sponsor"),
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
