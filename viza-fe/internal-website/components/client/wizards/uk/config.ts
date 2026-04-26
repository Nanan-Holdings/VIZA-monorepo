import { createElement } from "react";
import { StepGenericFields, type GenericField } from "../shell/shared-steps/step-generic-fields";
import type { WizardConfig, WizardReviewSection } from "../shell/types";

export type UkForm = Record<string, string>;

const NAMESPACE = "simplifiedForm.uk";

const PERSONAL_FIELDS: GenericField[] = [
  { kind: "text", key: "given_names", labelKey: "fields.givenNames", placeholderKey: "fields.givenNamesPlaceholder", required: true },
  { kind: "text", key: "surname", labelKey: "fields.surname", placeholderKey: "fields.surnamePlaceholder", required: true },
  { kind: "date", key: "date_of_birth", labelKey: "fields.dob" },
  { kind: "select", key: "sex", labelKey: "fields.sex", options: [
    { value: "Male", labelKey: "options.sex.male" },
    { value: "Female", labelKey: "options.sex.female" },
  ] },
  { kind: "country", key: "country_of_nationality", labelKey: "fields.nationality" },
  { kind: "country", key: "country_of_birth", labelKey: "fields.countryOfBirth" },
  { kind: "text", key: "place_of_birth", labelKey: "fields.placeOfBirth", placeholderKey: "fields.placeOfBirthPlaceholder" },
];

const PASSPORT_FIELDS: GenericField[] = [
  { kind: "text", key: "passport_number", labelKey: "fields.passportNumber", placeholderKey: "fields.passportNumberPlaceholder" },
  { kind: "country", key: "passport_issuing_authority", labelKey: "fields.passportIssuingCountry" },
  { kind: "date", key: "passport_date_of_issue", labelKey: "fields.passportIssueDate" },
  { kind: "date", key: "passport_date_of_expiry", labelKey: "fields.passportExpiryDate" },
];

const CONTACT_FIELDS: GenericField[] = [
  { kind: "email", key: "email_address", labelKey: "fields.email", placeholderKey: "fields.emailPlaceholder" },
  { kind: "phone", key: "telephone_number", labelKey: "fields.phone", placeholderKey: "fields.phonePlaceholder" },
  { kind: "text", key: "home_address_line1", labelKey: "fields.homeAddressLine1", placeholderKey: "fields.homeAddressLine1Placeholder" },
  { kind: "text", key: "home_address_city", labelKey: "fields.homeAddressCity" },
  { kind: "country", key: "home_country", labelKey: "fields.homeCountry" },
];

const UKVI_FIELDS: GenericField[] = [
  { kind: "email", key: "ukvi_account_email", labelKey: "fields.ukviEmail", placeholderKey: "fields.ukviEmailPlaceholder" },
  { kind: "yesno", key: "has_existing_ukvi_account", labelKey: "fields.hasUkviAccount" },
];

const TRIP_FIELDS: GenericField[] = [
  { kind: "select", key: "purpose_of_visit", labelKey: "fields.purposeOfVisit", options: [
    { value: "tourism", labelKey: "options.purpose.tourism" },
    { value: "business", labelKey: "options.purpose.business" },
    { value: "visiting_family", labelKey: "options.purpose.visitingFamily" },
    { value: "study", labelKey: "options.purpose.study" },
    { value: "medical", labelKey: "options.purpose.medical" },
    { value: "other", labelKey: "options.purpose.other" },
  ] },
  { kind: "date", key: "intended_arrival_date", labelKey: "fields.arrivalDate" },
  { kind: "date", key: "intended_departure_date", labelKey: "fields.departureDate" },
  { kind: "text", key: "uk_address_line1", labelKey: "fields.ukAddress", placeholderKey: "fields.ukAddressPlaceholder" },
  { kind: "text", key: "uk_address_postcode", labelKey: "fields.ukPostcode" },
];

const EMPLOYMENT_FIELDS: GenericField[] = [
  { kind: "select", key: "employment_status", labelKey: "fields.employmentStatus", options: [
    { value: "employed", labelKey: "options.employment.employed" },
    { value: "self_employed", labelKey: "options.employment.selfEmployed" },
    { value: "student", labelKey: "options.employment.student" },
    { value: "retired", labelKey: "options.employment.retired" },
    { value: "unemployed", labelKey: "options.employment.unemployed" },
  ] },
  { kind: "text", key: "employer_name", labelKey: "fields.employerName" },
  { kind: "text", key: "job_title", labelKey: "fields.jobTitle" },
  { kind: "text", key: "monthly_income", labelKey: "fields.monthlyIncome", placeholderKey: "fields.monthlyIncomePlaceholder" },
];

const FINANCES_FIELDS: GenericField[] = [
  { kind: "select", key: "trip_funding_source", labelKey: "fields.fundingSource", options: [
    { value: "self", labelKey: "options.funding.self" },
    { value: "family", labelKey: "options.funding.family" },
    { value: "employer", labelKey: "options.funding.employer" },
    { value: "sponsor", labelKey: "options.funding.sponsor" },
  ] },
  { kind: "text", key: "estimated_trip_cost", labelKey: "fields.estimatedTripCost", placeholderKey: "fields.estimatedTripCostPlaceholder" },
  { kind: "yesno", key: "has_savings", labelKey: "fields.hasSavings" },
];

const STEP_FIELD_MAP: Record<string, GenericField[]> = {
  personal: PERSONAL_FIELDS,
  passport: PASSPORT_FIELDS,
  contact: CONTACT_FIELDS,
  ukvi: UKVI_FIELDS,
  trip: TRIP_FIELDS,
  employment: EMPLOYMENT_FIELDS,
  finances: FINANCES_FIELDS,
};

function fieldRows(form: UkForm, keys: string[], labelPrefix = "fields"): WizardReviewSection["rows"] {
  return keys.map((k) => ({ labelKey: `${labelPrefix}.${camelCase(k)}`, value: form[k] ?? "" }));
}

function camelCase(s: string): string {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase());
}

function reviewSections(form: UkForm): WizardReviewSection[] {
  return [
    {
      titleKey: "review.personal",
      editStepKey: "personal",
      rows: fieldRows(form, [
        "given_names", "surname", "date_of_birth", "sex",
        "country_of_nationality", "country_of_birth", "place_of_birth",
      ]),
    },
    {
      titleKey: "review.passport",
      editStepKey: "passport",
      rows: fieldRows(form, ["passport_number", "passport_issuing_authority", "passport_date_of_issue", "passport_date_of_expiry"]),
    },
    {
      titleKey: "review.contact",
      editStepKey: "contact",
      rows: fieldRows(form, ["email_address", "telephone_number", "home_address_line1", "home_address_city", "home_country"]),
    },
    {
      titleKey: "review.ukvi",
      editStepKey: "ukvi",
      rows: fieldRows(form, ["ukvi_account_email", "has_existing_ukvi_account"]),
    },
    {
      titleKey: "review.trip",
      editStepKey: "trip",
      rows: fieldRows(form, ["purpose_of_visit", "intended_arrival_date", "intended_departure_date", "uk_address_line1", "uk_address_postcode"]),
    },
    {
      titleKey: "review.employment",
      editStepKey: "employment",
      rows: fieldRows(form, ["employment_status", "employer_name", "job_title", "monthly_income"]),
    },
    {
      titleKey: "review.finances",
      editStepKey: "finances",
      rows: fieldRows(form, ["trip_funding_source", "estimated_trip_cost", "has_savings"]),
    },
  ];
}

function buildPayload(form: UkForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(form)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out;
}

function genericStep(key: string, titleKey: string, fieldsKey: keyof typeof STEP_FIELD_MAP) {
  return {
    key,
    titleKey,
    render: ({ form, setForm, onContinue }: { form: UkForm; setForm: (u: (p: UkForm) => UkForm) => void; onContinue: () => void }) =>
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

export const ukConfig: WizardConfig<UkForm> = {
  visaType: "UK_STANDARD_VISITOR",
  defaultCountry: "uk",
  defaultVisaType: "UK_STANDARD_VISITOR",
  emptyForm: () => ({}),
  buildAnswerPayload: buildPayload,
  i18nNamespace: NAMESPACE,
  seedAuthEmail: (form, email) => ({ ...form, email_address: form.email_address || email }),
  reviewSections,
  steps: [
    genericStep("personal", "steps.personal.label", "personal"),
    genericStep("passport", "steps.passport.label", "passport"),
    genericStep("contact", "steps.contact.label", "contact"),
    genericStep("ukvi", "steps.ukvi.label", "ukvi"),
    genericStep("trip", "steps.trip.label", "trip"),
    genericStep("employment", "steps.employment.label", "employment"),
    genericStep("finances", "steps.finances.label", "finances"),
  ],
};
