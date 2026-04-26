import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type SchengenForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.schengen";

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "surname", labelKey: "fields.surname", required: true },
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", required: true },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "text", key: "place_of_birth", labelKey: "fields.placeOfBirth" },
  { kind: "country", key: "country_of_birth", labelKey: "fields.countryOfBirth" },
  { kind: "country", key: "current_nationality", labelKey: "fields.nationality" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "M", labelKey: "options.sex.male" },
    { value: "F", labelKey: "options.sex.female" },
  ] },
  { kind: "select", key: "civil_status", labelKey: "fields.civilStatus", options: [
    { value: "single", labelKey: "options.civil.single" },
    { value: "married", labelKey: "options.civil.married" },
    { value: "separated", labelKey: "options.civil.separated" },
    { value: "divorced", labelKey: "options.civil.divorced" },
    { value: "widowed", labelKey: "options.civil.widowed" },
  ] },
];

const TRAVEL_DOC_FIELDS: GenericField[] = [
  { kind: "select", key: "type_of_travel_document", labelKey: "fields.passportType", options: [
    { value: "ordinary", labelKey: "options.passport.ordinary" },
    { value: "diplomatic", labelKey: "options.passport.diplomatic" },
    { value: "service", labelKey: "options.passport.service" },
    { value: "official", labelKey: "options.passport.official" },
    { value: "special", labelKey: "options.passport.special" },
    { value: "other", labelKey: "options.passport.other" },
  ] },
  { kind: "text", key: "travel_document_number", labelKey: "fields.passportNumber" },
  { kind: "date", key: "date_of_issue", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "valid_until", labelKey: "fields.passportExpiryDate" },
  { kind: "country", key: "issued_by_country", labelKey: "fields.passportIssuingCountry" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "text", key: "applicants_home_address", labelKey: "fields.homeAddress" },
  { kind: "email", key: "applicants_email", labelKey: "fields.email" },
  { kind: "phone", key: "applicants_phone", labelKey: "fields.phone" },
  { kind: "country", key: "country_of_residence", labelKey: "fields.countryOfResidence" },
];

const TRIP_FIELDS: GenericField[] = [
  { kind: "select", key: "purpose_of_journey", labelKey: "fields.purpose", options: [
    { value: "tourism", labelKey: "options.purpose.tourism" },
    { value: "business", labelKey: "options.purpose.business" },
    { value: "visiting_family", labelKey: "options.purpose.family" },
    { value: "medical", labelKey: "options.purpose.medical" },
    { value: "study", labelKey: "options.purpose.study" },
    { value: "transit", labelKey: "options.purpose.transit" },
    { value: "other", labelKey: "options.purpose.other" },
  ] },
  { kind: "country", key: "main_destination", labelKey: "fields.mainDestination" },
  { kind: "country", key: "first_entry_country", labelKey: "fields.firstEntry" },
  { kind: "select", key: "number_of_entries", labelKey: "fields.numberOfEntries", options: [
    { value: "single", labelKey: "options.entries.single" },
    { value: "two", labelKey: "options.entries.two" },
    { value: "multiple", labelKey: "options.entries.multiple" },
  ] },
  { kind: "date", key: "intended_date_of_arrival", labelKey: "fields.arrivalDate" },
  { kind: "date", key: "intended_date_of_departure", labelKey: "fields.departureDate" },
];

const ACCOMMODATION_FIELDS: GenericField[] = [
  { kind: "text", key: "accommodation_address", labelKey: "fields.accommodationAddress" },
  { kind: "text", key: "accommodation_phone", labelKey: "fields.accommodationPhone" },
  { kind: "select", key: "accommodation_type", labelKey: "fields.accommodationType", options: [
    { value: "hotel", labelKey: "options.accommodation.hotel" },
    { value: "private", labelKey: "options.accommodation.private" },
    { value: "rental", labelKey: "options.accommodation.rental" },
    { value: "other", labelKey: "options.accommodation.other" },
  ] },
];

const OCCUPATION_FIELDS: GenericField[] = [
  { kind: "text", key: "current_occupation", labelKey: "fields.occupation" },
  { kind: "text", key: "employer_name", labelKey: "fields.employerName" },
  { kind: "text", key: "employer_address", labelKey: "fields.employerAddress" },
  { kind: "text", key: "employer_phone", labelKey: "fields.employerPhone" },
];

const FINANCIAL_FIELDS: GenericField[] = [
  { kind: "select", key: "cost_of_travelling_covered_by", labelKey: "fields.costsCoveredBy", options: [
    { value: "self", labelKey: "options.funding.self" },
    { value: "sponsor", labelKey: "options.funding.sponsor" },
    { value: "employer", labelKey: "options.funding.employer" },
  ] },
  { kind: "yesno", key: "has_travel_medical_insurance", labelKey: "fields.hasInsurance" },
];

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  document: TRAVEL_DOC_FIELDS,
  contact: CONTACT_FIELDS,
  trip: TRIP_FIELDS,
  accommodation: ACCOMMODATION_FIELDS,
  occupation: OCCUPATION_FIELDS,
  financial: FINANCIAL_FIELDS,
};

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function fieldRows(form: SchengenForm, keys: string[]): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `fields.${camelCase(k)}`, value: form[k] ?? "" }));
}

function reviewSections(form: SchengenForm): WizardReviewSection[] {
  return [
    { titleKey: "review.personal", editStepKey: "personal", rows: fieldRows(form, PERSONAL_FIELDS.map((f) => f.key)) },
    { titleKey: "review.document", editStepKey: "document", rows: fieldRows(form, TRAVEL_DOC_FIELDS.map((f) => f.key)) },
    { titleKey: "review.contact", editStepKey: "contact", rows: fieldRows(form, CONTACT_FIELDS.map((f) => f.key)) },
    { titleKey: "review.trip", editStepKey: "trip", rows: fieldRows(form, TRIP_FIELDS.map((f) => f.key)) },
    { titleKey: "review.accommodation", editStepKey: "accommodation", rows: fieldRows(form, ACCOMMODATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.occupation", editStepKey: "occupation", rows: fieldRows(form, OCCUPATION_FIELDS.map((f) => f.key)) },
    { titleKey: "review.financial", editStepKey: "financial", rows: fieldRows(form, FINANCIAL_FIELDS.map((f) => f.key)) },
  ];
}

function buildPayload(form: SchengenForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  return out;
}

function step(key: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey: `steps.${key}.label`,
    render: ({ form, setForm, onContinue }: { form: SchengenForm; setForm: (u: (p: SchengenForm) => SchengenForm) => void; onContinue: () => void }) =>
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

export const schengenConfig: WizardConfig<SchengenForm> = {
  visaType: "EU_SCHENGEN_C_SHORT_STAY",
  defaultCountry: "schengen",
  defaultVisaType: "EU_SCHENGEN_C_SHORT_STAY",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  seedAuthEmail: (form, email) => ({ ...form, applicants_email: form.applicants_email || email }),
  reviewSections,
  steps: [
    step("personal", "personal"),
    step("document", "document"),
    step("contact", "contact"),
    step("trip", "trip"),
    step("accommodation", "accommodation"),
    step("occupation", "occupation"),
    step("financial", "financial"),
  ],
};
